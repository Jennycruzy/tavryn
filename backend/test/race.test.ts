import assert from "node:assert/strict";
import { test } from "node:test";

import { raceCandidates, runRace } from "../src/race.js";
import type { TavrynService } from "../src/tavryn-service.js";

const offer = (cid: string, party: string, commitment: string, number: string, offset: number) => ({
  contractId: cid,
  templateId: "pkg:Tavryn.Contracts:FinancingOffer",
  offset,
  createArgument: {
    financier: party,
    invoiceCommitment: commitment,
    advance: "16200000.0",
    terms: { externalInvoiceNumber: number, faceValue: "20250000.0", currency: "NGN", dueDate: "2026-12-01" },
  },
});

function fakeService(acceptOffer: (cid: string, role: string, reference: string) => Promise<unknown>) {
  return {
    config: {
      financiers: new Map([["financierA", "pa"], ["financierB", "pb"], ["financierC", "pc"]]),
      settlement: { cantonCoinSymbol: "AMT" },
    },
    contractsForRole: async () => [
      offer("o1", "pa", "c1", "INV-1", 10),
      offer("o2", "pb", "c1", "INV-1", 11),
      offer("o3", "pa", "c2", "INV-2", 20),
      { contractId: "x", templateId: "pkg:Tavryn.Contracts:InvoiceDraft", createArgument: {} },
    ],
    acceptOffer,
  } as unknown as TavrynService;
}

test("only invoices offered to two lenders can be raced", async () => {
  const candidates = await raceCandidates(fakeService(async () => ({})));
  assert.deepEqual(candidates.map((candidate) => candidate.invoiceNumber), ["INV-1"]);
  assert.deepEqual(candidates[0].offers.map((entry) => entry.financierRole).sort(), ["financierA", "financierB"]);
});

test("both requests are sent, and Canton's refusal is reported as refused", async () => {
  const events: string[] = [];
  const service = fakeService(async (_cid, role) => {
    events.push(`start:${role}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
    events.push(`end:${role}`);
    if (role === "financierB") {
      throw Object.assign(new Error("This invoice is no longer available for funding."), {
        publicCode: "INVOICE_UNAVAILABLE",
        details: { ledgerErrorCode: "LOCAL_VERDICT_LOCKED_CONTRACTS" },
      });
    }
    return { transaction: { updateId: "u-a" }, createdContracts: [] };
  });
  const { outcomes } = await runRace(service, "INV-1");
  // Both calls began before either finished: they really ran at the same time.
  assert.deepEqual(events.slice(0, 2).map((event) => event.split(":")[0]), ["start", "start"]);
  const byRole = Object.fromEntries(outcomes.map((outcome) => [outcome.financierRole, outcome]));
  assert.equal(byRole.financierA.status, "funded");
  assert.match(String(byRole.financierA.paymentReference), /^RACE-A-/);
  assert.equal(byRole.financierB.status, "refused");
  assert.equal(byRole.financierB.code, "INVOICE_UNAVAILABLE");
  assert.equal(byRole.financierB.rejectedBy, "canton");
  assert.equal(byRole.financierB.cantonCode, "LOCAL_VERDICT_LOCKED_CONTRACTS");
});

test("a request stopped by Tavryn's own ledger read is not credited to Canton", async () => {
  const service = fakeService(async (_cid, role) => {
    if (role === "financierB") {
      throw Object.assign(new Error("gone"), { publicCode: "INVOICE_UNAVAILABLE" });
    }
    return { transaction: { updateId: "u-a" }, createdContracts: [] };
  });
  const { outcomes } = await runRace(service, "INV-1");
  const loser = outcomes.find((outcome) => outcome.financierRole === "financierB");
  assert.equal(loser?.rejectedBy, "ledger-read");
  assert.equal(loser?.cantonCode, undefined);
});

test("any other failure is shown as a failure, not as a refusal", async () => {
  const service = fakeService(async () => {
    throw Object.assign(new Error("ledger down"), { publicCode: "LEDGER_REQUEST_FAILED" });
  });
  const { outcomes } = await runRace(service, "INV-1");
  assert.ok(outcomes.every((outcome) => outcome.status === "failed"));
});

test("an invoice without two open offers cannot be raced", async () => {
  await assert.rejects(runRace(fakeService(async () => ({})), "INV-2"), { publicCode: "RACE_NOT_AVAILABLE" });
});
