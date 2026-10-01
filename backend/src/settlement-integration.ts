import { randomUUID } from "node:crypto";

import { loadConfig } from "./config.js";
import { startTavrynServer } from "./server.js";
import { TavrynService } from "./tavryn-service.js";

interface JsonResponse {
  status: number;
  body: Record<string, any>;
}

const config = loadConfig();
const service = new TavrynService(config);
const server = await startTavrynServer(service, config.httpPort);
const baseUrl = `http://127.0.0.1:${config.httpPort}`;
const invoiceNumber = `TVN-SETTLED-${randomUUID().slice(0, 8).toUpperCase()}`;

try {
  const rules = await post("/api/v1/setup/rules", { maxAdvanceRate: "0.95" });
  const registry = await post("/api/v1/setup/registry", {});
  const draft = await post("/api/v1/invoices/drafts", {
    invoiceCommitment: `settlement-commitment-${randomUUID()}`,
    terms: {
      externalInvoiceNumber: invoiceNumber,
      faceValue: "1.00",
      currency: "USD",
      issuedDate: "2026-09-01",
      dueDate: "2026-10-01",
    },
  });
  const approved = await post(
    `/api/v1/invoices/drafts/${encodeURIComponent(contractId(draft, "InvoiceDraft"))}/approve`,
    {
      networkRulesCid: contractId(rules, "NetworkRules"),
      registryCid: contractId(registry, "BuyerApprovalRegistry"),
    },
  );
  const approvedCid = contractId(approved, "ApprovedInvoice");
  const offerA = await post(
    `/api/v1/invoices/approved/${encodeURIComponent(approvedCid)}/offers`,
    { financierRole: "financierA", advance: "0.90", advanceRate: "0.90" },
  );
  const offerB = await post(
    `/api/v1/invoices/approved/${encodeURIComponent(approvedCid)}/offers`,
    { financierRole: "financierB", advance: "0.88", advanceRate: "0.88" },
  );

  const funded = await post(
    `/api/v1/offers/${encodeURIComponent(contractId(offerA, "FinancingOffer"))}/fund`,
    { financierRole: "financierA" },
  );
  const financedCid = contractId(funded, "FinancedInvoice");
  assert(
    funded.status === 200 &&
      typeof funded.body.cashTransfer?.updateId === "string" &&
      typeof funded.body.cashTransfer?.eventId === "string",
    "Financier A funding did not return a real Canton Coin reference",
  );
  assert(
    funded.body.createdContracts.some((created: any) =>
      String(created.templateId).includes("FundingReceipt"),
    ),
    "Funding did not create the auditor-visible FundingReceipt",
  );

  const rejected = await post(
    `/api/v1/offers/${encodeURIComponent(contractId(offerB, "FinancingOffer"))}/fund`,
    { financierRole: "financierB" },
  );
  assert(rejected.status === 409, "Financier B funding was not rejected");
  assert(
    rejected.body.code === "INVOICE_UNAVAILABLE",
    "Financier B did not receive the plain invoice-unavailable response",
  );
  assert(
    typeof rejected.body.submissionReference?.commandId === "string" &&
      typeof rejected.body.submissionReference?.submissionId === "string",
    "Financier B rejection did not expose the real failed submission reference",
  );

  const repaid = await post(
    `/api/v1/financed/${encodeURIComponent(financedCid)}/settle-repay`,
    { financierRole: "financierA", repaymentDate: "2026-10-01" },
  );
  assert(
    repaid.status === 200 &&
      typeof repaid.body.cashTransfer?.updateId === "string" &&
      typeof repaid.body.cashTransfer?.eventId === "string",
    "Repayment did not return a real Canton Coin reference",
  );
  assert(
    repaid.body.createdContracts.some((created: any) =>
      String(created.templateId).includes("RepaymentReceipt"),
    ),
    "Repayment did not create the auditor-visible RepaymentReceipt",
  );

  const financierBView = await get("/api/v1/roles/financierB/contracts");
  const auditorView = await get("/api/v1/roles/auditor/contracts");
  assert(
    !financierBView.body.contracts.some((contract: any) =>
      contract.templateId.includes("FinancedInvoice") ||
      contract.templateId.includes("FundingReceipt") ||
      contract.templateId.includes("RepaymentReceipt"),
    ),
    "Financier B view contains the winning deal or its settlement receipts",
  );
  assert(
    auditorView.body.contracts.some((contract: any) =>
      contract.templateId.includes("FundingReceipt"),
    ) &&
      auditorView.body.contracts.some((contract: any) =>
        contract.templateId.includes("RepaymentReceipt"),
      ),
    "Auditor view does not contain the complete settlement trail",
  );

  console.log(
    JSON.stringify(
      {
        invoiceNumber,
        settlement: "two-step, non-atomic",
        funding: {
          ledgerUpdateId: funded.body.updateId,
          cashUpdateId: funded.body.cashTransfer.updateId,
          cashEventId: funded.body.cashTransfer.eventId,
        },
        financierBRejection: {
          status: rejected.status,
          code: rejected.body.code,
          submissionReference: rejected.body.submissionReference,
        },
        repayment: {
          ledgerUpdateId: repaid.body.updateId,
          cashUpdateId: repaid.body.cashTransfer.updateId,
          cashEventId: repaid.body.cashTransfer.eventId,
        },
        auditorTemplates: auditorView.body.contracts.map(
          (contract: any) => contract.templateId,
        ),
        financierBTemplates: financierBView.body.contracts.map(
          (contract: any) => contract.templateId,
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function post(path: string, body: Record<string, unknown>): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function get(path: string): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`);
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

function contractId(response: JsonResponse, templateName: string): string {
  const contract = response.body.createdContracts?.find((created: any) =>
    String(created.templateId).includes(templateName),
  );
  if (!contract?.contractId) {
    throw new Error(`No ${templateName} was created: ${JSON.stringify(response.body)}`);
  }
  return contract.contractId;
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
