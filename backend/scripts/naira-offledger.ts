// A naira invoice through Tavryn, as a Nigerian pilot would run it: the cash moves through
// the lenders' and buyer's banks, and Tavryn records each payment reference on the ledger.
// Uses the synthetic Lagos invoice in fixtures/invoices/SYN-003.terms.json; a run suffix
// keeps the invoice number unique, since each number can be approved only once.
// The payment references are synthetic: no bank transfer is made or claimed.
//   TAVRYN_ENV_FILE=<env> npx tsx scripts/naira-offledger.ts <evidence.json>
import { readFileSync, writeFileSync } from "node:fs";

import { assert, contractId, created, startIntegration } from "../src/integration-client.js";

const out = process.argv[2];
const fixture = JSON.parse(
  readFileSync(new URL("../../fixtures/invoices/SYN-003.terms.json", import.meta.url), "utf8"),
);
const run = await startIntegration();
const { post } = run;

try {
  await run.service.bootstrapNetwork();
  const suffix = Date.now().toString(36).toUpperCase();
  const terms = {
    ...fixture.terms,
    externalInvoiceNumber: `${fixture.terms.externalInvoiceNumber}-${suffix}`,
  };
  assert(terms.currency === "NGN", "The fixture must be a naira invoice");

  const draft = await post("/api/v1/invoices/drafts", { terms });
  const approved = await post(
    `/api/v1/invoices/drafts/${encodeURIComponent(contractId(draft, "InvoiceDraft"))}/approve`,
    { eligibleFinancierRoles: ["financierA", "financierB"] },
  );
  assert(approved.status === 200, `Approval failed: ${JSON.stringify(approved.body)}`);
  const approvedCid = contractId(approved, "ApprovedInvoice");
  const advance = (Number(terms.faceValue) * 0.8).toFixed(2);
  // The lender's fee, agreed in the offer (package 0.1.5 and later): 2% of the invoice.
  const fee = (Number(terms.faceValue) * 0.02).toFixed(2);
  const offer = async (financierRole: string) =>
    contractId(
      await post(`/api/v1/invoices/approved/${encodeURIComponent(approvedCid)}/offers`, {
        financierRole,
        advance,
        advanceRate: "0.80",
        fee,
      }),
      "FinancingOffer",
    );
  const offerA = await offer("financierA");
  const offerB = await offer("financierB");

  const fundingReference = `NIP-SYNTHETIC-FUND-${suffix}`;
  const [first, second] = await Promise.all([
    post(`/api/v1/offers/${encodeURIComponent(offerA)}/accept`, {
      financierRole: "financierA",
      paymentReference: fundingReference,
    }),
    post(`/api/v1/offers/${encodeURIComponent(offerB)}/accept`, {
      financierRole: "financierB",
      paymentReference: `NIP-SYNTHETIC-FUND-B-${suffix}`,
    }),
  ]);
  const winner = first.status === 200 ? first : second;
  const loser = first.status === 200 ? second : first;
  assert(winner.status === 200, `Neither lender funded: ${JSON.stringify([first.body, second.body])}`);
  assert(
    loser.status === 409 && loser.body.code === "INVOICE_UNAVAILABLE",
    `The second lender was not refused: ${JSON.stringify(loser.body)}`,
  );
  const financed = created(winner, "FinancedInvoice");
  const fundingReceipt = created(winner, "FundingReceipt");

  const repaymentReference = `NIP-SYNTHETIC-REPAY-${suffix}`;
  const repaid = await post(`/api/v1/financed/${encodeURIComponent(financed.contractId)}/repay`, {
    repaymentDate: terms.dueDate,
    paymentReference: repaymentReference,
  });
  assert(repaid.status === 200, `Repayment failed: ${JSON.stringify(repaid.body)}`);
  const repaymentReceipt = created(repaid, "RepaymentReceipt");
  const balanceDue = created(repaid, "BalanceDue");
  assert(balanceDue, "No balance was created for the supplier");
  const expectedBalance = Number(terms.faceValue) - Number(advance) - Number(fee);
  assert(
    Math.abs(Number(balanceDue.createArgument.balance) - expectedBalance) < 1e-6,
    `Balance ${balanceDue.createArgument.balance} is not ${expectedBalance}`,
  );
  const winnerRole = first.status === 200 ? "financierA" : "financierB";
  const balancePaid = await post(`/api/v1/balances/${encodeURIComponent(balanceDue.contractId)}/pay`, {
    financierRole: winnerRole,
    paymentReference: `NIP-SYNTHETIC-BALANCE-${suffix}`,
  });
  assert(balancePaid.status === 200, `Balance payment failed: ${JSON.stringify(balancePaid.body)}`);
  const balanceReceipt = created(balancePaid, "BalanceReceipt");

  const evidence = {
    date: new Date().toISOString().slice(0, 10),
    environment: run.config.oidc
      ? "HackCanton S3 shared DevNet node hackcanton-01 (NODERS)"
      : "LocalNet on the selected VPS",
    invoice: { source: "fixtures/invoices/SYN-003 (synthetic)", terms },
    funding: {
      advance,
      winner: first.status === 200 ? "financierA" : "financierB",
      updateId: winner.body.updateId,
      receipt: fundingReceipt?.createArgument,
    },
    rival: { status: loser.status, code: loser.body.code, message: loser.body.error },
    repayment: { updateId: repaid.body.updateId, receipt: repaymentReceipt?.createArgument },
    balance: {
      fee,
      due: balanceDue.createArgument,
      paid: { updateId: balancePaid.body.updateId, receipt: balanceReceipt?.createArgument },
    },
    notClaimed: [
      "No naira moved: the payment references are synthetic. In a pilot they would be the banks' NIP transfer references.",
    ],
  };
  console.log(JSON.stringify(evidence, null, 2));
  if (out) writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  await run.stop();
}
