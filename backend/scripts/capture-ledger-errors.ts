// Records real Canton error responses as unit-test fixtures (test/fixtures/*.json).
// Each scenario provokes one failure on the configured participant. Only the HTTP
// status and the JSON error body are written; no token is ever read back or stored.
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { Tavryn as TavrynBindings } from "../daml.js/tavryn-network-0.1.5/lib/index.js";
import { loadConfig, partyForRole } from "../src/config.js";
import { LedgerApi, LedgerApiError } from "../src/ledger-api.js";
import { TavrynService, createdContractId } from "../src/tavryn-service.js";

const { Contracts, Governance } = TavrynBindings;
const config = loadConfig();
const service = new TavrynService(config);
const ledger = service.ledger;
const out = new URL("../test/fixtures/", import.meta.url);
await mkdir(out, { recursive: true });

async function record(name: string, attempt: () => Promise<unknown>) {
  try {
    await attempt();
    throw new Error(`${name}: expected a ledger failure`);
  } catch (error) {
    if (!(error instanceof LedgerApiError)) throw error;
    await writeFile(
      new URL(`${name}.json`, out),
      `${JSON.stringify({ status: error.status, body: error.payload }, null, 2)}\n`,
    );
    console.log(`${name}: HTTP ${error.status} ${error.code}`);
  }
}

const network = await service.networkStatus();
const operators = config.governance.operatorPartyIds;
const rulesCid = (network.rules as { contractId: string }).contractId;
const committeeCid = network.committeeCid as string;

// Below-threshold execution.
const proposal = await ledger.exercise(
  Governance.GovernanceCommittee,
  Governance.GovernanceCommittee.Propose,
  committeeCid,
  {
    proposer: operators[0],
    action: { tag: "SetMaxAdvanceRate", value: "0.95" },
    rulesCid,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  },
  [operators[0]],
);
const proposalCid = createdContractId(proposal, "GovernanceProposal");
const vote = await ledger.exercise(
  Governance.GovernanceProposal,
  Governance.GovernanceProposal.Vote,
  proposalCid,
  { operator: operators[0] },
  [operators[0]],
);
await record("threshold-not-met", () =>
  ledger.exercise(
    Governance.GovernanceCommittee,
    Governance.GovernanceCommittee.Execute,
    committeeCid,
    {
      executor: operators[0],
      proposalCid,
      voteCids: [createdContractId(vote, "GovernanceVote")],
      rulesCid,
    },
    [operators[0]],
  ),
);

// Duplicate approval and simultaneous funding of one invoice.
const terms = {
  externalInvoiceNumber: `TVN-FIXTURE-${randomBytes(4).toString("hex").toUpperCase()}`,
  faceValue: "100.00",
  currency: "USD",
  issuedDate: "2026-09-01",
  dueDate: "2026-12-01",
};
const draft = await service.createInvoiceDraft(terms);
const approved = await service.approveInvoice(createdContractId(draft, "InvoiceDraft"), [
  "financierA",
  "financierB",
]);
const approvedCid = createdContractId(approved, "ApprovedInvoice");
const duplicate = await service.createInvoiceDraft(terms);
const registry = (await service.networkStatus()).registry as { contractId: string };
await record("duplicate-invoice", () =>
  ledger.exercise(
    Contracts.InvoiceDraft,
    Contracts.InvoiceDraft.Approve,
    createdContractId(duplicate, "InvoiceDraft"),
    {
      rulesCid,
      registryCid: registry.contractId,
      eligibleFinanciers: [partyForRole(config, "financierA")],
      auditor: config.parties.auditor,
    },
    [config.parties.buyer],
  ),
);

const offers = await Promise.all(
  ["financierA", "financierB"].map(async (role) =>
    createdContractId(
      await service.createOffer(approvedCid, role, "80.00", "0.80"),
      "FinancingOffer",
    ),
  ),
);
const results = await Promise.allSettled(
  ["financierA", "financierB"].map((role, index) =>
    ledger.exercise(
      Contracts.FinancingOffer,
      Contracts.FinancingOffer.Accept,
      offers[index],
      { approvedInvoiceCid: approvedCid, rulesCid, paymentReference: `fixture-${role}` },
      [config.parties.buyer, config.parties.supplier, partyForRole(config, role)],
    ),
  ),
);
const rejected = results.find((result) => result.status === "rejected");
await record("funding-contention", async () => {
  if (rejected) throw rejected.reason;
});

// An invalid token, and a command for a package the participant does not have.
await record("unauthorized", () =>
  new LedgerApi({ ...config, ledgerApiToken: "not-a-valid-token", oidc: undefined }).getLedgerEnd(),
);
await record("unknown-package", () =>
  new LedgerApi({ ...config, packageId: "0".repeat(64) }).exercise(
    Contracts.FinancingOffer,
    Contracts.FinancingOffer.Withdraw,
    offers[0],
    {},
    [config.parties.supplier],
  ),
);
