import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { LedgerApiError } from "../src/ledger-api.js";
import { mapLedgerError } from "../src/ledger-errors.js";

// Response bodies recorded from the VPS participant (see fixtures/README.md).
const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

function errorFrom(name: string): LedgerApiError {
  const recorded = fixture(name);
  return new LedgerApiError(recorded.status, recorded.body, {
    commandId: "tavryn-test",
    submissionId: "test",
  });
}

test("a tagged threshold failure maps to GOVERNANCE_THRESHOLD_NOT_MET", () => {
  assert.equal(mapLedgerError(errorFrom("threshold-not-met"), "governance")?.code, "GOVERNANCE_THRESHOLD_NOT_MET");
});

test("a tagged duplicate approval maps to DUPLICATE_INVOICE", () => {
  assert.equal(mapLedgerError(errorFrom("duplicate-invoice"), "approval")?.code, "DUPLICATE_INVOICE");
});

test("a consumed invoice during funding maps to INVOICE_UNAVAILABLE", () => {
  assert.equal(mapLedgerError(errorFrom("funding-contention"), "funding")?.code, "INVOICE_UNAVAILABLE");
});

test("an authorization failure stays a server error", () => {
  assert.equal(mapLedgerError(errorFrom("unauthorized"), "funding"), undefined);
});

test("a transport failure stays a server error", () => {
  assert.equal(mapLedgerError(new LedgerApiError(0, undefined), "funding"), undefined);
});

test("an unknown package stays a server error", () => {
  assert.equal(mapLedgerError(errorFrom("unknown-package"), "funding"), undefined);
});
