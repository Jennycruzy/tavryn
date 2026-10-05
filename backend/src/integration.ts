import {
  assert,
  contractId,
  hasTemplate,
  startIntegration,
  templates,
  uniqueInvoiceNumber,
} from "./integration-client.js";

// Core lifecycle over HTTP against the real ledger: approve once, two private offers,
// both financiers fund at the same moment, exactly one wins, the loser sees nothing of
// the winning deal, repayment, and a refused duplicate approval.
const run = await startIntegration();
const { config, post, get } = run;
const invoiceNumber = uniqueInvoiceNumber("TVN");

try {
  const bootstrap = await run.service.bootstrapNetwork();
  const terms = {
    externalInvoiceNumber: invoiceNumber,
    faceValue: "100.00",
    currency: "USD",
    issuedDate: "2026-09-01",
    dueDate: "2026-12-01",
  };
  const draft = await post("/api/v1/invoices/drafts", { terms });
  const approved = await post(
    `/api/v1/invoices/drafts/${encodeURIComponent(contractId(draft, "InvoiceDraft"))}/approve`,
    { eligibleFinancierRoles: ["financierA", "financierB"] },
  );
  assert(approved.status === 200, `Approval failed: ${JSON.stringify(approved.body)}`);
  const approvedCid = contractId(approved, "ApprovedInvoice");
  const offerA = await post(`/api/v1/invoices/approved/${encodeURIComponent(approvedCid)}/offers`, {
    financierRole: "financierA",
    advance: "90.00",
    advanceRate: "0.90",
  });
  const offerB = await post(`/api/v1/invoices/approved/${encodeURIComponent(approvedCid)}/offers`, {
    financierRole: "financierB",
    advance: "88.00",
    advanceRate: "0.88",
  });
  const offers = {
    financierA: contractId(offerA, "FinancingOffer"),
    financierB: contractId(offerB, "FinancingOffer"),
  };

  // Both financiers fund at the same moment. The ledger decides.
  const [resultA, resultB] = await Promise.all(
    (["financierA", "financierB"] as const).map((role) =>
      post(`/api/v1/offers/${encodeURIComponent(offers[role])}/accept`, {
        financierRole: role,
        paymentReference: `bank-${role}-${invoiceNumber}`,
      }),
    ),
  );
  const winnerRole = resultA.status === 200 ? "financierA" : "financierB";
  const loserRole = winnerRole === "financierA" ? "financierB" : "financierA";
  const winner = winnerRole === "financierA" ? resultA : resultB;
  const loser = winnerRole === "financierA" ? resultB : resultA;
  assert(winner.status === 200, `Neither financier funded: ${JSON.stringify([resultA.body, resultB.body])}`);
  assert(
    loser.status === 409 && loser.body.code === "INVOICE_UNAVAILABLE",
    `The second financier was not rejected as unavailable: ${JSON.stringify(loser.body)}`,
  );

  const financedCid = contractId(winner, "FinancedInvoice");
  const repaid = await post(`/api/v1/financed/${encodeURIComponent(financedCid)}/repay`, {
    repaymentDate: "2026-10-05",
    paymentReference: `bank-repay-${invoiceNumber}`,
  });
  assert(repaid.status === 200, `Repayment failed: ${JSON.stringify(repaid.body)}`);

  const duplicateDraft = await post("/api/v1/invoices/drafts", { terms });
  const duplicate = await post(
    `/api/v1/invoices/drafts/${encodeURIComponent(contractId(duplicateDraft, "InvoiceDraft"))}/approve`,
    {},
  );
  assert(
    duplicate.status === 409 && duplicate.body.code === "DUPLICATE_INVOICE",
    `Duplicate approval was not refused: ${JSON.stringify(duplicate.body)}`,
  );

  const loserView = await get(`/api/v1/roles/${loserRole}/contracts`);
  const auditorView = await get("/api/v1/roles/auditor/contracts");
  const loserContracts: any[] = loserView.body.contracts;
  const closed = loserContracts.find(
    (contract) =>
      String(contract.templateId).endsWith(":OfferClosed") &&
      contract.createArgument.financier === config.financiers.get(loserRole),
  );
  assert(closed, "The losing financier has no OfferClosed fact");
  assert(
    Object.keys(closed.createArgument).sort().join(",") ===
      "buyer,financier,invoiceCommitment,supplier",
    "OfferClosed carries more than the losing financier's own facts",
  );
  assert(
    !hasTemplate(loserView, "FinancedInvoice") &&
      !hasTemplate(loserView, "FundingReceipt") &&
      !hasTemplate(loserView, "InvoiceDetails") &&
      !loserContracts.some(
        (contract) =>
          String(contract.templateId).endsWith(":FinancingOffer") &&
          contract.createArgument.financier !== config.financiers.get(loserRole),
      ),
    "The losing financier can see the winning deal",
  );
  assert(
    hasTemplate(auditorView, "FundingReceipt") && hasTemplate(auditorView, "RepaymentReceipt"),
    "The auditor cannot see the complete trail",
  );

  console.log(
    JSON.stringify(
      {
        invoiceNumber,
        packageId: config.packageId,
        networkId: config.networkId,
        rulesCid: bootstrap.rulesCid,
        simultaneousFunding: {
          winner: winnerRole,
          winnerUpdateId: winner.body.updateId,
          loser: loserRole,
          loserStatus: loser.status,
          loserCode: loser.body.code,
          loserLedgerErrorCode: loser.body.ledgerErrorCode,
          loserSubmissionReference: loser.body.submissionReference,
        },
        repayment: { updateId: repaid.body.updateId },
        duplicateApproval: { status: duplicate.status, code: duplicate.body.code },
        loserVisibleTemplates: templates(loserView),
        auditorVisibleTemplates: [...new Set(templates(auditorView))],
      },
      null,
      2,
    ),
  );
} finally {
  await run.stop();
}
