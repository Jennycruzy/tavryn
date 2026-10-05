import {
  assert,
  contractId,
  created,
  startIntegration,
  templates,
  uniqueInvoiceNumber,
} from "./integration-client.js";

// Two-step Canton Coin settlement against the real ledger and wallet. Four cases:
//   1. funding and repayment, with the moved amounts checked against the contracts;
//   2. a crash after the funding transfer, completed after a restart by reconciliation
//      with the same tracking ID;
//   3. a transfer the wallet rejects: the lock is cancelled and the invoice reopens;
//   4. a crash after the repayment transfer: a retry moves no cash, and reconciliation
//      completes the original repayment.
// The fault hooks only run with NODE_ENV=test.
process.env.NODE_ENV = "test";
const run = await startIntegration();
const { config, post, get } = run;
const currency = config.settlement.cantonCoinSymbol;
assert(currency, "CANTON_COIN_SYMBOL must be configured for settlement integration");

async function openInvoice(faceValue: string, advance: string, advanceRate: string) {
  const invoiceNumber = uniqueInvoiceNumber("TVN-CC");
  const draft = await post("/api/v1/invoices/drafts", {
    terms: {
      externalInvoiceNumber: invoiceNumber,
      faceValue,
      currency,
      issuedDate: "2026-09-01",
      dueDate: "2026-12-01",
    },
  });
  const approved = await post(
    `/api/v1/invoices/drafts/${encodeURIComponent(contractId(draft, "InvoiceDraft"))}/approve`,
    { eligibleFinancierRoles: ["financierA", "financierB"] },
  );
  assert(approved.status === 200, `Approval failed: ${JSON.stringify(approved.body)}`);
  const approvedCid = contractId(approved, "ApprovedInvoice");
  const commitment = created(approved, "ApprovedInvoice").createArgument.invoiceCommitment;
  const offer = async (role: string, amount: string, rate: string) =>
    contractId(
      await post(`/api/v1/invoices/approved/${encodeURIComponent(approvedCid)}/offers`, {
        financierRole: role,
        advance: amount,
        advanceRate: rate,
      }),
      "FinancingOffer",
    );
  return {
    invoiceNumber,
    commitment,
    offerA: await offer("financierA", advance, advanceRate),
    offerB: await offer("financierB", advance, advanceRate),
  };
}

function sameAmount(a: unknown, b: string): boolean {
  return Math.abs(Number(a) - Number(b)) < 1e-9;
}

try {
  await run.service.bootstrapNetwork();

  // 1. Happy path.
  const happy = await openInvoice("1.00", "0.90", "0.90");
  const funded = await post(`/api/v1/offers/${encodeURIComponent(happy.offerA)}/fund`, {
    financierRole: "financierA",
  });
  assert(funded.status === 200, `Funding failed: ${JSON.stringify(funded.body)}`);
  const fundingReceipt = created(funded, "FundingReceipt");
  assert(
    sameAmount(funded.body.cashTransfer.amount, "0.90") &&
      sameAmount(fundingReceipt.createArgument.settlementAmount, "0.90") &&
      fundingReceipt.createArgument.trackingId === funded.body.cashTransfer.trackingId,
    "The funding amount or tracking ID does not match the receipt",
  );
  const rival = await post(`/api/v1/offers/${encodeURIComponent(happy.offerB)}/fund`, {
    financierRole: "financierB",
  });
  assert(
    rival.status === 409 && rival.body.code === "INVOICE_UNAVAILABLE",
    `The rival was not rejected: ${JSON.stringify(rival.body)}`,
  );
  const financedCid = contractId(funded, "FinancedInvoice");
  const repaid = await post(`/api/v1/financed/${encodeURIComponent(financedCid)}/settle-repay`, {
    repaymentDate: "2026-10-05",
  });
  assert(repaid.status === 200, `Repayment failed: ${JSON.stringify(repaid.body)}`);
  const repaymentReceipt = created(repaid, "RepaymentReceipt");
  assert(
    sameAmount(repaid.body.cashTransfer.amount, "1.00") &&
      sameAmount(repaymentReceipt.createArgument.amount, "1.00") &&
      repaymentReceipt.createArgument.early === true,
    "The repayment amount does not match the receipt",
  );

  // 2. Crash between the funding transfer and the ledger completion.
  const crash = await openInvoice("1.00", "0.80", "0.80");
  process.env.TAVRYN_FAULT_AFTER_TRANSFER = "1";
  const crashed = await post(`/api/v1/offers/${encodeURIComponent(crash.offerA)}/fund`, {
    financierRole: "financierA",
  });
  delete process.env.TAVRYN_FAULT_AFTER_TRANSFER;
  assert(
    crashed.status === 502 && crashed.body.code === "SETTLEMENT_FAULT_INJECTED",
    `The fault hook did not fire: ${JSON.stringify(crashed.body)}`,
  );
  const lockedView = await get("/api/v1/roles/supplier/contracts");
  const lock = lockedView.body.contracts.find(
    (contract: any) =>
      String(contract.templateId).endsWith(":PendingFunding") &&
      contract.createArgument.terms.externalInvoiceNumber === crash.invoiceNumber,
  );
  assert(lock, "The funding lock was not kept after the crash");
  await run.restart();
  const swept = await run.service.sweepSettlementLocks(0);
  const recovered = swept.find((outcome) => outcome.contractId === lock.contractId);
  assert(
    recovered?.outcome === "completed" && recovered.trackingId === lock.createArgument.trackingId,
    `The sweeper did not complete the crashed funding: ${JSON.stringify(recovered)}`,
  );
  const again = await post(`/api/v1/pending-funding/${encodeURIComponent(lock.contractId)}/reconcile`);
  assert(again.body.outcome === "already-resolved", "Reconcile is not idempotent");

  // 3. A transfer the wallet rejects (more than the financier holds).
  const rejected = await openInvoice("100000000.00", "90000000.00", "0.90");
  const rejection = await post(`/api/v1/offers/${encodeURIComponent(rejected.offerA)}/fund`, {
    financierRole: "financierA",
  });
  assert(rejection.status === 502, `The oversized transfer was not refused: ${JSON.stringify(rejection.body)}`);
  const reopenedView = await get("/api/v1/roles/financierA/contracts");
  const offerRestored = reopenedView.body.contracts.some(
    (contract: any) =>
      String(contract.templateId).endsWith(":FinancingOffer") &&
      contract.createArgument.terms.externalInvoiceNumber === rejected.invoiceNumber,
  );
  const stillLocked = (await get("/api/v1/roles/supplier/contracts")).body.contracts.some(
    (contract: any) =>
      String(contract.templateId).endsWith(":PendingFunding") &&
      contract.createArgument.terms.externalInvoiceNumber === rejected.invoiceNumber,
  );
  assert(offerRestored && !stillLocked, "The rejected transfer did not reopen the invoice");

  // 4. Crash after the repayment transfer, then a retry.
  const retry = await openInvoice("1.00", "0.70", "0.70");
  const retryFunded = await post(`/api/v1/offers/${encodeURIComponent(retry.offerA)}/fund`, {
    financierRole: "financierA",
  });
  assert(retryFunded.status === 200, `Funding failed: ${JSON.stringify(retryFunded.body)}`);
  const retryFinancedCid = contractId(retryFunded, "FinancedInvoice");
  process.env.TAVRYN_FAULT_AFTER_REPAYMENT_TRANSFER = "1";
  const firstRepay = await post(
    `/api/v1/financed/${encodeURIComponent(retryFinancedCid)}/settle-repay`,
    { repaymentDate: "2026-10-05" },
  );
  delete process.env.TAVRYN_FAULT_AFTER_REPAYMENT_TRANSFER;
  assert(firstRepay.status === 502, `The repayment fault hook did not fire: ${JSON.stringify(firstRepay.body)}`);
  const balanceBeforeRetry = await run.service.settlement.unlockedBalance("buyer");
  const secondRepay = await post(
    `/api/v1/financed/${encodeURIComponent(retryFinancedCid)}/settle-repay`,
    { repaymentDate: "2026-10-05" },
  );
  const balanceAfterRetry = await run.service.settlement.unlockedBalance("buyer");
  assert(
    secondRepay.status === 409 && secondRepay.body.code === "REPAYMENT_NOT_AVAILABLE",
    `The retry was not refused: ${JSON.stringify(secondRepay.body)}`,
  );
  assert(
    Math.abs(balanceBeforeRetry - balanceAfterRetry) < 0.5,
    "The retried repayment moved cash",
  );
  const pendingRepayment = (await get("/api/v1/roles/buyer/contracts")).body.contracts.find(
    (contract: any) =>
      String(contract.templateId).endsWith(":PendingRepayment") &&
      contract.createArgument.terms.externalInvoiceNumber === retry.invoiceNumber,
  );
  assert(pendingRepayment, "The repayment lock was not kept");
  const reconciled = await post(
    `/api/v1/pending-repayment/${encodeURIComponent(pendingRepayment.contractId)}/reconcile`,
  );
  assert(
    reconciled.body.outcome === "completed",
    `Reconciliation did not complete the repayment: ${JSON.stringify(reconciled.body)}`,
  );

  const financierBView = await get("/api/v1/roles/financierB/contracts");
  const auditorView = await get("/api/v1/roles/auditor/contracts");
  // Scoped to the invoice B lost in this run; B keeps its own receipts from earlier runs.
  const bViewOfLostInvoice = financierBView.body.contracts.filter(
    (contract: any) => contract.createArgument?.invoiceCommitment === happy.commitment,
  );
  assert(
    bViewOfLostInvoice.every((contract: any) => String(contract.templateId).endsWith(":OfferClosed")),
    "Financier B can see the winning deal or its receipts",
  );

  console.log(
    JSON.stringify(
      {
        packageId: config.packageId,
        currency,
        settlement: "two-step, non-atomic, reconciled by tracking ID",
        happyPath: {
          invoiceNumber: happy.invoiceNumber,
          fundingLedgerUpdateId: funded.body.updateId,
          fundingCashUpdateId: funded.body.cashTransfer.updateId,
          fundingAmount: funded.body.cashTransfer.amount,
          fundingTrackingId: funded.body.cashTransfer.trackingId,
          rivalRejection: {
            status: rival.status,
            code: rival.body.code,
            ledgerErrorCode: rival.body.ledgerErrorCode,
            submissionReference: rival.body.submissionReference,
          },
          repaymentLedgerUpdateId: repaid.body.updateId,
          repaymentCashUpdateId: repaid.body.cashTransfer.updateId,
          repaymentAmount: repaid.body.cashTransfer.amount,
        },
        crashAfterFundingTransfer: {
          invoiceNumber: crash.invoiceNumber,
          trackingId: lock.createArgument.trackingId,
          recovered,
          secondReconcile: again.body.outcome,
        },
        walletRejectedTransfer: {
          invoiceNumber: rejected.invoiceNumber,
          status: rejection.status,
          code: rejection.body.code,
          offerRestored,
          lockRemaining: stillLocked,
        },
        repaymentRetry: {
          invoiceNumber: retry.invoiceNumber,
          firstAttempt: firstRepay.body.code,
          retry: { status: secondRepay.status, code: secondRepay.body.code },
          buyerBalanceChangeDuringRetry: Number((balanceAfterRetry - balanceBeforeRetry).toFixed(10)),
          reconciled: reconciled.body,
        },
        financierBViewOfLostInvoice: bViewOfLostInvoice.map((contract: any) =>
          String(contract.templateId).split(":").slice(1).join(":"),
        ),
        financierBTemplates: [...new Set(templates(financierBView))],
        auditorTemplates: [...new Set(templates(auditorView))],
      },
      null,
      2,
    ),
  );
} finally {
  await run.stop();
}
