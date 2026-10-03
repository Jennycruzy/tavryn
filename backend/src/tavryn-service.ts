import { Tavryn as TavrynBindings } from "../daml.js/tavryn-0.1.1/lib/index.js";

import {
  type Role,
  type TavrynConfig,
  partyForRole,
} from "./config.js";
import {
  type ActiveContract,
  LedgerApi,
  LedgerApiError,
  type SubmissionReference,
  type SubmissionResult,
} from "./ledger-api.js";
import {
  CantonCoinSettlement,
  CantonCoinSettlementError,
  type CantonCoinTransfer,
} from "./canton-coin.js";
import {
  FinancingOfferBeginFunding,
  PendingFunding,
  PendingFundingCancel,
  PendingFundingComplete,
} from "./settlement-contracts.js";
import {
  FinancierAdmissionProposal,
  FinancierAdmissionProposalConfirm,
  FinancierAdmissionProposalExecute,
  GovernanceCommittee,
  GovernanceCommitteeProposeFinancierAdmission,
} from "./governance-contracts.js";

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

export interface SettledSubmission {
  ledger: SubmissionResult;
  cash: CantonCoinTransfer;
}

export class TavrynInputError extends Error {
  readonly status = 400;
  readonly publicCode = "INVALID_REQUEST";
}

export class TavrynConflictError extends Error {
  readonly status = 409;
  readonly publicCode: string;
  readonly submissionReference?: SubmissionReference;

  constructor(
    message: string,
    publicCode: string,
    submissionReference?: SubmissionReference,
  ) {
    super(message);
    this.name = "TavrynConflictError";
    this.publicCode = publicCode;
    this.submissionReference = submissionReference;
  }
}

export class TavrynSettlementError extends Error {
  readonly status = 502;
  readonly publicCode: string;
  readonly paymentReference?: string;
  readonly pendingFundingCid?: string;

  constructor(
    message: string,
    publicCode: string,
    paymentReference?: string,
    pendingFundingCid?: string,
  ) {
    super(message);
    this.name = "TavrynSettlementError";
    this.publicCode = publicCode;
    this.paymentReference = paymentReference;
    this.pendingFundingCid = pendingFundingCid;
  }
}

export class TavrynService {
  readonly ledger: LedgerApi;
  readonly settlement: CantonCoinSettlement;

  constructor(private readonly config: TavrynConfig) {
    this.ledger = new LedgerApi(config);
    this.settlement = new CantonCoinSettlement(config);
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

  createGovernanceCommittee(
    networkRulesContractId: string,
    threshold: string,
  ): Promise<SubmissionResult> {
    requireContractId(networkRulesContractId, "networkRulesContractId");
    const parsedThreshold = positiveInteger(threshold, "threshold");
    this.assertGovernanceConfigured(parsedThreshold);
    return this.ledger.create(
      GovernanceCommittee,
      {
        governanceParty: this.config.parties.governance,
        operators: this.config.governance.operatorPartyIds,
        threshold: parsedThreshold,
        networkRules: networkRulesContractId,
      },
      [this.config.parties.governance],
    );
  }

  proposeFinancierAdmission(
    committeeContractId: string,
    operatorIndex: string,
    candidatePartyId?: string,
  ): Promise<SubmissionResult> {
    requireContractId(committeeContractId, "committeeContractId");
    const operator = this.governanceOperator(operatorIndex);
    const candidate = candidatePartyId?.trim() || this.config.governance.candidatePartyId;
    if (!candidate) {
      throw new TavrynInputError(
        "A governance candidate party must be configured or supplied",
      );
    }
    return this.ledger.exercise(
      GovernanceCommittee,
      GovernanceCommitteeProposeFinancierAdmission,
      committeeContractId,
      { proposer: operator, candidate },
      [operator],
    );
  }

  confirmFinancierAdmission(
    proposalContractId: string,
    operatorIndex: string,
  ): Promise<SubmissionResult> {
    requireContractId(proposalContractId, "proposalContractId");
    const operator = this.governanceOperator(operatorIndex);
    return this.ledger.exercise(
      FinancierAdmissionProposal,
      FinancierAdmissionProposalConfirm,
      proposalContractId,
      { operator },
      [operator],
    );
  }

  executeFinancierAdmission(
    proposalContractId: string,
    voteContractIds: string[],
  ): Promise<SubmissionResult> {
    requireContractId(proposalContractId, "proposalContractId");
    if (!Array.isArray(voteContractIds) || voteContractIds.length === 0) {
      throw new TavrynInputError("voteContractIds must contain at least one contract ID");
    }
    voteContractIds.forEach((voteContractId, index) =>
      requireContractId(voteContractId, `voteContractIds[${index}]`),
    );
    return this.ledger
      .exercise(
        FinancierAdmissionProposal,
        FinancierAdmissionProposalExecute,
        proposalContractId,
        { votes: voteContractIds },
        [this.config.parties.governance],
      )
      .catch((error) => {
        if (error instanceof LedgerApiError) {
          throw new TavrynConflictError(
            "Governance threshold not met; the financier has not been admitted.",
            "GOVERNANCE_THRESHOLD_NOT_MET",
            error.submissionReference,
          );
        }
        throw error;
      });
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
            error.submissionReference,
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
            error.submissionReference,
          );
        }
        throw error;
      });
  }

  async fundOffer(
    offerContractId: string,
    financierRole: "financierA" | "financierB",
  ): Promise<SettledSubmission> {
    requireContractId(offerContractId, "offerContractId");
    this.settlement.assertConfigured(financierRole);
    const financier = partyForRole(this.config, financierRole);
    const offer = await this.activeContractForRole(
      financierRole,
      offerContractId,
      "FinancingOffer",
    );
    const offerArgument = record(offer.createArgument, "FinancingOffer");
    const amount = decimalField(offerArgument, "advance", "FinancingOffer.advance");

    const pending = await this.ledger
      .exercise(
        Contracts.FinancingOffer,
        FinancingOfferBeginFunding,
        offerContractId,
        {},
        [this.config.parties.buyer, this.config.parties.supplier, financier],
      )
      .catch((error) => {
        if (error instanceof LedgerApiError) {
          throw new TavrynConflictError(
            "This invoice is no longer available for funding.",
            "INVOICE_UNAVAILABLE",
            error.submissionReference,
          );
        }
        throw error;
      });
    const pendingFundingCid = createdContractId(pending, "PendingFunding");

    let cash: CantonCoinTransfer;
    try {
      cash = await this.settlement.transfer(
        financierRole,
        this.config.parties.supplier,
        amount,
        "funding",
      );
    } catch (error) {
      if (error instanceof CantonCoinSettlementError && error.safeToCancel) {
        await this.cancelPendingFundingAfterFailedTransfer(
          pendingFundingCid,
          financier,
        );
      }
      throw error;
    }

    let completed: SubmissionResult;
    try {
      completed = await this.ledger.exercise(
        PendingFunding,
        PendingFundingComplete,
        pendingFundingCid,
        { paymentReference: cash.updateId },
        [this.config.parties.buyer, this.config.parties.supplier, financier],
      );
    } catch (error) {
      throw new TavrynSettlementError(
        "Canton Coin moved, but the ledger could not finalize funding. The PendingFunding contract is retained for reconciliation.",
        "SETTLEMENT_LEDGER_FINALIZATION_FAILED",
        cash.updateId,
        pendingFundingCid,
      );
    }
    return { ledger: completed, cash };
  }

  async cancelPendingFunding(
    pendingFundingCid: string,
    financierRole: "financierA" | "financierB",
  ): Promise<SubmissionResult> {
    requireContractId(pendingFundingCid, "pendingFundingCid");
    const financier = partyForRole(this.config, financierRole);
    return this.ledger.exercise(
      PendingFunding,
      PendingFundingCancel,
      pendingFundingCid,
      {},
      [this.config.parties.buyer, this.config.parties.supplier, financier],
    );
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

  async repayWithSettlement(
    financedContractId: string,
    financierRole: "financierA" | "financierB",
    repaymentDate: string,
  ): Promise<SettledSubmission> {
    requireContractId(financedContractId, "financedContractId");
    validateDate(repaymentDate, "repaymentDate");
    this.settlement.assertConfigured("buyer");
    const financier = partyForRole(this.config, financierRole);
    const financed = await this.activeContractForRole(
      financierRole,
      financedContractId,
      "FinancedInvoice",
    );
    const financedArgument = record(financed.createArgument, "FinancedInvoice");
    const terms = record(financedArgument.terms, "FinancedInvoice.terms");
    const dueDate = stringFieldValue(terms.dueDate, "FinancedInvoice.terms.dueDate");
    if (repaymentDate < dueDate) {
      throw new TavrynInputError("repaymentDate must be on or after the invoice due date");
    }
    const faceValue = decimalField(
      terms,
      "faceValue",
      "FinancedInvoice.terms.faceValue",
    );
    const cash = await this.settlement.transfer(
      "buyer",
      financier,
      faceValue,
      "repayment",
    );
    let ledger: SubmissionResult;
    try {
      ledger = await this.ledger.exercise(
        Contracts.FinancedInvoice,
        Contracts.FinancedInvoice.Repay,
        financedContractId,
        { repaymentDate, paymentReference: cash.updateId },
        [this.config.parties.buyer, financier],
      );
    } catch {
      throw new TavrynSettlementError(
        "Canton Coin moved, but the ledger could not record repayment. The payment reference must be reconciled before retrying.",
        "SETTLEMENT_LEDGER_REPAYMENT_FAILED",
        cash.updateId,
      );
    }
    return { ledger, cash };
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

  private assertGovernanceConfigured(threshold: number): void {
    if (this.config.governance.operatorPartyIds.length < 2) {
      throw new TavrynInputError(
        "At least two governance operator parties must be configured",
      );
    }
    if (threshold > this.config.governance.operatorPartyIds.length) {
      throw new TavrynInputError(
        "Governance threshold cannot exceed the configured operator count",
      );
    }
  }

  private governanceOperator(operatorIndex: string): string {
    const parsedIndex = positiveInteger(operatorIndex, "operatorIndex");
    const operator = this.config.governance.operatorPartyIds[parsedIndex - 1];
    if (!operator) {
      throw new TavrynInputError("operatorIndex is outside the configured operator set");
    }
    return operator;
  }

  private async activeContractForRole(
    role: Role,
    contractId: string,
    templateName: string,
  ): Promise<ActiveContract> {
    const contract = (await this.contractsForRole(role)).find(
      (candidate) =>
        candidate.contractId === contractId && candidate.templateId.includes(templateName),
    );
    if (!contract) {
      throw new TavrynInputError(
        `${templateName} contract is not visible to the selected role or is no longer active`,
      );
    }
    return contract;
  }

  private async cancelPendingFundingAfterFailedTransfer(
    pendingFundingCid: string,
    financier: string,
  ): Promise<void> {
    try {
      await this.ledger.exercise(
        PendingFunding,
        PendingFundingCancel,
        pendingFundingCid,
        {},
        [this.config.parties.buyer, this.config.parties.supplier, financier],
      );
    } catch {
      console.error("PendingFunding cancellation failed after a rejected cash transfer", {
        pendingFundingCid,
      });
    }
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

function positiveInteger(value: string, name: string): number {
  if (!/^\d+$/.test(value)) {
    throw new TavrynInputError(`${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new TavrynInputError(`${name} must be a positive integer`);
  }
  return parsed;
}

function validateDate(value: string, name: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TavrynInputError(`${name} must be YYYY-MM-DD`);
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

function createdContractId(result: SubmissionResult, templateName: string): string {
  const created = result.createdContracts.find((event) =>
    event.templateId.includes(templateName),
  );
  if (!created?.contractId) {
    throw new Error(`Canton did not return a ${templateName} contract`);
  }
  return created.contractId;
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} was not a Daml record`);
  }
  return value as Record<string, unknown>;
}

function decimalField(
  value: Record<string, unknown>,
  field: string,
  name: string,
): string {
  const raw = value[field];
  if (typeof raw === "string" && /^\d+(?:\.\d{1,10})?$/.test(raw)) {
    return raw;
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return String(raw);
  }
  throw new Error(`${name} was not a decimal value`);
}

function stringFieldValue(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} was not a text value`);
  }
  return value;
}
