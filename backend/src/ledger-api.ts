import { randomUUID } from "node:crypto";

import type { OidcConfig, TavrynConfig } from "./config.js";

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
  readonly code?: string;
  readonly cause?: string;
  readonly errorCategory?: number;
  readonly contextErrorId?: string;

  constructor(
    status: number,
    payload: unknown,
    submissionReference?: SubmissionReference,
  ) {
    super(
      status === 0
        ? "The Canton participant could not be reached"
        : `Canton Ledger API returned HTTP ${status}`,
    );
    this.name = "LedgerApiError";
    this.status = status;
    this.payload = payload;
    this.submissionReference = submissionReference;
    const details = objectRecord(payload);
    const context = objectRecord(details?.context);
    this.code = stringValue(details?.code);
    this.cause = stringValue(details?.cause);
    this.errorCategory = numberValue(details?.errorCategory);
    this.contextErrorId = stringValue(context?.error_id);
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

function objectRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

// Shared-node tokens expire, so an OIDC token is cached until 60 s before expiry and
// refreshed once on a 401. A static CANTON_LEDGER_API_TOKEN remains the LocalNet path.
export class LedgerTokenProvider {
  private cached?: { token: string; expiresAt: number };
  private refreshToken?: string;

  constructor(
    private readonly staticToken: string | undefined,
    private readonly oidc: OidcConfig | undefined,
  ) {
    this.refreshToken = oidc?.refreshToken;
  }

  async token(forceRefresh = false): Promise<string | undefined> {
    if (!this.oidc) return this.staticToken;
    if (!forceRefresh && this.cached && Date.now() < this.cached.expiresAt - 60_000) {
      return this.cached.token;
    }
    const oidc = this.oidc;
    const form = new URLSearchParams({ client_id: oidc.clientId });
    if (oidc.clientSecret) form.set("client_secret", oidc.clientSecret);
    if (oidc.audience) form.set("audience", oidc.audience);
    if (oidc.scope) form.set("scope", oidc.scope);
    if (this.refreshToken) {
      form.set("grant_type", "refresh_token");
      form.set("refresh_token", this.refreshToken);
    } else if (oidc.username && oidc.password) {
      form.set("grant_type", "password");
      form.set("username", oidc.username);
      form.set("password", oidc.password);
    } else {
      form.set("grant_type", "client_credentials");
    }
    let response: Response;
    try {
      response = await fetch(oidc.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
    } catch {
      throw new LedgerApiError(0, { code: "OIDC_UNREACHABLE" });
    }
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || typeof payload.access_token !== "string") {
      // A rotated refresh token falls back to the password grant once, if configured.
      if (this.refreshToken && oidc.username && oidc.password) {
        this.refreshToken = undefined;
        return this.token(true);
      }
      throw new LedgerApiError(response.status === 200 ? 401 : response.status, {
        code: "OIDC_TOKEN_REJECTED",
      });
    }
    if (typeof payload.refresh_token === "string") {
      this.refreshToken = payload.refresh_token;
    }
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 300;
    this.cached = { token: payload.access_token, expiresAt: Date.now() + expiresIn * 1000 };
    return this.cached.token;
  }
}

export interface UserRight {
  kind: string;
  party?: string;
}

export class LedgerApi {
  private readonly tokens: LedgerTokenProvider;

  constructor(private readonly config: TavrynConfig) {
    this.tokens = new LedgerTokenProvider(config.ledgerApiToken, config.oidc);
  }

  async userRights(userId: string): Promise<UserRight[]> {
    const response = await this.request<{ rights?: Array<{ kind?: Record<string, { value?: { party?: string } }> }> }>(
      `/v2/users/${encodeURIComponent(userId)}/rights`,
      { method: "GET" },
    );
    return (response.rights ?? []).flatMap((right) =>
      Object.entries(right.kind ?? {}).map(([kind, detail]) => ({
        kind,
        party: detail?.value?.party,
      })),
    );
  }

  async packageIds(): Promise<string[]> {
    const response = await this.request<{ packageIds?: string[] }>("/v2/packages", {
      method: "GET",
    });
    return response.packageIds ?? [];
  }

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

    const contracts = responses.flatMap((response) => {
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

    if (!this.config.packageId) {
      throw new Error("CANTON_PACKAGE_ID is required for active-contract reads");
    }
    return contracts.filter(
      (contract) => contract.templateId.split(":", 1)[0] === this.config.packageId,
    );
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
            templateId: qualifyTemplateId(this.config.packageId, template.templateId),
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
            templateId: qualifyTemplateId(this.config.packageId, template.templateId),
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
    retriedAuth = false,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    const token = await this.tokens.token(retriedAuth);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetch(`${this.config.ledgerApiUrl}${path}`, {
        ...init,
        headers,
      });
    } catch {
      // Keep transport failures in the same typed path as HTTP failures. The
      // HTTP layer turns this into a 502 instead of an indistinguishable 500.
      throw new LedgerApiError(0, undefined, submissionReference);
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
    if (response.status === 401 && this.config.oidc && !retriedAuth) {
      return this.request<T>(path, init, submissionReference, true);
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

function qualifyTemplateId(packageId: string | undefined, templateId: string): string {
  if (!packageId || !templateId.startsWith("#")) {
    return templateId;
  }
  const separator = templateId.indexOf(":");
  if (separator < 0) {
    return templateId;
  }
  return `${packageId}${templateId.slice(separator)}`;
}
