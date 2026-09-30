import { randomUUID } from "node:crypto";

import type { TavrynConfig } from "./config.js";

export interface TemplateBinding {
  templateId: string;
  encode(value: unknown): unknown;
}

export interface ChoiceBinding {
  choiceName: string;
  argumentEncode(value: unknown): unknown;
}

export interface CreatedEvent {
  contractId: string;
  templateId: string;
  createArgument?: unknown;
  offset?: number;
  nodeId?: number;
  createdEventBlob?: string;
  witnessParties?: string[];
}

export interface ActiveContract {
  contractId: string;
  templateId: string;
  createArgument: unknown;
  synchronizerId?: string;
  offset?: number;
  witnessParties?: string[];
}

export interface LedgerTransaction {
  updateId: string;
  offset: number;
  synchronizerId: string;
  events: unknown[];
  recordTime?: string;
}

export interface SubmissionResult {
  transaction: LedgerTransaction;
  createdContracts: CreatedEvent[];
}

export interface SubmissionReference {
  commandId: string;
  submissionId: string;
}

export class LedgerApiError extends Error {
  readonly status: number;
  readonly payload: unknown;
  readonly submissionReference?: SubmissionReference;

  constructor(
    status: number,
    payload: unknown,
    submissionReference?: SubmissionReference,
  ) {
    super(`Canton Ledger API returned HTTP ${status}`);
    this.name = "LedgerApiError";
    this.status = status;
    this.payload = payload;
    this.submissionReference = submissionReference;
  }
}

type Command =
  | { CreateCommand: { templateId: string; createArguments: unknown } }
  | {
      ExerciseCommand: {
        templateId: string;
        contractId: string;
        choice: string;
        choiceArgument: unknown;
      };
    };

interface JsTransactionResponse {
  transaction: LedgerTransaction;
}

interface ActiveContractResponse {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent: CreatedEvent;
      synchronizerId: string;
    };
  };
}

interface LedgerEndResponse {
  offset: number | string;
}

export class LedgerApi {
  constructor(private readonly config: TavrynConfig) {}

  async getLedgerEnd(): Promise<number> {
    const response = await this.request<LedgerEndResponse>("/v2/state/ledger-end", {
      method: "GET",
    });
    return Number(response.offset);
  }

  async activeContracts(party: string): Promise<ActiveContract[]> {
    const activeAtOffset = await this.getLedgerEnd();
    const body = {
      activeAtOffset,
      eventFormat: {
        filtersByParty: {
          [party]: {
            cumulative: [
              {
                identifierFilter: {
                  WildcardFilter: { value: {} },
                },
              },
            ],
          },
        },
        verbose: true,
      },
    };
    const responses = await this.request<ActiveContractResponse[]>(
      "/v2/state/active-contracts",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );

    return responses.flatMap((response) => {
      const active = response.contractEntry?.JsActiveContract;
      if (!active) {
        return [];
      }
      return [
        {
          contractId: active.createdEvent.contractId,
          templateId: active.createdEvent.templateId,
          createArgument: active.createdEvent.createArgument,
          offset: active.createdEvent.offset,
          witnessParties: active.createdEvent.witnessParties,
          synchronizerId: active.synchronizerId,
        },
      ];
    });
  }

  async create(
    template: TemplateBinding,
    payload: unknown,
    actAs: string[],
    readAs?: string[],
  ): Promise<SubmissionResult> {
    return this.submit(
      [
        {
          CreateCommand: {
            templateId: template.templateId,
            createArguments: template.encode(payload),
          },
        },
      ],
      actAs,
      readAs,
    );
  }

  async exercise(
    template: TemplateBinding,
    choice: ChoiceBinding,
    contractId: string,
    payload: unknown,
    actAs: string[],
    readAs?: string[],
  ): Promise<SubmissionResult> {
    return this.submit(
      [
        {
          ExerciseCommand: {
            templateId: template.templateId,
            contractId,
            choice: choice.choiceName,
            choiceArgument: choice.argumentEncode(payload),
          },
        },
      ],
      actAs,
      readAs,
    );
  }

  async submit(
    commands: Command[],
    actAs: string[],
    readAs?: string[],
  ): Promise<SubmissionResult> {
    if (commands.length === 0) {
      throw new Error("At least one Canton command is required");
    }
    if (actAs.length === 0) {
      throw new Error("At least one acting party is required");
    }

    const submissionReference: SubmissionReference = {
      commandId: `tavryn-${randomUUID()}`,
      submissionId: randomUUID(),
    };
    const commandGroup: Record<string, unknown> = {
      commands,
      commandId: submissionReference.commandId,
      actAs,
      submissionId: submissionReference.submissionId,
    };
    if (this.config.userId) {
      commandGroup.userId = this.config.userId;
    }
    if (readAs && readAs.length > 0) {
      commandGroup.readAs = readAs;
    }
    if (this.config.synchronizerId) {
      commandGroup.synchronizerId = this.config.synchronizerId;
    }

    const response = await this.request<JsTransactionResponse>(
      "/v2/commands/submit-and-wait-for-transaction",
      {
        method: "POST",
        body: JSON.stringify({ commands: commandGroup }),
      },
      submissionReference,
    );
    const transaction = response.transaction;
    return {
      transaction,
      createdContracts: transaction.events.flatMap((event) => {
        if (!isCreatedEvent(event)) {
          return [];
        }
        return [event.CreatedEvent];
      }),
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    submissionReference?: SubmissionReference,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    if (this.config.ledgerApiToken) {
      headers.set("Authorization", `Bearer ${this.config.ledgerApiToken}`);
    }

    let response: Response;
    try {
      response = await fetch(`${this.config.ledgerApiUrl}${path}`, {
        ...init,
        headers,
      });
    } catch {
      throw new Error("The Canton participant could not be reached");
    }

    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!response.ok) {
      throw new LedgerApiError(response.status, payload, submissionReference);
    }
    return payload as T;
  }
}

function isCreatedEvent(
  event: unknown,
): event is { CreatedEvent: CreatedEvent } {
  return (
    typeof event === "object" &&
    event !== null &&
    "CreatedEvent" in event &&
    typeof (event as { CreatedEvent?: unknown }).CreatedEvent === "object" &&
    (event as { CreatedEvent?: unknown }).CreatedEvent !== null
  );
}
