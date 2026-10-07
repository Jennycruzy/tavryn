// Checks the Pay with Loop rules on the HackCanton DevNet node with real Canton Coin.
// A lender reserves an invoice for one outside wallet, the wallet pays the supplier, and
// Tavryn completes the funding only after finding that payment in the supplier's own view.
// The paying wallet here is the node's own DevNet wallet standing in for a Loop wallet,
// so the run needs no phone. A payment approved in the Loop app follows the same checks.
//   TAVRYN_ENV_FILE=<env> TAVRYN_LOOP_PAYMENT_WINDOW_SECONDS=60 \
//     npx tsx scripts/devnet-loop.ts <evidence.json>
// The env needs TAVRYN_LOOP_NETWORK, TAVRYN_LOOP_PAYERS_FILE, CANTON_COIN_SYMBOL and a
// financierD whose wallet token is "oidc" (the paying wallet).
import { writeFileSync } from "node:fs";

import { assert, contractId, startIntegration, uniqueInvoiceNumber } from "../src/integration-client.js";

const out = process.argv[2];
const lender = "financierA";
const payerRole = "financierD";
const run = await startIntegration();
const { config, post, get } = run;
const currency = config.settlement.cantonCoinSymbol;
assert(currency, "CANTON_COIN_SYMBOL must be configured");
assert(config.loop, "TAVRYN_LOOP_NETWORK must be configured");
assert(config.loop.payersFile, "TAVRYN_LOOP_PAYERS_FILE must be configured, or a restart forgets the wallet");
const payer = config.financiers.get(payerRole);
assert(payer, `${payerRole} must be configured as the paying wallet`);
const advance = "5.0";

async function reservedInvoice(prefix: string) {
  const invoiceNumber = uniqueInvoiceNumber(prefix);
  const draft = await post("/api/v1/invoices/drafts", {
    terms: { externalInvoiceNumber: invoiceNumber, faceValue: "20.00", currency, issuedDate: "2026-10-07", dueDate: "2026-12-31" },
  });
  assert(draft.status === 201, `Draft failed: ${JSON.stringify(draft.body)}`);
  const approved = await post(
    `/api/v1/invoices/drafts/${encodeURIComponent(contractId(draft, "InvoiceDraft"))}/approve`,
    { eligibleFinancierRoles: [lender] },
  );
  assert(approved.status === 200, `Approval failed: ${JSON.stringify(approved.body)}`);
  const offer = await post(
    `/api/v1/invoices/approved/${encodeURIComponent(contractId(approved, "ApprovedInvoice"))}/offers`,
    { financierRole: lender, advance, advanceRate: "0.2500" },
  );
  assert(offer.status === 201, `Offer failed: ${JSON.stringify(offer.body)}`);
  const offerCid = contractId(offer, "FinancingOffer");
  const lock = await post(`/api/v1/offers/${encodeURIComponent(offerCid)}/loop`, {
    financierRole: lender,
    loopParty: payer,
  });
  assert(lock.status === 201, `Reservation failed: ${JSON.stringify(lock.body)}`);
  return { invoiceNumber, offerCid, lock: lock.body };
}

const confirm = (pendingFundingCid: string, updateId?: string) =>
  post(`/api/v1/pending-funding/${encodeURIComponent(pendingFundingCid)}/loop-confirm`, {
    financierRole: lender,
    ...(updateId ? { updateId } : {}),
  });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  await run.service.bootstrapNetwork();
  const network = (await get("/api/v1/network")).body;
  assert(network.loop?.network === config.loop.network, "The network status does not offer Pay with Loop");

  // 1. Reserve, and show nobody else can take the invoice meanwhile.
  const first = await reservedInvoice("TVN-DEVNET-LOOP");
  const again = await post(`/api/v1/offers/${encodeURIComponent(first.offerCid)}/loop`, {
    financierRole: lender,
    loopParty: payer,
  });
  assert(again.status === 409, `A second reservation was not refused: ${JSON.stringify(again.body)}`);

  // 2. Before any payment, the reservation stays pending.
  const early = await confirm(first.lock.pendingFundingCid);
  assert(early.body.outcome === "pending", `Unpaid reservation was not pending: ${JSON.stringify(early.body)}`);

  // 3. The wallet pays the supplier exactly what the reservation asks.
  const cash = await run.service.settlement.transfer(payerRole, config.parties.supplier, first.lock.amount, first.lock.trackingId);

  // 4. A restart forgets nothing: the wallet behind the reservation is on disk.
  await run.restart();

  // 5. Found by searching the supplier's transactions, with no reference given.
  const done = await confirm(first.lock.pendingFundingCid);
  assert(done.body.outcome === "completed", `The payment was not found: ${JSON.stringify(done.body)}`);
  assert(done.body.cashUpdateId === cash.updateId, "The funding points at a different payment");

  // 6. The same payment cannot finance a second invoice.
  const second = await reservedInvoice("TVN-DEVNET-LOOP-REUSE");
  const reused = await confirm(second.lock.pendingFundingCid, cash.updateId);
  assert(reused.body.outcome === "pending", `A used payment was accepted twice: ${JSON.stringify(reused.body)}`);

  // 7. A reservation nobody pays is released after the payment window.
  const windowSeconds = config.loop.paymentWindowSeconds;
  await sleep((windowSeconds + 65) * 1000);
  const lapsed = await confirm(second.lock.pendingFundingCid);
  assert(lapsed.body.outcome === "cancelled", `The unpaid reservation was not released: ${JSON.stringify(lapsed.body)}`);

  const evidence = {
    generatedAt: new Date().toISOString(),
    network: "HackCanton DevNet (hackcanton-01)",
    claim:
      "Pay with Loop rules on DevNet with real Canton Coin: an invoice is reserved for one outside wallet, financed only when the supplier's own view shows that wallet's payment, a payment cannot be used twice, and an unpaid reservation is released.",
    payingWallet: { party: payer, note: "The node's own DevNet wallet standing in for a Loop wallet; same checks as a Loop app payment." },
    lender,
    paymentWindowSeconds: windowSeconds,
    reserved: { invoiceNumber: first.invoiceNumber, ...first.lock },
    secondReservationRefused: { status: again.status, code: again.body.code },
    beforePayment: early.body,
    payment: cash,
    restartedBeforeConfirming: true,
    financed: done.body,
    reuse: { invoiceNumber: second.invoiceNumber, sameUpdateId: cash.updateId, outcome: reused.body },
    unpaidReservationReleased: lapsed.body,
  };
  if (out) writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await run.stop();
}
