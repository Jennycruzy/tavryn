import { Tavryn as TavrynBindings } from "../daml.js/tavryn-0.1.0/lib/index.js";

import {
  type Role,
  type TavrynConfig,
  partyForRole,
} from "./config.js";
import {
  type ActiveContract,
  LedgerApi,
  LedgerApiError,
  type SubmissionResult,
} from "./ledger-api.js";

const { Contracts, Types } = TavrynBindings;

export interface InvoiceTermsInput {
  externalInvoiceNumber: string;
  faceValue: string;
  currency: string;
  issuedDate: string;
  dueDate: string;
}

export interface InvoiceDraftInput {
  invoiceCommitment: string;
  terms: InvoiceTermsInput;
}

export class TavrynInputError extends Error {
  readonly status = 400;
  readonly publicCode = "INVALID_REQUEST";
}

export class TavrynConflictError extends Error {
  readonly status = 409;
  readonly publicCode: string;

  constructor(message: string, publicCode: string) {
    super(message);
    this.name = "TavrynConflictError";
    this.publicCode = publicCode;
  }
}

export class TavrynService {
  readonly ledger: LedgerApi;

  constructor(private readonly config: TavrynConfig) {
    this.ledger = new LedgerApi(config);
  }

  ledgerEnd(): Promise<number> {
    return this.ledger.getLedgerEnd();
  }

  createNetworkRules(maxAdvanceRate: string): Promise<SubmissionResult> {
    assertDecimal(maxAdvanceRate, "maxAdvanceRate");
    return this.ledger.create(
      Contracts.NetworkRules,
      {
        governanceParty: this.config.parties.governance,
        members: this.allNetworkMembers(),
        maxAdvanceRate,
      },
      [this.config.parties.governance],
    );
  }

  createBuyerRegistry(): Promise<SubmissionResult> {
    return this.ledger.create(
      Contracts.BuyerApprovalRegistry,
      {
        buyer: this.config.parties.buyer,
        approvedInvoiceNumbers: [],
      },
      [this.config.parties.buyer],
    );
  }

  createInvoiceDraft(input: InvoiceDraftInput): Promise<SubmissionResult> {
    validateInvoiceInput(input);
    return this.ledger.create(
      Contracts.InvoiceDraft,
      {
        supplier: this.config.parties.supplier,
        buyer: this.config.parties.buyer,
        invoiceCommitment: input.invoiceCommitment,
        terms: encodeTerms(input.terms),
      },
      [this.config.parties.supplier],
    );
  }

  approveInvoice(
    draftContractId: string,
    networkRulesContractId: string,
    approvalRegistryContractId: string,
  ): Promise<SubmissionResult> {
    requireContractId(draftContractId, "draftContractId");
    requireContractId(networkRulesContractId, "networkRulesContractId");
    requireContractId(approvalRegistryContractId, "approvalRegistryContractId");
    return this.ledger
      .exercise(
        Contracts.InvoiceDraft,
        Contracts.InvoiceDraft.Approve,
        draftContractId,
        {
          networkRules: networkRulesContractId,
          approvalRegistry: approvalRegistryContractId,
          eligibleFinanciers: [
            this.config.parties.financierA,
            this.config.parties.financierB,
          ],
          auditor: this.config.parties.auditor,
        },
        [this.config.parties.buyer],
      )
      .catch((error) => {
        if (error instanceof LedgerApiError) {
          throw new TavrynConflictError(
            "The buyer could not approve this invoice. Its external invoice number may already be approved.",
            "DUPLICATE_OR_INVALID_APPROVAL",
          );
        }
        throw error;
      });
  }

  createOffer(
    approvedInvoiceContractId: string,
    financierRole: "financierA" | "financierB",
    advance: string,
    advanceRate: string,
  ): Promise<SubmissionResult> {
    requireContractId(approvedInvoiceContractId, "approvedInvoiceContractId");
    assertDecimal(advance, "advance");
    assertDecimal(advanceRate, "advanceRate");
    const financier = partyForRole(this.config, financierRole);
    return this.ledger.exercise(
      Contracts.ApprovedInvoice,
      Contracts.ApprovedInvoice.CreateOffer,
      approvedInvoiceContractId,
      {
        approvedInvoice: approvedInvoiceContractId,
        financier,
        advance,
        advanceRate,
      },
      [this.config.parties.buyer, this.config.parties.supplier],
    );
  }

  acceptOffer(
    offerContractId: string,
    financierRole: "financierA" | "financierB",
  ): Promise<SubmissionResult> {
    requireContractId(offerContractId, "offerContractId");
    const financier = partyForRole(this.config, financierRole);
    return this.ledger
      .exercise(
        Contracts.FinancingOffer,
        Contracts.FinancingOffer.Accept,
        offerContractId,
        {},
        [this.config.parties.buyer, this.config.parties.supplier, financier],
      )
      .catch((error) => {
        if (error instanceof LedgerApiError) {
          throw new TavrynConflictError(
            "This invoice is no longer available for funding.",
            "INVOICE_UNAVAILABLE",
          );
        }
        throw error;
      });
  }

  repay(
    financedContractId: string,
    financierRole: "financierA" | "financierB",
    repaymentDate: string,
    paymentReference: string,
  ): Promise<SubmissionResult> {
    requireContractId(financedContractId, "financedContractId");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(repaymentDate)) {
      throw new TavrynInputError("repaymentDate must be YYYY-MM-DD");
    }
    if (!paymentReference.trim()) {
      throw new TavrynInputError("paymentReference is required");
    }
    const financier = partyForRole(this.config, financierRole);
    return this.ledger.exercise(
      Contracts.FinancedInvoice,
      Contracts.FinancedInvoice.Repay,
      financedContractId,
      { repaymentDate, paymentReference },
      [this.config.parties.buyer, financier],
    );
  }

  contractsForRole(role: Role): Promise<ActiveContract[]> {
    return this.ledger.activeContracts(partyForRole(this.config, role));
  }

  private allNetworkMembers(): string[] {
    return [
      this.config.parties.supplier,
      this.config.parties.buyer,
      this.config.parties.financierA,
      this.config.parties.financierB,
      this.config.parties.auditor,
    ];
  }
}

function validateInvoiceInput(input: InvoiceDraftInput): void {
  if (!input.invoiceCommitment.trim()) {
    throw new TavrynInputError("invoiceCommitment is required");
  }
  if (!input.terms || typeof input.terms !== "object") {
    throw new TavrynInputError("terms are required");
  }
  if (!input.terms.externalInvoiceNumber.trim()) {
    throw new TavrynInputError("terms.externalInvoiceNumber is required");
  }
  assertDecimal(input.terms.faceValue, "terms.faceValue");
  if (!input.terms.currency.trim()) {
    throw new TavrynInputError("terms.currency is required");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.terms.issuedDate)) {
    throw new TavrynInputError("terms.issuedDate must be YYYY-MM-DD");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.terms.dueDate)) {
    throw new TavrynInputError("terms.dueDate must be YYYY-MM-DD");
  }
  if (input.terms.dueDate <= input.terms.issuedDate) {
    throw new TavrynInputError("terms.dueDate must be after terms.issuedDate");
  }
}

function assertDecimal(value: string, name: string): void {
  if (
    typeof value !== "string" ||
    !/^\d+(?:\.\d{1,10})?$/.test(value) ||
    Number(value) < 0
  ) {
    throw new TavrynInputError(`${name} must be a non-negative decimal string`);
  }
}

function requireContractId(value: string, name: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new TavrynInputError(`${name} is required`);
  }
}

function encodeTerms(input: InvoiceTermsInput): unknown {
  return Types.InvoiceTerms.encode({
    externalInvoiceNumber: input.externalInvoiceNumber,
    faceValue: input.faceValue,
    currency: input.currency,
    issuedDate: input.issuedDate,
    dueDate: input.dueDate,
  });
}
