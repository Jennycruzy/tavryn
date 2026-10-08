import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import type { LedgerTransaction } from "./ledger-api.js";

// Wallet payments: a company pays from a wallet Tavryn does not hold (the visitor's Loop
// wallet, or the demo wallet), which lives on another participant and so cannot hold
// Tavryn contracts. The wallet carries the cash only. Tavryn locks the step first, the
// wallet pays, and the step completes only when the receiver's own ledger view shows the
// coins arriving from the recorded wallet.

export const LOOP_TRACKING_PREFIX = "tavryn-loop-";
export const DEMO_TRACKING_PREFIX = "tavryn-demo-";

export function isWalletTrackingId(trackingId: string): boolean {
  return trackingId.startsWith(LOOP_TRACKING_PREFIX) || trackingId.startsWith(DEMO_TRACKING_PREFIX);
}

export interface LoopPaymentExpectation {
  // The supplier for funding and balances, the lender for repayments.
  receiver: string;
  // The Loop party the lender connected. Undefined when it was not recorded, in which
  // case only a payment carrying the tracking ID as its memo is accepted.
  sender?: string;
  amount: string;
  trackingId: string;
  lockedAt?: Date;
  // The ledger offset of the step being paid; anything earlier never counts.
  notBeforeOffset?: number;
}

export interface LoopPayment {
  updateId: string;
  offset: number;
  effectiveAt?: string;
  sender: string;
  amount: string;
  memoMatched: boolean;
}

// Clock skew allowed between the lock's ledger time and the payment's.
const SKEW_MS = 5_000;

/**
 * A transaction pays the receiver when, in the same transaction, the sender acts and a
 * Canton Coin holding of exactly `amount` is created for the receiver. Holdings for
 * anyone else (the sender's change) are ignored.
 */
export function matchLoopPayment(
  transaction: LedgerTransaction,
  expected: LoopPaymentExpectation,
): LoopPayment | undefined {
  const events = (transaction.events ?? []) as Array<Record<string, any>>;
  if (expected.notBeforeOffset !== undefined && Number(transaction.offset) < expected.notBeforeOffset) {
    return undefined;
  }
  const paidReceiver = events.some((event) => {
    const created = event.CreatedEvent;
    return (
      created &&
      String(created.templateId).endsWith(":Splice.Amulet:Amulet") &&
      created.createArgument?.owner === expected.receiver &&
      sameDecimal(created.createArgument?.amount?.initialAmount, expected.amount)
    );
  });
  if (!paidReceiver) return undefined;

  const actors = new Set<string>(
    events.flatMap((event) => (event.ExercisedEvent?.actingParties as string[] | undefined) ?? []),
  );
  const memoMatched = JSON.stringify(events).includes(expected.trackingId);
  const namedSender = events
    .map((event) => event.ExercisedEvent?.choiceArgument?.sender)
    .find((party): party is string => typeof party === "string");
  const sender = expected.sender ?? namedSender;
  if (!sender || sender === expected.receiver || !actors.has(sender)) return undefined;
  if (!expected.sender && !memoMatched) return undefined;

  const effectiveAt = transaction.effectiveAt ?? transaction.recordTime;
  if (effectiveAt && expected.lockedAt && new Date(effectiveAt).getTime() < expected.lockedAt.getTime() - SKEW_MS) {
    return undefined;
  }
  return {
    updateId: transaction.updateId,
    offset: Number(transaction.offset),
    effectiveAt,
    sender,
    amount: expected.amount,
    memoMatched,
  };
}

// The Loop party behind each lock, and every payment already used, so one payment can
// never complete two invoices. Kept in a small JSON file so a restart forgets nothing.
interface LoopPayersFile {
  payers: Record<string, string>;
  usedPayments: Record<string, string>;
}

export class LoopPayers {
  private readonly data: LoopPayersFile;

  constructor(private readonly path?: string) {
    this.data = path && existsSync(path)
      ? (JSON.parse(readFileSync(path, "utf8")) as LoopPayersFile)
      : { payers: {}, usedPayments: {} };
  }

  payerFor(trackingId: string): string | undefined {
    return this.data.payers[trackingId];
  }

  recordPayer(trackingId: string, party: string): void {
    this.data.payers[trackingId] = party;
    this.save();
  }

  usedBy(updateId: string): string | undefined {
    return this.data.usedPayments[updateId];
  }

  recordUsed(updateId: string, trackingId: string): void {
    this.data.usedPayments[updateId] = trackingId;
    this.save();
  }

  private save(): void {
    if (!this.path) return;
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.data, null, 2));
    renameSync(temporary, this.path);
  }
}

// A Canton party ID: a hint, "::", and a hex fingerprint.
export function isPartyId(value: string): boolean {
  return /^[A-Za-z0-9_.:-]{1,200}::[0-9a-f]{68}$/.test(value);
}

function sameDecimal(value: unknown, expected: string): boolean {
  if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value) || !/^\d+(\.\d+)?$/.test(expected)) {
    return false;
  }
  const [whole, fraction = ""] = value.split(".");
  const [expectedWhole, expectedFraction = ""] = expected.split(".");
  return (
    whole.replace(/^0+(?=\d)/, "") === expectedWhole.replace(/^0+(?=\d)/, "") &&
    fraction.replace(/0+$/, "") === expectedFraction.replace(/0+$/, "")
  );
}
