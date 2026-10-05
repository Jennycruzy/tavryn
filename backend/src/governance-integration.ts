import {
  type JsonResponse,
  assert,
  contractId,
  startIntegration,
  uniqueInvoiceNumber,
} from "./integration-client.js";

// Shared control over the network rules, against the real ledger: each change is
// refused with one operator vote and applied at the threshold, and an invoice opened
// before the changes still funds afterwards.
const run = await startIntegration();
const { config, post, get } = run;
const candidateRole = "financierC";
assert(config.financiers.has(candidateRole), "financierC must be configured as the candidate");

async function governed(action: Record<string, unknown>) {
  const proposal = await post("/api/v1/governance/proposals", { operatorIndex: "1", action });
  assert(proposal.status === 201, `Proposal failed: ${JSON.stringify(proposal.body)}`);
  const proposalCid = contractId(proposal, "GovernanceProposal");
  const vote = (index: string) =>
    post(`/api/v1/governance/proposals/${encodeURIComponent(proposalCid)}/votes`, {
      operatorIndex: index,
    });
  const execute = () =>
    post(`/api/v1/governance/proposals/${encodeURIComponent(proposalCid)}/execute`, {
      operatorIndex: "1",
    });
  await vote("1");
  const below = await execute();
  assert(
    below.status === 409 && below.body.code === "GOVERNANCE_THRESHOLD_NOT_MET",
    `One vote was not rejected: ${JSON.stringify(below.body)}`,
  );
  for (let index = 2; index <= config.governance.threshold; index += 1) {
    await vote(String(index));
  }
  const atThreshold = await execute();
  assert(atThreshold.status === 200, `Threshold execution failed: ${JSON.stringify(atThreshold.body)}`);
  return { action, below: summary(below), atThreshold: summary(atThreshold) };
}

function summary(response: JsonResponse) {
  return {
    status: response.status,
    code: response.body.code,
    message: response.body.error,
    updateId: response.body.updateId,
    submissionReference: response.body.submissionReference,
  };
}

try {
  await run.service.bootstrapNetwork();
  const before = (await get("/api/v1/network")).body;

  // An invoice opened before any governance change.
  const draft = await post("/api/v1/invoices/drafts", {
    terms: {
      externalInvoiceNumber: uniqueInvoiceNumber("TVN-GOV"),
      faceValue: "100.00",
      currency: "USD",
      issuedDate: "2026-09-01",
      dueDate: "2026-12-01",
    },
  });
  const approved = await post(
    `/api/v1/invoices/drafts/${encodeURIComponent(contractId(draft, "InvoiceDraft"))}/approve`,
    { eligibleFinancierRoles: ["financierA"] },
  );
  const openOffer = await post(
    `/api/v1/invoices/approved/${encodeURIComponent(contractId(approved, "ApprovedInvoice"))}/offers`,
    { financierRole: "financierA", advance: "80.00", advanceRate: "0.80" },
  );

  const changes = [];
  const candidateAdmitted = before.rules.financiers.some(
    (financier: any) => financier.role === candidateRole,
  );
  if (candidateAdmitted) {
    changes.push(await governed({ type: "RemoveFinancier", financierRole: candidateRole }));
  }
  changes.push(await governed({ type: "AdmitFinancier", financierRole: candidateRole }));
  const nextRate = before.rules.maxAdvanceRate.startsWith("0.95") ? "0.94" : "0.95";
  changes.push(await governed({ type: "SetMaxAdvanceRate", rate: nextRate }));
  const after = (await get("/api/v1/network")).body;

  // The invoice opened before the changes still funds.
  const fundedOpen = await post(
    `/api/v1/offers/${encodeURIComponent(contractId(openOffer, "FinancingOffer"))}/accept`,
    { financierRole: "financierA", paymentReference: "bank-open-before-governance" },
  );
  assert(fundedOpen.status === 200, `The pre-existing offer no longer funds: ${JSON.stringify(fundedOpen.body)}`);

  // The admitted financier can be made eligible and fund.
  const draftC = await post("/api/v1/invoices/drafts", {
    terms: {
      externalInvoiceNumber: uniqueInvoiceNumber("TVN-C"),
      faceValue: "100.00",
      currency: "USD",
      issuedDate: "2026-09-01",
      dueDate: "2026-12-01",
    },
  });
  const approvedC = await post(
    `/api/v1/invoices/drafts/${encodeURIComponent(contractId(draftC, "InvoiceDraft"))}/approve`,
    { eligibleFinancierRoles: [candidateRole] },
  );
  const offerC = await post(
    `/api/v1/invoices/approved/${encodeURIComponent(contractId(approvedC, "ApprovedInvoice"))}/offers`,
    { financierRole: candidateRole, advance: "70.00", advanceRate: "0.70" },
  );
  const fundedC = await post(
    `/api/v1/offers/${encodeURIComponent(contractId(offerC, "FinancingOffer"))}/accept`,
    { financierRole: candidateRole, paymentReference: "bank-financier-c" },
  );
  assert(fundedC.status === 200, `The admitted financier could not fund: ${JSON.stringify(fundedC.body)}`);

  console.log(
    JSON.stringify(
      {
        packageId: config.packageId,
        networkId: config.networkId,
        threshold: config.governance.threshold,
        operators: config.governance.operatorPartyIds.length,
        rulesVersionBefore: before.rules.version,
        rulesVersionAfter: after.rules.version,
        maxAdvanceRateAfter: after.rules.maxAdvanceRate,
        changes,
        preExistingOfferFunded: { status: fundedOpen.status, updateId: fundedOpen.body.updateId },
        admittedFinancierFunded: { status: fundedC.status, updateId: fundedC.body.updateId },
      },
      null,
      2,
    ),
  );
} finally {
  await run.stop();
}
