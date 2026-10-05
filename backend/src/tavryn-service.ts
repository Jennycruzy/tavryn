import { randomBytes, randomUUID } from "node:crypto";

import { Tavryn as TavrynBindings } from "../daml.js/tavryn-0.1.4/lib/index.js";

import {
  type FinancierRole,
  type Role,
  type TavrynConfig,
  isFinancierRole,
  partyForRole,
  roleForFinancierParty,
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
import { type LedgerErrorContext, mapLedgerError } from "./ledger-errors.js";
import { reconcileDecision } from "./reconcile.js";

const { Contracts, Governance } = TavrynBindings;

export interface InvoiceTermsInput {
  externalInvoiceNumber: string;
  faceValue: string;
  currency: string;
  issuedDate: string;
  dueDate: string;
}

export interface SettledSubmission {
  ledger: SubmissionResult;
  cash: CantonCoinTransfer;
}

export type GovernanceActionInput =
  | { type: "AdmitFinancier" | "RemoveFinancier"; financierRole: string }
  | { type: "SetMaxAdvanceRate"; rate: string };

export interface ReconcileOutcome {
  outcome: "completed" | "cancelled" | "pending" | "already-resolved";
  contractId: string;
  trackingId?: string;
  updateId?: string;
  cashUpdateId?: string;
}

export class TavrynInputError extends Error {
  readonly status = 400;
  readonly publicCode: string;

  constructor(message: string, publicCode = "INVALID_REQUEST") {
    super(message);
    this.name = "TavrynInputError";
    this.publicCode = publicCode;
  }
}

export class TavrynConflictError extends Error {
  readonly status: number;
  readonly publicCode: string;
  readonly submissionReference?: SubmissionReference;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    publicCode: string,
    submissionReference?: SubmissionReference,
    status = 409,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "TavrynConflictError";
    this.publicCode = publicCode;
    this.submissionReference = submissionReference;
    this.status = status;
    this.details = details;
  }
}

export class TavrynSettlementError extends Error {
  readonly status = 502;
  readonly publicCode: string;
  readonly paymentReference?: string;
  readonly pendingContractId?: string;

  constructor(
    message: string,
    publicCode: string,
    paymentReference?: string,
    pendingContractId?: string,
  ) {
    super(message);
    this.name = "TavrynSettlementError";
    this.publicCode = publicCode;
    this.paymentReference = paymentReference;
    this.pendingContractId = pendingContractId;
  }
}

interface CurrentNetwork {
  rules: ActiveContract;
  rulesArgument: Record<string, unknown>;
  committee: ActiveContract;
}

export class TavrynService {
  readonly ledger: LedgerApi;
  readonly settlement: CantonCoinSettlement;

  constructor(readonly config: TavrynConfig) {
    this.ledger = new LedgerApi(config);
    this.settlement = new CantonCoinSettlement(config);
  }

  demoAuthEnabled(): boolean {
    return Boolean(this.config.demoAccessToken);
  }

  issueDemoSession(passphrase: string): string | undefined {
    if (!this.config.demoAccessToken || passphrase !== this.config.demoPassphrase) {
      return undefined;
    }
    return this.config.demoAccessToken;
  }

  demoSessionValue(): string | undefined {
    return this.config.demoAccessToken;
  }

  writeRateLimit(): number {
    return this.config.writeRateLimit;
  }

  ledgerEnd(): Promise<number> {
    return this.ledger.getLedgerEnd();
  }

  contractsForRole(role: Role): Promise<ActiveContract[]> {
    return this.ledger.activeContracts(partyForRole(this.config, role));
  }

  // ---------------------------------------------------------------- network and governance

  /**
   * Idempotent: finds or creates the committee and first rules through the operators'
   * propose/accept chain, then onboards the buyer through a governance vote.
   */
  async bootstrapNetwork(): Promise<Record<string, unknown>> {
    const operators = this.config.governance.operatorPartyIds;
    let network = await this.findNetwork();
    const steps: Record<string, string> = {};
    if (!network) {
      const visible = await this.ledger.activeContracts(operators[0]);
      let bootstrap = visible.find(
        (contract) =>
          isTemplate(contract, "Tavryn.Governance", "CommitteeBootstrap") &&
          record(contract.createArgument).networkId === this.config.networkId &&
          sameParties(record(contract.createArgument).operators, operators),
      );
      let bootstrapCid = bootstrap?.contractId;
      let accepted = bootstrap
        ? (record(bootstrap.createArgument).accepted as string[])
        : [];
      if (!bootstrapCid) {
        const created = await this.ledger.create(
          Governance.CommitteeBootstrap,
          {
            networkId: this.config.networkId,
            operators,
            threshold: String(this.config.governance.threshold),
            accepted: [operators[0]],
            financiers: this.config.governance.initialFinancierRoles.map((role) =>
              partyForRole(this.config, role),
            ),
            participants: [this.config.parties.supplier, this.config.parties.auditor],
            maxAdvanceRate: this.config.governance.initialMaxAdvanceRate,
          },
          [operators[0]],
        );
        bootstrapCid = createdContractId(created, "CommitteeBootstrap");
        accepted = [operators[0]];
        steps.bootstrapCreated = created.transaction.updateId;
      }
      for (const operator of operators) {
        if (accepted.includes(operator)) continue;
        const joined = await this.ledger.exercise(
          Governance.CommitteeBootstrap,
          Governance.CommitteeBootstrap.Join,
          bootstrapCid,
          { operator },
          [operator],
        );
        bootstrapCid = createdContractId(joined, "CommitteeBootstrap");
        accepted.push(operator);
        steps[`joined:${operators.indexOf(operator) + 1}`] = joined.transaction.updateId;
      }
      const last = operators[operators.length - 1];
      const finalized = await this.ledger.exercise(
        Governance.CommitteeBootstrap,
        Governance.CommitteeBootstrap.Finalize,
        bootstrapCid,
        { operator: last },
        [last],
      );
      steps.finalized = finalized.transaction.updateId;
      network = await this.requireNetwork();
    }

    const buyers = network.rulesArgument.buyers as string[];
    if (!buyers.includes(this.config.parties.buyer)) {
      const proposal = await this.propose("1", { type: "OnboardBuyer" });
      const proposalCid = createdContractId(proposal, "GovernanceProposal");
      for (let index = 1; index <= this.config.governance.threshold; index += 1) {
        await this.vote(proposalCid, String(index));
      }
      const executed = await this.execute(proposalCid, "1");
      steps.buyerOnboarded = executed.transaction.updateId;
      network = await this.requireNetwork();
    }

    const registry = await this.findRegistry();
    return {
      networkId: this.config.networkId,
      committeeCid: network.committee.contractId,
      rulesCid: network.rules.contractId,
      rulesVersion: network.rulesArgument.version,
      registryCid: registry?.contractId,
      steps,
    };
  }

  async networkStatus(): Promise<Record<string, unknown>> {
    const operators = this.config.governance.operatorPartyIds;
    const network = await this.findNetwork();
    const operatorView = await this.ledger.activeContracts(operators[0]);
    const registry = network ? await this.findRegistry() : undefined;
    const votes = operatorView.filter((contract) =>
      isTemplate(contract, "Tavryn.Governance", "GovernanceVote"),
    );
    const proposals = operatorView
      .filter(
        (contract) =>
          isTemplate(contract, "Tavryn.Governance", "GovernanceProposal") &&
          record(contract.createArgument).networkId === this.config.networkId,
      )
      .map((proposal) => {
        const argument = record(proposal.createArgument);
        const voters = [
          ...new Set(
            votes
              .filter((vote) => record(vote.createArgument).proposal === proposal.contractId)
              .map((vote) => String(record(vote.createArgument).operator)),
          ),
        ];
        return {
          contractId: proposal.contractId,
          action: this.describeAction(argument.action),
          proposer: this.operatorIndex(String(argument.proposer)),
          rulesVersion: Number(argument.rulesVersion),
          expiresAt: argument.expiresAt,
          stale:
            network !== undefined &&
            Number(argument.rulesVersion) !== Number(network.rulesArgument.version),
          votes: voters.map((voter) => this.operatorIndex(voter)),
          threshold: this.config.governance.threshold,
        };
      });
    const rules = network?.rulesArgument;
    return {
      networkId: this.config.networkId,
      bootstrapped: Boolean(network),
      operators: operators.map((party, index) => ({ index: index + 1, party })),
      threshold: this.config.governance.threshold,
      committeeCid: network?.committee.contractId,
      rules: rules && {
        contractId: network.rules.contractId,
        version: Number(rules.version),
        maxAdvanceRate: rules.maxAdvanceRate,
        financiers: (rules.financiers as string[]).map((party) => ({
          party,
          role: roleForFinancierParty(this.config, party),
        })),
        buyerOnboarded: (rules.buyers as string[]).includes(this.config.parties.buyer),
      },
      registry: registry && {
        contractId: registry.contractId,
        approvedCount: (record(registry.createArgument).approvedInvoiceNumbers as string[])
          .length,
      },
      financierRoles: [...this.config.financiers.entries()].map(([role, party]) => ({
        role,
        party,
      })),
      proposals,
    };
  }

  async propose(
    operatorIndex: string,
    action: GovernanceActionInput | { type: "OnboardBuyer" },
  ): Promise<SubmissionResult> {
    const operator = this.governanceOperator(operatorIndex);
    const network = await this.requireNetwork();
    return this.ledger
      .exercise(
        Governance.GovernanceCommittee,
        Governance.GovernanceCommittee.Propose,
        network.committee.contractId,
        {
          proposer: operator,
          action: this.encodeAction(action),
          rulesCid: network.rules.contractId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        [operator],
      )
      .catch((error) => this.rethrow(error, "governance"));
  }

  async vote(proposalCid: string, operatorIndex: string): Promise<SubmissionResult> {
    requireContractId(proposalCid, "proposalCid");
    const operator = this.governanceOperator(operatorIndex);
    return this.ledger
      .exercise(
        Governance.GovernanceProposal,
        Governance.GovernanceProposal.Vote,
        proposalCid,
        { operator },
        [operator],
      )
      .catch((error) => this.rethrow(error, "governance"));
  }

  /**
   * Submits every vote recorded for the proposal. Below the threshold the ledger itself
   * rejects the change; the failed submission reference is returned to the caller.
   */
  async execute(proposalCid: string, operatorIndex: string): Promise<SubmissionResult> {
    requireContractId(proposalCid, "proposalCid");
    const executor = this.governanceOperator(operatorIndex);
    const network = await this.requireNetwork();
    const votes = (await this.ledger.activeContracts(executor)).filter(
      (contract) =>
        isTemplate(contract, "Tavryn.Governance", "GovernanceVote") &&
        record(contract.createArgument).proposal === proposalCid,
    );
    const distinctVoters = new Set(
      votes.map((vote) => String(record(vote.createArgument).operator)),
    ).size;
    return this.ledger
      .exercise(
        Governance.GovernanceCommittee,
        Governance.GovernanceCommittee.Execute,
        network.committee.contractId,
        {
          executor,
          proposalCid,
          voteCids: votes.map((vote) => vote.contractId),
          rulesCid: network.rules.contractId,
        },
        [executor],
      )
      .catch((error) => {
        const mapped = mapLedgerError(error, "governance");
        if (mapped?.code === "GOVERNANCE_THRESHOLD_NOT_MET") {
          throw new TavrynConflictError(
            `Not enough operator approvals (${distinctVoters} of ${this.config.governance.threshold}). Nothing changed.`,
            mapped.code,
            error instanceof LedgerApiError ? error.submissionReference : undefined,
            409,
            { approvals: distinctVoters, threshold: this.config.governance.threshold },
          );
        }
        return this.rethrow(error, "governance");
      });
  }

  // ---------------------------------------------------------------- invoice lifecycle

  createInvoiceDraft(terms: InvoiceTermsInput): Promise<SubmissionResult> {
    validateTerms(terms);
    return this.ledger.create(
      Contracts.InvoiceDraft,
      {
        supplier: this.config.parties.supplier,
        buyer: this.config.parties.buyer,
        terms,
        // The salt keeps the on-ledger commitment from being guessed from the terms.
        salt: randomBytes(16).toString("hex"),
      },
      [this.config.parties.supplier],
    );
  }

  async approveInvoice(
    draftContractId: string,
    eligibleFinancierRoles?: string[],
  ): Promise<SubmissionResult> {
    requireContractId(draftContractId, "draftContractId");
    const network = await this.requireNetwork();
    const registry = await this.findRegistry();
    if (!registry) {
      throw new TavrynConflictError(
        "The buyer has not been onboarded to this network yet.",
        "BUYER_NOT_ONBOARDED",
      );
    }
    const admitted = network.rulesArgument.financiers as string[];
    let eligibleFinanciers: string[];
    if (eligibleFinancierRoles && eligibleFinancierRoles.length > 0) {
      eligibleFinanciers = eligibleFinancierRoles.map((role) => {
        if (!isFinancierRole(this.config, role)) {
          throw new TavrynInputError(`Unknown financier role: ${role}`);
        }
        return partyForRole(this.config, role);
      });
    } else {
      eligibleFinanciers = [...this.config.financiers.values()].filter((party) =>
        admitted.includes(party),
      );
    }
    return this.ledger
      .exercise(
        Contracts.InvoiceDraft,
        Contracts.InvoiceDraft.Approve,
        draftContractId,
        {
          rulesCid: network.rules.contractId,
          registryCid: registry.contractId,
          eligibleFinanciers,
          auditor: this.config.parties.auditor,
        },
        [this.config.parties.buyer],
      )
      .catch((error) => this.rethrow(error, "approval"));
  }

  async createOffer(
    approvedInvoiceContractId: string,
    financierRole: FinancierRole,
    advance: string,
    advanceRate: string,
  ): Promise<SubmissionResult> {
    requireContractId(approvedInvoiceContractId, "approvedInvoiceContractId");
    assertDecimal(advance, "advance");
    assertDecimal(advanceRate, "advanceRate");
    const financier = this.financierParty(financierRole);
    const network = await this.requireNetwork();
    return this.ledger
      .exercise(
        Contracts.ApprovedInvoice,
        Contracts.ApprovedInvoice.CreateOffer,
        approvedInvoiceContractId,
        { rulesCid: network.rules.contractId, financier, advance, advanceRate },
        [this.config.parties.buyer, this.config.parties.supplier],
      )
      .catch((error) => this.rethrow(error, "other"));
  }

  /** Off-ledger settlement: records an external payment reference. */
  async acceptOffer(
    offerContractId: string,
    financierRole: FinancierRole,
    paymentReference: string,
  ): Promise<SubmissionResult> {
    requireContractId(offerContractId, "offerContractId");
    if (!paymentReference.trim()) {
      throw new TavrynInputError("paymentReference is required");
    }
    const financier = this.financierParty(financierRole);
    const { offer, approved, network } = await this.fundingInputs(financierRole, offerContractId);
    const result = await this.ledger
      .exercise(
        Contracts.FinancingOffer,
        Contracts.FinancingOffer.Accept,
        offerContractId,
        {
          approvedInvoiceCid: approved.contractId,
          rulesCid: network.rules.contractId,
          paymentReference,
        },
        [this.config.parties.buyer, this.config.parties.supplier, financier],
      )
      .catch((error) => this.rethrow(error, "funding"));
    await this.closeLosingOffers(String(record(offer.createArgument).invoiceCommitment));
    return result;
  }

  /** Two-step Canton Coin funding: lock, transfer with the same tracking ID, complete. */
  async fundOffer(
    offerContractId: string,
    financierRole: FinancierRole,
  ): Promise<SettledSubmission> {
    requireContractId(offerContractId, "offerContractId");
    const financier = this.financierParty(financierRole);
    this.settlement.assertConfigured(financierRole);
    const { offer, approved, network } = await this.fundingInputs(financierRole, offerContractId);
    const offerArgument = record(offer.createArgument);
    const terms = record(offerArgument.terms);
    const instrument = this.assertCantonCoinCurrency(terms);
    const amount = decimalString(offerArgument.advance, "FinancingOffer.advance");
    const trackingId = `tavryn-funding-${randomUUID()}`;

    const pending = await this.ledger
      .exercise(
        Contracts.FinancingOffer,
        Contracts.FinancingOffer.BeginFunding,
        offerContractId,
        {
          approvedInvoiceCid: approved.contractId,
          rulesCid: network.rules.contractId,
          trackingId,
          settlementAmount: amount,
          instrument,
        },
        [this.config.parties.buyer, this.config.parties.supplier, financier],
      )
      .catch((error) => this.rethrow(error, "funding"));
    const pendingFundingCid = createdContractId(pending, "PendingFunding");

    let cash: CantonCoinTransfer;
    try {
      cash = await this.settlement.transfer(
        financierRole,
        this.config.parties.supplier,
        amount,
        trackingId,
      );
    } catch (error) {
      if (error instanceof CantonCoinSettlementError && error.safeToCancel) {
        await this.cancelFunding(pendingFundingCid, financier).catch(() => {
          console.error("PendingFunding cancellation failed after a rejected transfer", {
            pendingFundingCid,
          });
        });
      }
      throw error;
    }
    injectFault("TAVRYN_FAULT_AFTER_TRANSFER");

    let completed: SubmissionResult;
    try {
      completed = await this.completeFunding(pendingFundingCid, financier, cash.updateId);
    } catch {
      throw new TavrynSettlementError(
        "Canton Coin moved, but the ledger could not finalize funding yet. The lock is kept and reconciliation will complete it.",
        "SETTLEMENT_LEDGER_FINALIZATION_FAILED",
        cash.updateId,
        pendingFundingCid,
      );
    }
    await this.closeLosingOffers(String(offerArgument.invoiceCommitment));
    return { ledger: completed, cash };
  }

  async reconcileFunding(pendingFundingCid: string): Promise<ReconcileOutcome> {
    requireContractId(pendingFundingCid, "pendingFundingCid");
    const pending = (await this.contractsForRole("supplier")).find(
      (contract) =>
        contract.contractId === pendingFundingCid &&
        isTemplate(contract, "Tavryn.Contracts", "PendingFunding"),
    );
    if (!pending) {
      return { outcome: "already-resolved", contractId: pendingFundingCid };
    }
    const argument = record(pending.createArgument);
    const financier = String(argument.financier);
    const financierRole = roleForFinancierParty(this.config, financier);
    if (!financierRole || !this.settlement.isConfigured(financierRole)) {
      throw new TavrynConflictError(
        "This lock belongs to a financier whose wallet is not configured here; reconcile it manually.",
        "RECONCILIATION_REQUIRED",
      );
    }
    const trackingId = String(argument.trackingId);
    const amount = decimalString(argument.settlementAmount, "PendingFunding.settlementAmount");
    const lockedAt = new Date(String(argument.lockedAt));
    const transfer = await this.settlement.findCompletedTransfer(
      financierRole,
      this.config.parties.supplier,
      amount,
      trackingId,
      new Date(lockedAt.getTime() - 60_000),
    );
    const decision = reconcileDecision({
      transferFound: Boolean(transfer),
      lockedAt,
      now: new Date(),
      transferExpirySeconds: this.config.settlement.transferExpirySeconds,
    });
    if (decision === "complete" && transfer) {
      const completed = await this.completeFunding(pendingFundingCid, financier, transfer.updateId);
      await this.closeLosingOffers(String(argument.invoiceCommitment));
      return {
        outcome: "completed",
        contractId: pendingFundingCid,
        trackingId,
        updateId: completed.transaction.updateId,
        cashUpdateId: transfer.updateId,
      };
    }
    if (decision === "cancel") {
      const cancelled = await this.cancelFunding(pendingFundingCid, financier);
      return {
        outcome: "cancelled",
        contractId: pendingFundingCid,
        trackingId,
        updateId: cancelled.transaction.updateId,
      };
    }
    return { outcome: "pending", contractId: pendingFundingCid, trackingId };
  }

  /** Off-ledger repayment with an external payment reference. */
  async repay(
    financedContractId: string,
    repaymentDate: string,
    paymentReference: string,
  ): Promise<SubmissionResult> {
    requireContractId(financedContractId, "financedContractId");
    validateDate(repaymentDate, "repaymentDate");
    if (!paymentReference.trim()) {
      throw new TavrynInputError("paymentReference is required");
    }
    const financed = await this.activeFinanced(financedContractId);
    return this.ledger
      .exercise(
        Contracts.FinancedInvoice,
        Contracts.FinancedInvoice.Repay,
        financedContractId,
        { repaymentDate, paymentReference },
        [this.config.parties.buyer, String(record(financed.createArgument).financier)],
      )
      .catch((error) => this.rethrow(error, "settlement"));
  }

  /** Two-step Canton Coin repayment. A retry can never send cash twice: the financed
   * invoice is locked before the transfer, and a second attempt finds no invoice to lock. */
  async repayWithSettlement(
    financedContractId: string,
    repaymentDate: string,
  ): Promise<SettledSubmission> {
    requireContractId(financedContractId, "financedContractId");
    validateDate(repaymentDate, "repaymentDate");
    this.settlement.assertConfigured("buyer");
    const financed = await this.activeFinanced(financedContractId);
    const argument = record(financed.createArgument);
    const financier = String(argument.financier);
    const terms = record(argument.terms);
    const instrument = this.assertCantonCoinCurrency(terms);
    const amount = decimalString(terms.faceValue, "FinancedInvoice.terms.faceValue");
    const trackingId = `tavryn-repayment-${randomUUID()}`;

    const pending = await this.ledger
      .exercise(
        Contracts.FinancedInvoice,
        Contracts.FinancedInvoice.BeginRepayment,
        financedContractId,
        { repaymentDate, trackingId, settlementAmount: amount, instrument },
        [this.config.parties.buyer, financier],
      )
      .catch((error) => this.rethrow(error, "settlement"));
    const pendingRepaymentCid = createdContractId(pending, "PendingRepayment");

    let cash: CantonCoinTransfer;
    try {
      cash = await this.settlement.transfer("buyer", financier, amount, trackingId);
    } catch (error) {
      if (error instanceof CantonCoinSettlementError && error.safeToCancel) {
        await this.cancelRepayment(pendingRepaymentCid, financier).catch(() => {
          console.error("PendingRepayment cancellation failed after a rejected transfer", {
            pendingRepaymentCid,
          });
        });
      }
      throw error;
    }
    injectFault("TAVRYN_FAULT_AFTER_REPAYMENT_TRANSFER");

    try {
      const ledger = await this.completeRepayment(pendingRepaymentCid, financier, cash.updateId);
      return { ledger, cash };
    } catch {
      throw new TavrynSettlementError(
        "Canton Coin moved, but the ledger could not record repayment yet. The lock is kept and reconciliation will complete it; do not pay again.",
        "SETTLEMENT_LEDGER_REPAYMENT_FAILED",
        cash.updateId,
        pendingRepaymentCid,
      );
    }
  }

  async reconcileRepayment(pendingRepaymentCid: string): Promise<ReconcileOutcome> {
    requireContractId(pendingRepaymentCid, "pendingRepaymentCid");
    const pending = (await this.contractsForRole("buyer")).find(
      (contract) =>
        contract.contractId === pendingRepaymentCid &&
        isTemplate(contract, "Tavryn.Contracts", "PendingRepayment"),
    );
    if (!pending) {
      return { outcome: "already-resolved", contractId: pendingRepaymentCid };
    }
    if (!this.settlement.isConfigured("buyer")) {
      throw new TavrynConflictError(
        "The buyer wallet is not configured here; reconcile this repayment manually.",
        "RECONCILIATION_REQUIRED",
      );
    }
    const argument = record(pending.createArgument);
    const financier = String(argument.financier);
    const trackingId = String(argument.trackingId);
    const amount = decimalString(argument.settlementAmount, "PendingRepayment.settlementAmount");
    const lockedAt = new Date(String(argument.lockedAt));
    const transfer = await this.settlement.findCompletedTransfer(
      "buyer",
      financier,
      amount,
      trackingId,
      new Date(lockedAt.getTime() - 60_000),
    );
    const decision = reconcileDecision({
      transferFound: Boolean(transfer),
      lockedAt,
      now: new Date(),
      transferExpirySeconds: this.config.settlement.transferExpirySeconds,
    });
    if (decision === "complete" && transfer) {
      const completed = await this.completeRepayment(pendingRepaymentCid, financier, transfer.updateId);
      return {
        outcome: "completed",
        contractId: pendingRepaymentCid,
        trackingId,
        updateId: completed.transaction.updateId,
        cashUpdateId: transfer.updateId,
      };
    }
    if (decision === "cancel") {
      const cancelled = await this.cancelRepayment(pendingRepaymentCid, financier);
      return {
        outcome: "cancelled",
        contractId: pendingRepaymentCid,
        trackingId,
        updateId: cancelled.transaction.updateId,
      };
    }
    return { outcome: "pending", contractId: pendingRepaymentCid, trackingId };
  }

  /** Reconciles every settlement lock older than `minimumAgeMs`. Never sends cash. */
  async sweepSettlementLocks(minimumAgeMs = 30_000): Promise<ReconcileOutcome[]> {
    const cutoff = Date.now() - minimumAgeMs;
    const old = (contract: ActiveContract) =>
      new Date(String(record(contract.createArgument).lockedAt)).getTime() < cutoff;
    const funding = (await this.contractsForRole("supplier")).filter(
      (contract) => isTemplate(contract, "Tavryn.Contracts", "PendingFunding") && old(contract),
    );
    const repayments = (await this.contractsForRole("buyer")).filter(
      (contract) => isTemplate(contract, "Tavryn.Contracts", "PendingRepayment") && old(contract),
    );
    const outcomes: ReconcileOutcome[] = [];
    for (const contract of funding) {
      outcomes.push(
        await this.reconcileFunding(contract.contractId).catch((error) =>
          sweepFailure(contract.contractId, error),
        ),
      );
    }
    for (const contract of repayments) {
      outcomes.push(
        await this.reconcileRepayment(contract.contractId).catch((error) =>
          sweepFailure(contract.contractId, error),
        ),
      );
    }
    return outcomes;
  }

  // ---------------------------------------------------------------- helpers

  private async findNetwork(): Promise<CurrentNetwork | undefined> {
    const operators = this.config.governance.operatorPartyIds;
    const contracts = await this.ledger.activeContracts(operators[0]);
    const matches = (contract: ActiveContract) => {
      const argument = record(contract.createArgument);
      return (
        argument.networkId === this.config.networkId &&
        sameParties(argument.operators, operators)
      );
    };
    const rules = contracts.find(
      (contract) => isTemplate(contract, "Tavryn.Rules", "NetworkRules") && matches(contract),
    );
    const committee = contracts.find(
      (contract) =>
        isTemplate(contract, "Tavryn.Governance", "GovernanceCommittee") && matches(contract),
    );
    if (!rules || !committee) return undefined;
    return { rules, rulesArgument: record(rules.createArgument), committee };
  }

  private async requireNetwork(): Promise<CurrentNetwork> {
    const network = await this.findNetwork();
    if (!network) {
      throw new TavrynConflictError(
        "The network has not been bootstrapped yet. Run `npm run bootstrap`.",
        "NETWORK_NOT_BOOTSTRAPPED",
      );
    }
    return network;
  }

  private async findRegistry(): Promise<ActiveContract | undefined> {
    const operators = this.config.governance.operatorPartyIds;
    return (await this.contractsForRole("buyer")).find((contract) => {
      if (!isTemplate(contract, "Tavryn.Rules", "BuyerApprovalRegistry")) return false;
      const argument = record(contract.createArgument);
      return (
        argument.networkId === this.config.networkId &&
        argument.buyer === this.config.parties.buyer &&
        sameParties(argument.operators, operators)
      );
    });
  }

  // Resolves the offer from the financier's own view, and the approved invoice it is
  // for from the supplier's view. A closed or consumed one means someone else won.
  private async fundingInputs(financierRole: FinancierRole, offerContractId: string) {
    const offer = (await this.contractsForRole(financierRole)).find(
      (contract) =>
        contract.contractId === offerContractId &&
        isTemplate(contract, "Tavryn.Contracts", "FinancingOffer"),
    );
    if (!offer) {
      throw new TavrynConflictError(
        "This invoice is no longer available for funding.",
        "INVOICE_UNAVAILABLE",
      );
    }
    const commitment = record(offer.createArgument).invoiceCommitment;
    const approved = (await this.contractsForRole("supplier")).find(
      (contract) =>
        isTemplate(contract, "Tavryn.Contracts", "ApprovedInvoice") &&
        record(contract.createArgument).invoiceCommitment === commitment,
    );
    if (!approved) {
      throw new TavrynConflictError(
        "This invoice is no longer available for funding.",
        "INVOICE_UNAVAILABLE",
      );
    }
    const network = await this.requireNetwork();
    return { offer, approved, network };
  }

  private async activeFinanced(financedContractId: string): Promise<ActiveContract> {
    const contracts = await this.contractsForRole("buyer");
    const financed = contracts.find(
      (contract) =>
        contract.contractId === financedContractId &&
        isTemplate(contract, "Tavryn.Contracts", "FinancedInvoice"),
    );
    if (financed) return financed;
    throw new TavrynConflictError(
      "This invoice is not awaiting repayment. If a repayment is in progress, reconcile it instead of paying again.",
      "REPAYMENT_NOT_AVAILABLE",
    );
  }

  private completeFunding(cid: string, financier: string, paymentReference: string) {
    return this.ledger.exercise(
      Contracts.PendingFunding,
      Contracts.PendingFunding.Complete,
      cid,
      { paymentReference },
      [this.config.parties.buyer, this.config.parties.supplier, financier],
    );
  }

  private cancelFunding(cid: string, financier: string) {
    return this.ledger.exercise(
      Contracts.PendingFunding,
      Contracts.PendingFunding.Cancel,
      cid,
      {},
      [this.config.parties.buyer, this.config.parties.supplier, financier],
    );
  }

  private completeRepayment(cid: string, financier: string, paymentReference: string) {
    return this.ledger.exercise(
      Contracts.PendingRepayment,
      Contracts.PendingRepayment.CompleteRepayment,
      cid,
      { paymentReference },
      [this.config.parties.buyer, financier],
    );
  }

  private cancelRepayment(cid: string, financier: string) {
    return this.ledger.exercise(
      Contracts.PendingRepayment,
      Contracts.PendingRepayment.CancelRepayment,
      cid,
      {},
      [this.config.parties.buyer, financier],
    );
  }

  // Every remaining offer for a funded invoice is closed. Each financier is left an
  // OfferClosed fact naming only its own offer's invoice, never the winner or terms.
  private async closeLosingOffers(invoiceCommitment: string): Promise<void> {
    try {
      const offers = (await this.contractsForRole("supplier")).filter(
        (contract) =>
          isTemplate(contract, "Tavryn.Contracts", "FinancingOffer") &&
          record(contract.createArgument).invoiceCommitment === invoiceCommitment,
      );
      for (const offer of offers) {
        await this.ledger
          .exercise(
            Contracts.FinancingOffer,
            Contracts.FinancingOffer.Withdraw,
            offer.contractId,
            {},
            [this.config.parties.supplier],
          )
          .catch(() => {
            console.error("Could not close a losing financing offer", {
              offerCid: offer.contractId,
            });
          });
      }
    } catch (error) {
      console.error("Could not list losing financing offers", {
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  private rethrow(error: unknown, context: LedgerErrorContext): never {
    const mapped = mapLedgerError(error, context);
    if (mapped && error instanceof LedgerApiError) {
      // The Canton identifier shows which ledger rule produced the conflict; it carries
      // no payload data.
      throw new TavrynConflictError(
        mapped.message,
        mapped.code,
        error.submissionReference,
        mapped.status,
        error.code ? { ledgerErrorCode: error.code } : undefined,
      );
    }
    throw error;
  }

  private assertCantonCoinCurrency(terms: Record<string, unknown>): string {
    const expected = this.config.settlement.cantonCoinSymbol;
    if (!expected) {
      throw new TavrynInputError(
        "CANTON_COIN_SYMBOL must be configured before Canton Coin settlement is enabled",
        "SETTLEMENT_INSTRUMENT_MISMATCH",
      );
    }
    const currency = String(terms.currency);
    if (currency !== expected) {
      throw new TavrynInputError(
        `Canton Coin settlement requires invoice currency ${expected}; use the off-ledger path for ${currency}`,
        "SETTLEMENT_INSTRUMENT_MISMATCH",
      );
    }
    return currency;
  }

  private financierParty(role: string): string {
    if (!isFinancierRole(this.config, role)) {
      throw new TavrynInputError(`Unknown financier role: ${role}`);
    }
    return partyForRole(this.config, role);
  }

  private governanceOperator(operatorIndex: string): string {
    const parsedIndex = positiveInteger(operatorIndex, "operatorIndex");
    const operator = this.config.governance.operatorPartyIds[parsedIndex - 1];
    if (!operator) {
      throw new TavrynInputError("operatorIndex is outside the configured operator set");
    }
    return operator;
  }

  private operatorIndex(party: string): number | undefined {
    const index = this.config.governance.operatorPartyIds.indexOf(party);
    return index >= 0 ? index + 1 : undefined;
  }

  private encodeAction(
    action: GovernanceActionInput | { type: "OnboardBuyer" },
  ): { tag: string; value: string } {
    switch (action.type) {
      case "AdmitFinancier":
      case "RemoveFinancier":
        return { tag: action.type, value: this.financierParty(action.financierRole) };
      case "SetMaxAdvanceRate":
        assertDecimal(action.rate, "rate");
        return { tag: action.type, value: action.rate };
      case "OnboardBuyer":
        return { tag: action.type, value: this.config.parties.buyer };
      default:
        throw new TavrynInputError("Unknown governance action");
    }
  }

  private describeAction(action: unknown): Record<string, unknown> {
    const value = record(action);
    const tag = String(value.tag);
    const target = String(value.value);
    if (tag === "AdmitFinancier" || tag === "RemoveFinancier") {
      return { type: tag, party: target, financierRole: roleForFinancierParty(this.config, target) };
    }
    if (tag === "SetMaxAdvanceRate") return { type: tag, rate: target };
    return { type: tag, party: target };
  }
}

function injectFault(name: string): void {
  // Test-only crash point between the cash transfer and the ledger completion.
  if (process.env.NODE_ENV === "test" && process.env[name] === "1") {
    throw new TavrynSettlementError(
      `Fault injected by ${name}; the lock is kept for reconciliation.`,
      "SETTLEMENT_FAULT_INJECTED",
    );
  }
}

function sweepFailure(contractId: string, error: unknown): ReconcileOutcome {
  console.error("Settlement reconciliation failed", {
    contractId,
    code: error instanceof TavrynConflictError ? error.publicCode : undefined,
    message: error instanceof Error ? error.message : "unknown error",
  });
  return { outcome: "pending", contractId };
}

export function isTemplate(contract: ActiveContract, module: string, entity: string): boolean {
  return contract.templateId.endsWith(`:${module}:${entity}`);
}

function sameParties(value: unknown, expected: string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((party, index) => party === expected[index])
  );
}

function validateTerms(terms: InvoiceTermsInput): void {
  if (!terms || typeof terms !== "object") {
    throw new TavrynInputError("terms are required");
  }
  if (!terms.externalInvoiceNumber.trim()) {
    throw new TavrynInputError("terms.externalInvoiceNumber is required");
  }
  assertDecimal(terms.faceValue, "terms.faceValue");
  if (!terms.currency.trim()) {
    throw new TavrynInputError("terms.currency is required");
  }
  validateDate(terms.issuedDate, "terms.issuedDate");
  validateDate(terms.dueDate, "terms.dueDate");
  if (terms.dueDate <= terms.issuedDate) {
    throw new TavrynInputError("terms.dueDate must be after terms.issuedDate");
  }
}

function assertDecimal(value: string, name: string): void {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,10})?$/.test(value)) {
    throw new TavrynInputError(`${name} must be a non-negative decimal string`);
  }
}

function positiveInteger(value: string, name: string): number {
  if (!/^\d+$/.test(value) || Number(value) <= 0 || !Number.isSafeInteger(Number(value))) {
    throw new TavrynInputError(`${name} must be a positive integer`);
  }
  return Number(value);
}

function validateDate(value: string, name: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TavrynInputError(`${name} must be YYYY-MM-DD`);
  }
}

function requireContractId(value: string, name: string): void {
  if (typeof value !== "string" || !value.trim()) {
    throw new TavrynInputError(`${name} is required`);
  }
}

export function createdContractId(result: SubmissionResult, entity: string): string {
  const created = result.createdContracts.find((event) =>
    event.templateId.endsWith(`:${entity}`),
  );
  if (!created?.contractId) {
    throw new Error(`Canton did not return a ${entity} contract`);
  }
  return created.contractId;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a Daml record");
  }
  return value as Record<string, unknown>;
}

function decimalString(value: unknown, name: string): string {
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)) return value;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return String(value);
  throw new Error(`${name} was not a decimal value`);
}
