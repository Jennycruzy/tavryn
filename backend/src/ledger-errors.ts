import { LedgerApiError } from "./ledger-api.js";

export interface MappedLedgerError {
  status: 400 | 409;
  code: string;
  message: string;
}

export type LedgerErrorContext = "funding" | "approval" | "governance" | "settlement" | "other";

const TAG_PATTERN = /TAVRYN_[A-Z_]+/;

// Business rejections raised by Tavryn's own `assertMsg` tags.
const TAGGED: Record<string, MappedLedgerError> = {
  TAVRYN_DUPLICATE_INVOICE: {
    status: 409,
    code: "DUPLICATE_INVOICE",
    message: "The buyer already approved this external invoice number.",
  },
  TAVRYN_THRESHOLD_NOT_MET: {
    status: 409,
    code: "GOVERNANCE_THRESHOLD_NOT_MET",
    message: "Not enough operator approvals. Nothing changed.",
  },
  TAVRYN_NOT_ELIGIBLE: {
    status: 409,
    code: "FINANCIER_NOT_ELIGIBLE",
    message: "This financier is not admitted to the network or not eligible for this invoice.",
  },
  TAVRYN_RATE_ABOVE_MAX: {
    status: 409,
    code: "RATE_ABOVE_NETWORK_MAX",
    message: "The advance rate is above the network's current maximum.",
  },
  TAVRYN_PROPOSAL_EXPIRED: {
    status: 409,
    code: "PROPOSAL_EXPIRED",
    message: "This proposal has expired. Nothing changed.",
  },
  TAVRYN_STALE_PROPOSAL: {
    status: 409,
    code: "PROPOSAL_STALE",
    message: "The network rules changed after this proposal was made. Propose it again.",
  },
  TAVRYN_VOTE_MISMATCH: {
    status: 409,
    code: "VOTE_MISMATCH",
    message: "A vote does not belong to this proposal and rules version.",
  },
  TAVRYN_ALREADY_MEMBER: {
    status: 409,
    code: "GOVERNANCE_ACTION_INVALID",
    message: "That party is already a member.",
  },
  TAVRYN_NOT_MEMBER: {
    status: 409,
    code: "GOVERNANCE_ACTION_INVALID",
    message: "That financier is not a member.",
  },
  TAVRYN_ALREADY_ONBOARDED: {
    status: 409,
    code: "GOVERNANCE_ACTION_INVALID",
    message: "That buyer is already onboarded.",
  },
  TAVRYN_INVALID_RATE: {
    status: 400,
    code: "GOVERNANCE_ACTION_INVALID",
    message: "The advance rate must be between 0 and 1.",
  },
  TAVRYN_BUYER_NOT_ONBOARDED: {
    status: 409,
    code: "BUYER_NOT_ONBOARDED",
    message: "The buyer has not been onboarded to this network.",
  },
  TAVRYN_REGISTRY_MISMATCH: {
    status: 409,
    code: "REGISTRY_MISMATCH",
    message: "The approval registry does not belong to this buyer and network.",
  },
  TAVRYN_RULES_MISMATCH: {
    status: 409,
    code: "RULES_MISMATCH",
    message: "The invoice does not belong to this network.",
  },
  TAVRYN_INVOICE_MISMATCH: {
    status: 409,
    code: "INVOICE_MISMATCH",
    message: "The offer does not match this approved invoice.",
  },
  TAVRYN_AMOUNT_MISMATCH: {
    status: 400,
    code: "SETTLEMENT_AMOUNT_MISMATCH",
    message: "The settlement amount does not match the contract.",
  },
  TAVRYN_INSTRUMENT_MISMATCH: {
    status: 400,
    code: "SETTLEMENT_INSTRUMENT_MISMATCH",
    message: "The settlement instrument does not match the invoice currency.",
  },
  TAVRYN_INVALID_ADVANCE: {
    status: 400,
    code: "INVALID_ADVANCE",
    message: "The advance must be positive and no more than face value times the rate.",
  },
  TAVRYN_REPAYMENT_BEFORE_ISSUE: {
    status: 400,
    code: "REPAYMENT_BEFORE_ISSUE",
    message: "The repayment date is before the invoice issue date.",
  },
};

// Canton identifiers for a contract that another transaction already consumed or is
// consuming. These are the only untagged failures shown as business conflicts.
const CONTENTION_CODES = new Set([
  "CONTRACT_NOT_FOUND",
  "LOCAL_VERDICT_LOCKED_CONTRACTS",
  "LOCAL_VERDICT_INACTIVE_CONTRACTS",
  "INCONSISTENT_CONTRACTS",
  "SEQUENCER_REQUEST_FAILED_LOCKED_CONTRACTS",
]);
const CONTENTION_CATEGORY = 2;

export function ledgerTag(error: LedgerApiError): string | undefined {
  const sources = [error.cause, error.contextErrorId, safeStringify(error.payload)];
  for (const source of sources) {
    const match = source ? TAG_PATTERN.exec(source) : null;
    if (match) return match[0];
  }
  return undefined;
}

export function isContention(error: LedgerApiError): boolean {
  return (
    (error.code !== undefined && CONTENTION_CODES.has(error.code)) ||
    error.errorCategory === CONTENTION_CATEGORY
  );
}

/**
 * Maps a Canton failure to a business response, or returns undefined when it must stay
 * a 502 (authorization, unknown package, timeout, transport).
 */
export function mapLedgerError(
  error: unknown,
  context: LedgerErrorContext,
): MappedLedgerError | undefined {
  if (!(error instanceof LedgerApiError) || error.status === 0) return undefined;
  if (error.status === 401 || error.status === 403) return undefined;
  const tag = ledgerTag(error);
  if (tag) {
    return (
      TAGGED[tag] ?? {
        status: 409,
        code: tag.slice("TAVRYN_".length),
        message: "The ledger rejected this action.",
      }
    );
  }
  if (isContention(error)) {
    if (context === "funding") {
      return {
        status: 409,
        code: "INVOICE_UNAVAILABLE",
        message: "This invoice is no longer available for funding.",
      };
    }
    return {
      status: 409,
      code: "STATE_CHANGED",
      message: "The ledger state changed before this action completed. Refresh and try again.",
    };
  }
  return undefined;
}

function safeStringify(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return undefined;
  }
}
