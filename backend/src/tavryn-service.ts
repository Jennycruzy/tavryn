import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Tavryn as TavrynBindings } from "../daml.js/tavryn-network-0.1.5/lib/index.js";

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
  DEMO_WALLET,
} from "./canton-coin.js";
import { type LedgerErrorContext, mapLedgerError } from "./ledger-errors.js";
import { reconcileDecision } from "./reconcile.js";
import {
  DEMO_TRACKING_PREFIX,
  LOOP_TRACKING_PREFIX,
  type LoopPayment,
  type LoopPaymentExpectation,
  LoopPayers,
  isPartyId,
  isWalletTrackingId,
  matchLoopPayment,
} from "./loop-payments.js";

type LockKind = "funding" | "repayment";

// The balance has no lock, so its tracking ID is derived from the balance record: a retry
// looks for the same payment instead of paying twice.
function balanceTrackingId(prefix: string, balanceDueContractId: string): string {
  return `${prefix}balance-${createHash("sha256").update(balanceDueContractId).digest("hex").slice(0, 32)}`;
}

const { Contracts, Governance } = TavrynBindings;

// Every template a role view may show. Wallet holdings and other packages are never read.
const PACKAGE_NAME = "tavryn-network";
const ALL_TEMPLATES = [
  "Tavryn.Rules:NetworkRules",
  "Tavryn.Rules:BuyerApprovalRegistry",
  "Tavryn.Governance:CommitteeBootstrap",
  "Tavryn.Governance:GovernanceCommittee",
  "Tavryn.Governance:GovernanceProposal",
  "Tavryn.Governance:GovernanceVote",
  "Tavryn.Contracts:InvoiceDraft",
  "Tavryn.Contracts:InvoiceDetails",
  "Tavryn.Contracts:FundingSlot",
  "Tavryn.Contracts:ApprovedInvoice",
  "Tavryn.Contracts:FinancingOffer",
  "Tavryn.Contracts:OfferClosed",
  "Tavryn.Contracts:PendingFunding",
  "Tavryn.Contracts:FundingReceipt",
  "Tavryn.Contracts:FinancedInvoice",
  "Tavryn.Contracts:PendingRepayment",
  "Tavryn.Contracts:RepaymentReceipt",
  "Tavryn.Contracts:BalanceDue",
  "Tavryn.Contracts:BalanceReceipt",
].map((template) => `#${PACKAGE_NAME}:${template}`);

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
  private readonly loopPayers: LoopPayers;

  constructor(readonly config: TavrynConfig) {
    this.ledger = new LedgerApi(config);
    this.settlement = new CantonCoinSettlement(config);
    this.loopPayers = new LoopPayers(config.loop?.payersFile);
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

  async contractsForRole(role: Role): Promise<ActiveContract[]> {
    const contracts = await this.ledger.activeContracts(partyForRole(this.config, role), ALL_TEMPLATES);
    return contracts.filter((contract) => this.inDemoView(contract));
  }

  // Network rules and governance always show; invoice activity before the demo marker
  // stays on the ledger but is left out of the role views.
  private inDemoView(contract: ActiveContract): boolean {
    const from = this.config.viewFromOffset;
    if (!from || !contract.templateId.includes(":Tavryn.Contracts:")) return true;
    return (contract.offset ?? 0) >= from;
  }

  private contractsOf(roleOrParty: { role: Role } | { party: string }, ...entities: string[]) {
    const party = "role" in roleOrParty ? partyForRole(this.config, roleOrParty.role) : roleOrParty.party;
    return this.ledger.activeContracts(
      party,
      entities.map((entity) => {
        const qualified = ALL_TEMPLATES.find((template) => template.endsWith(`:${entity}`));
        if (!qualified) throw new Error(`Unknown Tavryn template: ${entity}`);
        return qualified;
      }),
    );
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
      const visible = await this.contractsOf({ party: operators[0] }, "CommitteeBootstrap");
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
    const operatorView = await this.contractsOf(
      { party: operators[0] },
      "GovernanceProposal",
      "GovernanceVote",
    );
    const registry = network ? await this.findRegistry() : undefined;
    const votes = operatorView.filter((contract) =>
      isTemplate(contract, "Tavryn.Governance", "GovernanceVote"),
    );
    const from = this.config.viewFromOffset ?? 0;
    const proposals = operatorView
      .filter(
        (contract) =>
          isTemplate(contract, "Tavryn.Governance", "GovernanceProposal") &&
          (contract.offset ?? 0) >= from &&
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
      settlementCurrency: this.config.settlement.cantonCoinSymbol,
      loop: this.config.loop ? { network: this.config.loop.network } : undefined,
      // Lenders whose Canton Coin wallet this server pays from; the rest pay with Loop.
      walletRoles: [...this.config.financiers.keys(), "buyer"].filter(
        (role) => this.settlement.isConfigured(role) || this.usesDemoWallet(role),
      ),
      demoWallet: this.settlement.isConfigured(DEMO_WALLET),
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
    const votes = (await this.contractsOf({ party: executor }, "GovernanceVote")).filter(
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

  async createInvoiceDraft(terms: InvoiceTermsInput): Promise<SubmissionResult> {
    validateTerms(terms);
    const coin = this.config.settlement.cantonCoinSymbol;
    if (!this.config.paymentReferences && terms.currency !== coin) {
      throw new TavrynInputError(
        `Invoices on Tavryn are paid in Canton Coin (${coin ?? "not configured"}).`,
        "CURRENCY_NOT_SUPPORTED",
      );
    }
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
    fee?: string,
  ): Promise<SubmissionResult> {
    requireContractId(approvedInvoiceContractId, "approvedInvoiceContractId");
    assertDecimal(advance, "advance");
    assertDecimal(advanceRate, "advanceRate");
    if (fee !== undefined) assertDecimal(fee, "fee");
    const financier = this.financierParty(financierRole);
    const network = await this.requireNetwork();
    return this.ledger
      .exercise(
        Contracts.ApprovedInvoice,
        Contracts.ApprovedInvoice.CreateOffer,
        approvedInvoiceContractId,
        { rulesCid: network.rules.contractId, financier, advance, advanceRate, fee: fee ?? null },
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
    this.assertPaymentReferencesAllowed();
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
    if (this.usesDemoWallet(financierRole)) return this.fundFromDemoWallet(offerContractId, financierRole);
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
    const pending = (await this.contractsOf({ role: "supplier" }, "PendingFunding")).find(
      (contract) =>
        contract.contractId === pendingFundingCid &&
        isTemplate(contract, "Tavryn.Contracts", "PendingFunding"),
    );
    if (!pending) {
      return { outcome: "already-resolved", contractId: pendingFundingCid };
    }
    const argument = record(pending.createArgument);
    if (isWalletTrackingId(String(argument.trackingId))) {
      return this.reconcileWalletLock("funding", pending);
    }
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

  // ------------------------------------------------------------ wallet payments
  //
  // A company pays from a wallet Tavryn does not hold: the visitor's own Loop wallet, or
  // the demo wallet. Funding and repayment lock the step first (BeginFunding,
  // BeginRepayment); the balance has no lock and uses a tracking ID derived from it. The
  // wallet is recorded against the tracking ID before anything moves, and the step
  // completes only when the receiver's own ledger view shows the coins from that wallet.

  /** Pay with Loop, financing: lock the invoice to this lender and say what to pay. */
  async beginLoopFunding(
    offerContractId: string,
    financierRole: FinancierRole,
    loopParty: string,
  ): Promise<Record<string, unknown>> {
    const loop = this.requireLoop();
    this.assertLoopParty(loopParty);
    const trackingId = `${LOOP_TRACKING_PREFIX}${randomUUID()}`;
    this.loopPayers.recordPayer(trackingId, loopParty);
    const lock = await this.lockFunding(offerContractId, financierRole, trackingId);
    return {
      pendingFundingCid: lock.pendingCid,
      trackingId,
      amount: lock.amount,
      receiver: this.config.parties.supplier,
      network: loop.network,
      payBefore: this.payBefore(),
      updateId: lock.result.transaction.updateId,
    };
  }

  /** Pay with Loop, repayment: lock the financed invoice and say what to pay the lender. */
  async beginLoopRepayment(
    financedContractId: string,
    repaymentDate: string,
    loopParty: string,
  ): Promise<Record<string, unknown>> {
    const loop = this.requireLoop();
    this.assertLoopParty(loopParty);
    const trackingId = `${LOOP_TRACKING_PREFIX}${randomUUID()}`;
    this.loopPayers.recordPayer(trackingId, loopParty);
    const lock = await this.lockRepayment(financedContractId, repaymentDate, trackingId);
    return {
      pendingRepaymentCid: lock.pendingCid,
      trackingId,
      amount: lock.amount,
      receiver: lock.financier,
      network: loop.network,
      payBefore: this.payBefore(),
      updateId: lock.result.transaction.updateId,
    };
  }

  /** Pay with Loop, balance: say what to pay the supplier. Already paid means done. */
  async beginLoopBalance(
    balanceDueContractId: string,
    financierRole: FinancierRole,
    loopParty: string,
  ): Promise<Record<string, unknown>> {
    const loop = this.requireLoop();
    this.assertLoopParty(loopParty);
    const due = await this.activeBalanceDue(balanceDueContractId, financierRole);
    const trackingId = balanceTrackingId(LOOP_TRACKING_PREFIX, balanceDueContractId);
    const earlier = await this.settleWalletBalance(due, trackingId);
    if (earlier) {
      return { outcome: "completed", updateId: earlier.completed.transaction.updateId, cashUpdateId: earlier.payment.updateId };
    }
    this.loopPayers.recordPayer(trackingId, loopParty);
    return {
      balanceDueCid: balanceDueContractId,
      trackingId,
      amount: decimalString(record(due.createArgument).balance, "BalanceDue.balance"),
      receiver: this.config.parties.supplier,
      network: loop.network,
      payBefore: this.payBefore(),
    };
  }

  /** Completes a financing lock once the supplier has the coins. */
  async confirmLoopFunding(
    pendingFundingCid: string,
    financierRole: FinancierRole,
    updateId?: string,
  ): Promise<ReconcileOutcome> {
    requireContractId(pendingFundingCid, "pendingFundingCid");
    const pending = await this.activeLock("funding", pendingFundingCid);
    if (!pending) return { outcome: "already-resolved", contractId: pendingFundingCid };
    if (record(pending.createArgument).financier !== this.financierParty(financierRole)) {
      throw new TavrynConflictError("This payment belongs to another lender.", "FORBIDDEN", undefined, 403);
    }
    return this.reconcileWalletLock("funding", pending, updateId);
  }

  /** Completes a repayment lock once the lender has the coins. */
  async confirmLoopRepayment(pendingRepaymentCid: string, updateId?: string): Promise<ReconcileOutcome> {
    requireContractId(pendingRepaymentCid, "pendingRepaymentCid");
    const pending = await this.activeLock("repayment", pendingRepaymentCid);
    if (!pending) return { outcome: "already-resolved", contractId: pendingRepaymentCid };
    return this.reconcileWalletLock("repayment", pending, updateId);
  }

  /** Records the balance as paid once the supplier has the coins. */
  async confirmLoopBalance(
    balanceDueContractId: string,
    financierRole: FinancierRole,
    updateId?: string,
  ): Promise<ReconcileOutcome> {
    requireContractId(balanceDueContractId, "balanceDueContractId");
    const due = (await this.contractsOf({ role: financierRole }, "BalanceDue")).find(
      (contract) =>
        contract.contractId === balanceDueContractId && isTemplate(contract, "Tavryn.Contracts", "BalanceDue"),
    );
    if (!due) return { outcome: "already-resolved", contractId: balanceDueContractId };
    if (record(due.createArgument).financier !== this.financierParty(financierRole)) {
      throw new TavrynConflictError("This balance belongs to another lender.", "FORBIDDEN", undefined, 403);
    }
    const trackingId = balanceTrackingId(LOOP_TRACKING_PREFIX, balanceDueContractId);
    const done = await this.settleWalletBalance(due, trackingId, updateId);
    return done
      ? { outcome: "completed", contractId: balanceDueContractId, trackingId, updateId: done.completed.transaction.updateId, cashUpdateId: done.payment.updateId }
      : { outcome: "pending", contractId: balanceDueContractId, trackingId };
  }

  // The demo wallet pays for a visitor without a wallet: lock, pay, then the same ledger
  // check as a Loop payment. A rejected transfer releases the lock at once.
  private async fundFromDemoWallet(offerContractId: string, financierRole: FinancierRole): Promise<SettledSubmission> {
    const trackingId = `${DEMO_TRACKING_PREFIX}${randomUUID()}`;
    this.loopPayers.recordPayer(trackingId, this.config.demoWallet as string);
    const lock = await this.lockFunding(offerContractId, financierRole, trackingId);
    const cash = await this.payFromDemoWallet(this.config.parties.supplier, lock.amount, trackingId, () =>
      this.cancelFunding(lock.pendingCid, lock.financier),
    );
    return this.finishDemoLock("funding", lock.pendingCid, cash);
  }

  private async repayFromDemoWallet(financedContractId: string, repaymentDate: string): Promise<SettledSubmission> {
    const trackingId = `${DEMO_TRACKING_PREFIX}${randomUUID()}`;
    this.loopPayers.recordPayer(trackingId, this.config.demoWallet as string);
    const lock = await this.lockRepayment(financedContractId, repaymentDate, trackingId);
    const cash = await this.payFromDemoWallet(lock.financier, lock.amount, trackingId, () =>
      this.cancelRepayment(lock.pendingCid, lock.financier),
    );
    return this.finishDemoLock("repayment", lock.pendingCid, cash);
  }

  private async payBalanceFromDemoWallet(balanceDueContractId: string, financierRole: FinancierRole): Promise<SettledSubmission> {
    const due = await this.activeBalanceDue(balanceDueContractId, financierRole);
    const trackingId = balanceTrackingId(DEMO_TRACKING_PREFIX, balanceDueContractId);
    this.loopPayers.recordPayer(trackingId, this.config.demoWallet as string);
    // A retry finds the earlier payment instead of paying twice.
    const earlier = await this.settleWalletBalance(due, trackingId);
    if (earlier) return { ledger: earlier.completed, cash: this.demoTransfer(earlier.payment, trackingId) };
    const amount = decimalString(record(due.createArgument).balance, "BalanceDue.balance");
    const cash = await this.payFromDemoWallet(this.config.parties.supplier, amount, trackingId);
    const done = await this.settleWalletBalance(due, trackingId, cash.updateId);
    if (!done) {
      throw new TavrynSettlementError(
        "The coins moved, but the ledger could not record the balance yet. Try again: the same payment will be found and not repeated.",
        "SETTLEMENT_LEDGER_BALANCE_FAILED",
        cash.updateId,
        balanceDueContractId,
      );
    }
    return { ledger: done.completed, cash };
  }

  private async payFromDemoWallet(
    receiver: string,
    amount: string,
    trackingId: string,
    releaseLock?: () => Promise<unknown>,
  ): Promise<CantonCoinTransfer> {
    try {
      return await this.settlement.transfer(DEMO_WALLET, receiver, amount, trackingId);
    } catch (error) {
      if (releaseLock && error instanceof CantonCoinSettlementError && error.safeToCancel) {
        await releaseLock().catch(() => console.error("Lock release failed after a rejected demo payment", { trackingId }));
      }
      throw error;
    }
  }

  private async finishDemoLock(kind: LockKind, pendingCid: string, cash: CantonCoinTransfer): Promise<SettledSubmission> {
    const pending = await this.activeLock(kind, pendingCid);
    const done = pending && (await this.completeWalletLock(kind, pending, cash.updateId));
    if (!done) {
      throw new TavrynSettlementError(
        "The coins moved, but the ledger could not record it yet. It will be completed automatically; do not pay again.",
        kind === "funding" ? "SETTLEMENT_LEDGER_FINALIZATION_FAILED" : "SETTLEMENT_LEDGER_REPAYMENT_FAILED",
        cash.updateId,
        pendingCid,
      );
    }
    return { ledger: done.completed, cash };
  }

  private demoTransfer(payment: LoopPayment, trackingId: string): CantonCoinTransfer {
    return {
      updateId: payment.updateId,
      eventId: "",
      trackingId,
      description: `Tavryn ${trackingId}`,
      amount: payment.amount,
      sender: payment.sender,
      receiver: this.config.parties.supplier,
    };
  }

  private async lockFunding(offerContractId: string, financierRole: FinancierRole, trackingId: string) {
    requireContractId(offerContractId, "offerContractId");
    const financier = this.financierParty(financierRole);
    const { offer, approved, network } = await this.fundingInputs(financierRole, offerContractId);
    const offerArgument = record(offer.createArgument);
    const instrument = this.assertCantonCoinCurrency(record(offerArgument.terms));
    const amount = decimalString(offerArgument.advance, "FinancingOffer.advance");
    const result = await this.ledger
      .exercise(
        Contracts.FinancingOffer,
        Contracts.FinancingOffer.BeginFunding,
        offerContractId,
        { approvedInvoiceCid: approved.contractId, rulesCid: network.rules.contractId, trackingId, settlementAmount: amount, instrument },
        [this.config.parties.buyer, this.config.parties.supplier, financier],
      )
      .catch((error) => this.rethrow(error, "funding"));
    return { pendingCid: createdContractId(result, "PendingFunding"), amount, financier, result };
  }

  private async lockRepayment(financedContractId: string, repaymentDate: string, trackingId: string) {
    requireContractId(financedContractId, "financedContractId");
    validateDate(repaymentDate, "repaymentDate");
    const financed = await this.activeFinanced(financedContractId);
    const argument = record(financed.createArgument);
    const financier = String(argument.financier);
    const terms = record(argument.terms);
    const instrument = this.assertCantonCoinCurrency(terms);
    const amount = decimalString(terms.faceValue, "FinancedInvoice.terms.faceValue");
    const result = await this.ledger
      .exercise(
        Contracts.FinancedInvoice,
        Contracts.FinancedInvoice.BeginRepayment,
        financedContractId,
        { repaymentDate, trackingId, settlementAmount: amount, instrument },
        [this.config.parties.buyer, financier],
      )
      .catch((error) => this.rethrow(error, "settlement"));
    return { pendingCid: createdContractId(result, "PendingRepayment"), amount, financier, result };
  }

  private async activeLock(kind: LockKind, cid: string): Promise<ActiveContract | undefined> {
    const template = kind === "funding" ? "PendingFunding" : "PendingRepayment";
    const viewer = kind === "funding" ? "supplier" : "buyer";
    return (await this.contractsOf({ role: viewer }, template)).find(
      (contract) => contract.contractId === cid && isTemplate(contract, "Tavryn.Contracts", template),
    );
  }

  private async reconcileWalletLock(kind: LockKind, pending: ActiveContract, updateId?: string): Promise<ReconcileOutcome> {
    const argument = record(pending.createArgument);
    const trackingId = String(argument.trackingId);
    const done = await this.completeWalletLock(kind, pending, updateId);
    if (done) {
      return {
        outcome: "completed",
        contractId: pending.contractId,
        trackingId,
        updateId: done.completed.transaction.updateId,
        cashUpdateId: done.payment.updateId,
      };
    }
    const decision = reconcileDecision({
      transferFound: false,
      lockedAt: new Date(String(argument.lockedAt)),
      now: new Date(),
      transferExpirySeconds: this.config.loop?.paymentWindowSeconds ?? 900,
    });
    if (decision === "cancel") {
      const financier = String(argument.financier);
      const cancelled = kind === "funding"
        ? await this.cancelFunding(pending.contractId, financier)
        : await this.cancelRepayment(pending.contractId, financier);
      return { outcome: "cancelled", contractId: pending.contractId, trackingId, updateId: cancelled.transaction.updateId };
    }
    return { outcome: "pending", contractId: pending.contractId, trackingId };
  }

  private async completeWalletLock(kind: LockKind, pending: ActiveContract, updateId?: string) {
    const argument = record(pending.createArgument);
    const financier = String(argument.financier);
    const trackingId = String(argument.trackingId);
    const payment = await this.findLoopPayment(
      {
        receiver: kind === "funding" ? this.config.parties.supplier : financier,
        sender: this.loopPayers.payerFor(trackingId),
        amount: decimalString(argument.settlementAmount, `${kind} settlementAmount`),
        trackingId,
        lockedAt: new Date(String(argument.lockedAt)),
        notBeforeOffset: pending.offset,
      },
      pending.offset ?? 0,
      updateId,
    );
    if (!payment) return undefined;
    this.loopPayers.recordUsed(payment.updateId, trackingId);
    const completed = kind === "funding"
      ? await this.completeFunding(pending.contractId, financier, payment.updateId)
      : await this.completeRepayment(pending.contractId, financier, payment.updateId);
    if (kind === "funding") await this.closeLosingOffers(String(argument.invoiceCommitment));
    return { payment, completed };
  }

  private async settleWalletBalance(due: ActiveContract, trackingId: string, updateId?: string) {
    const argument = record(due.createArgument);
    const instrument = this.assertCantonCoinCurrency({ currency: argument.currency });
    const sender = this.loopPayers.payerFor(trackingId);
    if (!sender) return undefined;
    const payment = await this.findLoopPayment(
      {
        receiver: this.config.parties.supplier,
        sender,
        amount: decimalString(argument.balance, "BalanceDue.balance"),
        trackingId,
        notBeforeOffset: due.offset,
      },
      due.offset ?? 0,
      updateId,
    );
    if (!payment) return undefined;
    this.loopPayers.recordUsed(payment.updateId, trackingId);
    const completed = await this.ledger.exercise(
      Contracts.BalanceDue,
      Contracts.BalanceDue.PayBalance,
      due.contractId,
      { paymentReference: payment.updateId, instrument, trackingId },
      [String(argument.financier)],
    );
    return { payment, completed };
  }

  // Checks the transaction the wallet reported first, then the receiver's transactions
  // since the step began. A payment already used for another step never counts.
  private async findLoopPayment(
    expected: LoopPaymentExpectation,
    fromOffset: number,
    updateId?: string,
  ): Promise<LoopPayment | undefined> {
    const unused = (payment: LoopPayment | undefined) => {
      const usedBy = payment && this.loopPayers.usedBy(payment.updateId);
      return payment && (!usedBy || usedBy === expected.trackingId) ? payment : undefined;
    };
    if (updateId && /^[0-9a-f]{20,200}$/.test(updateId)) {
      const transaction = await this.ledger.transactionById(expected.receiver, updateId);
      const payment = transaction && unused(matchLoopPayment(transaction, expected));
      if (payment) return payment;
    }
    let from = Math.max(0, fromOffset - 1);
    for (let page = 0; page < 20; page += 1) {
      const transactions = await this.ledger.transactionsSince(expected.receiver, from, 100);
      for (const transaction of transactions) {
        const payment = unused(matchLoopPayment(transaction, expected));
        if (payment) return payment;
      }
      if (transactions.length < 100) return undefined;
      from = Number(transactions.at(-1)?.offset);
    }
    return undefined;
  }

  private assertLoopParty(loopParty: string): void {
    if (!isPartyId(loopParty)) {
      throw new TavrynInputError("That is not a Loop wallet address.", "LOOP_PARTY_INVALID");
    }
  }

  private payBefore(): string {
    return new Date(Date.now() + (this.config.loop?.paymentWindowSeconds ?? 900) * 1000).toISOString();
  }

  // The demo wallet pays for a company whose own wallet this server does not hold.
  private usesDemoWallet(role: string): boolean {
    return !this.settlement.isConfigured(role) && this.settlement.isConfigured(DEMO_WALLET);
  }

  // Every real payment is Canton Coin checked on the network; a typed reference could be
  // made up, so it is refused unless a test harness turned it on.
  private assertPaymentReferencesAllowed(): void {
    if (!this.config.paymentReferences) {
      throw new TavrynInputError(
        "Payments on Tavryn are made in Canton Coin on the network. Typed payment references are not accepted.",
        "PAYMENT_REFERENCES_DISABLED",
      );
    }
  }

  private requireLoop() {
    if (!this.config.loop) {
      throw new TavrynInputError("Pay with Loop is not available on this network.", "LOOP_NOT_AVAILABLE");
    }
    return this.config.loop;
  }

  /** Off-ledger repayment with an external payment reference. */
  async repay(
    financedContractId: string,
    repaymentDate: string,
    paymentReference: string,
  ): Promise<SubmissionResult> {
    this.assertPaymentReferencesAllowed();
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
    if (this.usesDemoWallet("buyer")) return this.repayFromDemoWallet(financedContractId, repaymentDate);
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

  /** The financier records paying the supplier's balance by bank transfer. */
  async payBalance(
    balanceDueContractId: string,
    financierRole: FinancierRole,
    paymentReference: string,
  ): Promise<SubmissionResult> {
    this.assertPaymentReferencesAllowed();
    requireContractId(balanceDueContractId, "balanceDueContractId");
    if (!paymentReference.trim()) {
      throw new TavrynInputError("paymentReference is required");
    }
    const financier = this.financierParty(financierRole);
    await this.activeBalanceDue(balanceDueContractId, financierRole);
    return this.ledger
      .exercise(
        Contracts.BalanceDue,
        Contracts.BalanceDue.PayBalance,
        balanceDueContractId,
        { paymentReference, instrument: "OFF_LEDGER", trackingId: "" },
        [financier],
      )
      .catch((error) => this.rethrow(error, "settlement"));
  }

  /**
   * The financier pays the supplier's balance in Canton Coin. The tracking ID is derived
   * from the balance record, so a retry finds the earlier transfer instead of paying twice.
   */
  async settleBalance(balanceDueContractId: string, financierRole: FinancierRole): Promise<SettledSubmission> {
    requireContractId(balanceDueContractId, "balanceDueContractId");
    if (this.usesDemoWallet(financierRole)) return this.payBalanceFromDemoWallet(balanceDueContractId, financierRole);
    const financier = this.financierParty(financierRole);
    this.settlement.assertConfigured(financierRole);
    const due = await this.activeBalanceDue(balanceDueContractId, financierRole);
    const argument = record(due.createArgument);
    const instrument = this.assertCantonCoinCurrency({ currency: argument.currency });
    const amount = decimalString(argument.balance, "BalanceDue.balance");
    const supplier = this.config.parties.supplier;
    const trackingId = `tavryn-balance-${createHash("sha256").update(balanceDueContractId).digest("hex").slice(0, 32)}`;
    const cash =
      (await this.settlement.findCompletedTransfer(
        financierRole,
        supplier,
        amount,
        trackingId,
        new Date(Date.now() - 7 * 86_400_000),
      )) ?? (await this.settlement.transfer(financierRole, supplier, amount, trackingId));
    try {
      const ledger = await this.ledger.exercise(
        Contracts.BalanceDue,
        Contracts.BalanceDue.PayBalance,
        balanceDueContractId,
        { paymentReference: cash.updateId, instrument, trackingId },
        [financier],
      );
      return { ledger, cash };
    } catch {
      throw new TavrynSettlementError(
        "Canton Coin moved, but the ledger could not record the balance yet. Try again: the same transfer will be found and not repeated.",
        "SETTLEMENT_LEDGER_BALANCE_FAILED",
        cash.updateId,
        balanceDueContractId,
      );
    }
  }

  private async activeBalanceDue(balanceDueContractId: string, financierRole: FinancierRole): Promise<ActiveContract> {
    const due = (await this.contractsOf({ role: financierRole }, "BalanceDue")).find(
      (contract) =>
        contract.contractId === balanceDueContractId && isTemplate(contract, "Tavryn.Contracts", "BalanceDue"),
    );
    if (due && record(due.createArgument).financier === this.financierParty(financierRole)) return due;
    throw new TavrynConflictError(
      "This balance is not waiting to be paid by you. It may already be paid.",
      "BALANCE_NOT_AVAILABLE",
    );
  }

  async reconcileRepayment(pendingRepaymentCid: string): Promise<ReconcileOutcome> {
    requireContractId(pendingRepaymentCid, "pendingRepaymentCid");
    const pending = (await this.contractsOf({ role: "buyer" }, "PendingRepayment")).find(
      (contract) =>
        contract.contractId === pendingRepaymentCid &&
        isTemplate(contract, "Tavryn.Contracts", "PendingRepayment"),
    );
    if (!pending) {
      return { outcome: "already-resolved", contractId: pendingRepaymentCid };
    }
    if (isWalletTrackingId(String(record(pending.createArgument).trackingId))) {
      return this.reconcileWalletLock("repayment", pending);
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
    const funding = (await this.contractsOf({ role: "supplier" }, "PendingFunding")).filter(
      (contract) => isTemplate(contract, "Tavryn.Contracts", "PendingFunding") && old(contract),
    );
    const repayments = (await this.contractsOf({ role: "buyer" }, "PendingRepayment")).filter(
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
    const contracts = await this.contractsOf(
      { party: operators[0] },
      "NetworkRules",
      "GovernanceCommittee",
    );
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
    return (await this.contractsOf({ role: "buyer" }, "BuyerApprovalRegistry")).find((contract) => {
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
    const offer = (await this.contractsOf({ role: financierRole }, "FinancingOffer")).find(
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
    const approved = (await this.contractsOf({ role: "supplier" }, "ApprovedInvoice")).find(
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
    const contracts = await this.contractsOf({ role: "buyer" }, "FinancedInvoice");
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
      const offers = (await this.contractsOf({ role: "supplier" }, "FinancingOffer")).filter(
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
