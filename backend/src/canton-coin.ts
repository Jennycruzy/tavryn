import { randomUUID } from "node:crypto";

import type { TavrynConfig } from "./config.js";

export type SettlementSenderRole = "buyer" | "financierA" | "financierB";

export interface CantonCoinTransfer {
  updateId: string;
  eventId: string;
  trackingId: string;
  description: string;
  amount: string;
  sender: string;
  receiver: string;
}

export class CantonCoinSettlementError extends Error {
  readonly status = 502;
  readonly publicCode: string;
  readonly safeToCancel: boolean;

  constructor(
    message: string,
    publicCode = "SETTLEMENT_FAILED",
    safeToCancel = false,
  ) {
    super(message);
    this.name = "CantonCoinSettlementError";
    this.publicCode = publicCode;
    this.safeToCancel = safeToCancel;
  }
}

interface TransferResponse {
  output?: {
    receiver_holding_cids?: string[];
    transfer_instruction_cid?: string;
    dummy?: object;
  };
  sender_change_cids?: string[];
  meta?: Record<string, string>;
}

interface WalletTransaction {
  transaction_type?: string;
  event_id?: string;
  tracking_id?: string;
  description?: string;
  date?: string;
  sender?: { party?: string; amount?: string };
  receivers?: Array<{ party?: string; amount?: string }>;
}

interface WalletTransactionsResponse {
  items?: WalletTransaction[];
}

export class CantonCoinSettlement {
  constructor(private readonly config: TavrynConfig) {}

  assertConfigured(senderRole: SettlementSenderRole): void {
    if (
      !this.config.settlement.validatorApiUrl ||
      !this.config.settlement.walletTokens[senderRole]
    ) {
      throw new CantonCoinSettlementError(
        "Canton Coin settlement is not configured for this role.",
        "SETTLEMENT_NOT_CONFIGURED",
      );
    }
  }

  async transfer(
    senderRole: SettlementSenderRole,
    receiverParty: string,
    amount: string,
    purpose: "funding" | "repayment",
  ): Promise<CantonCoinTransfer> {
    assertPositiveDecimal(amount, "settlement amount");
    this.assertConfigured(senderRole);
    const validatorApiUrl = this.config.settlement.validatorApiUrl as string;
    const token = this.config.settlement.walletTokens[senderRole] as string;

    const sender = this.config.parties[senderRole];
    const trackingId = `tavryn-${purpose}-${randomUUID()}`;
    const description = `Tavryn ${purpose} ${trackingId}`;
    const expiresAt =
      Math.floor(Date.now() / 1000) * 1_000_000 +
      this.config.settlement.transferExpirySeconds * 1_000_000;

    const response = await this.request<TransferResponse>(
      validatorApiUrl,
      token,
      "/v0/wallet/token-standard/transfers",
      {
        receiver_party_id: receiverParty,
        amount,
        description,
        expires_at: expiresAt,
        tracking_id: trackingId,
      },
    );

    if (!response.output?.receiver_holding_cids) {
      if (response.output?.transfer_instruction_cid) {
        throw new CantonCoinSettlementError(
          "Canton Coin transfer is still pending; the invoice remains locked until settlement is confirmed.",
          "SETTLEMENT_PENDING",
        );
      }
      throw new CantonCoinSettlementError(
        "Canton Coin transfer did not complete; the invoice remains locked until the payment state is resolved.",
        "SETTLEMENT_NOT_COMPLETED",
        true,
      );
    }

    const transaction = await this.findTransaction(
      validatorApiUrl,
      token,
      sender,
      receiverParty,
      description,
      trackingId,
      amount,
    );
    if (!transaction) {
      throw new CantonCoinSettlementError(
        "Canton Coin completed but its wallet transaction reference was not available yet; the invoice remains locked for reconciliation.",
        "SETTLEMENT_REFERENCE_UNAVAILABLE",
      );
    }
    const eventId = transaction.event_id;
    if (!eventId) {
      throw new CantonCoinSettlementError(
        "The wallet transaction did not include an event reference.",
        "SETTLEMENT_REFERENCE_INVALID",
      );
    }

    return {
      updateId: updateIdFromEventId(eventId),
      eventId,
      trackingId,
      description,
      amount,
      sender,
      receiver: receiverParty,
    };
  }

  private async findTransaction(
    validatorApiUrl: string,
    token: string,
    sender: string,
    receiver: string,
    description: string,
    trackingId: string,
    amount: string,
  ): Promise<WalletTransaction | undefined> {
    const deadline = Date.now() + 30_000;
    let beginAfterId: string | undefined;
    while (Date.now() < deadline) {
      const response = await this.request<WalletTransactionsResponse>(
        validatorApiUrl,
        token,
        "/v0/wallet/transactions",
        {
          page_size: 100,
          ...(beginAfterId ? { begin_after_id: beginAfterId } : {}),
        },
      );
      const match = response.items?.find(
        (transaction) =>
          transaction.transaction_type === "transfer" &&
          (transaction.tracking_id
            ? transaction.tracking_id === trackingId
            : transaction.description === description) &&
          transaction.sender?.party === sender &&
          sameDecimal(transaction.sender.amount, amount) &&
          transaction.receivers?.some(
            (item) => item.party === receiver && sameDecimal(item.amount, amount),
          ),
      );
      if (match?.event_id) {
        return match;
      }

      const lastEventId = response.items?.at(-1)?.event_id;
      if (!lastEventId || lastEventId === beginAfterId || (response.items?.length ?? 0) < 100) {
        beginAfterId = undefined;
        await delay(250);
      } else {
        beginAfterId = lastEventId;
      }
    }
    return undefined;
  }

  private async request<T>(
    validatorApiUrl: string,
    token: string,
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${validatorApiUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new CantonCoinSettlementError(
        "The Canton Coin wallet could not be reached.",
        "SETTLEMENT_UNREACHABLE",
      );
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
      console.error("Canton Coin wallet request failed", { status: response.status });
      throw new CantonCoinSettlementError(
        "The Canton Coin wallet rejected the settlement request.",
        response.status === 429 ? "SETTLEMENT_RETRY_REQUIRED" : "SETTLEMENT_REJECTED",
        response.status !== 429 && response.status < 500,
      );
    }
    return payload as T;
  }
}

function assertPositiveDecimal(value: string, name: string): void {
  if (!/^\d+(?:\.\d{1,10})?$/.test(value) || Number(value) <= 0) {
    throw new Error(`${name} must be a positive decimal string`);
  }
}

function updateIdFromEventId(eventId: string): string {
  const match = /^#(.+):\d+$/.exec(eventId);
  if (!match) {
    throw new CantonCoinSettlementError(
      "The wallet returned an unrecognized transaction event reference.",
      "SETTLEMENT_REFERENCE_INVALID",
    );
  }
  return match[1];
}

function sameDecimal(value: string | undefined, expected: string): boolean {
  const absoluteValue = value?.startsWith("-") ? value.slice(1) : value;
  if (
    !absoluteValue ||
    !/^\d+(?:\.\d+)?$/.test(absoluteValue) ||
    !/^\d+(?:\.\d+)?$/.test(expected)
  ) {
    return false;
  }
  const [whole, fraction = ""] = absoluteValue.split(".");
  const [expectedWhole, expectedFraction = ""] = expected.split(".");
  return whole === expectedWhole && fraction.replace(/0+$/, "") === expectedFraction.replace(/0+$/, "");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
