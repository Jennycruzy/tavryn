import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { LedgerTransaction } from "../src/ledger-api.js";
import { LoopPayers, isPartyId, matchLoopPayment } from "../src/loop-payments.js";

// A real DevNet payment: 10 CC from a Loop wallet to the Tavryn supplier, 2026-10-07.
const transaction = (JSON.parse(
  readFileSync(new URL("./fixtures/loop-payment-devnet.json", import.meta.url), "utf8"),
).update.Transaction.value) as LedgerTransaction;

const supplier = "a1f68d5f-tavryn-supplier::12204a9d883d1158141d8f099d06dd2e42cb52615deb42da5a46f042c8d0e1dbdf0e";
const loopWallet = "e2f89af51e83e191da401da72759ad0c::122029f24d8b0f43bb66c069b29b3a1fbc29d3dff5c375c244a61c21433e3cfd641c";
const expected = {
  supplier,
  sender: loopWallet,
  amount: "10",
  trackingId: "tavryn-loop-test",
  lockedAt: new Date("2026-10-07T15:50:00Z"),
};

test("the real Loop payment matches its wallet, amount and supplier", () => {
  const payment = matchLoopPayment(transaction, expected);
  assert.ok(payment);
  assert.equal(payment.updateId, transaction.updateId);
  assert.equal(payment.sender, loopWallet);
  assert.equal(payment.memoMatched, false);
});

test("a different amount does not match", () => {
  assert.equal(matchLoopPayment(transaction, { ...expected, amount: "10.5" }), undefined);
});

test("a payment from another wallet does not match", () => {
  const other = "e2f89af51e83e191da401da72759ad0c::1220" + "0".repeat(64);
  assert.equal(matchLoopPayment(transaction, { ...expected, sender: other }), undefined);
});

test("coins a wallet keeps for itself never count as a payment", () => {
  assert.equal(matchLoopPayment(transaction, { ...expected, supplier: loopWallet, amount: "490" }), undefined);
});

test("a payment made before the invoice was locked does not match", () => {
  assert.equal(
    matchLoopPayment(transaction, { ...expected, lockedAt: new Date("2026-10-07T16:00:00Z") }),
    undefined,
  );
});

test("without a recorded wallet, only a payment carrying the tracking ID counts", () => {
  assert.equal(matchLoopPayment(transaction, { ...expected, sender: undefined }), undefined);
  const withMemo = { ...transaction, events: [...transaction.events, { ExercisedEvent: { choiceArgument: { meta: { values: { memo: "tavryn-loop-test" } } } } }] };
  const payment = matchLoopPayment(withMemo, { ...expected, sender: undefined });
  assert.equal(payment?.sender, loopWallet);
  assert.equal(payment?.memoMatched, true);
});

test("a wallet record survives a restart and a payment is used once", () => {
  const dir = mkdtempSync(join(tmpdir(), "loop-payers-"));
  try {
    const path = join(dir, "payers.json");
    const first = new LoopPayers(path);
    first.recordPayer("tavryn-loop-a", loopWallet);
    first.recordUsed(transaction.updateId, "tavryn-loop-a");
    const second = new LoopPayers(path);
    assert.equal(second.payerFor("tavryn-loop-a"), loopWallet);
    assert.equal(second.usedBy(transaction.updateId), "tavryn-loop-a");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("party IDs are checked before anything is locked", () => {
  assert.equal(isPartyId(loopWallet), true);
  assert.equal(isPartyId(supplier), true);
  assert.equal(isPartyId("not a party"), false);
  assert.equal(isPartyId(`${loopWallet}x`), false);
});
