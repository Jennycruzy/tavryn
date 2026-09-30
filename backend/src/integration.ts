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
const invoiceNumber = `TVN-${randomUUID().slice(0, 8).toUpperCase()}`;
const commitment = `commitment-${randomUUID()}`;

try {
  const rules = await post("/api/v1/setup/rules", { maxAdvanceRate: "0.95" });
  const registry = await post("/api/v1/setup/registry", {});
  const draft = await post("/api/v1/invoices/drafts", {
    invoiceCommitment: commitment,
    terms: {
      externalInvoiceNumber: invoiceNumber,
      faceValue: "100.00",
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
  const currentRegistryCid = contractId(approved, "BuyerApprovalRegistry");
  const offerA = await post(
    `/api/v1/invoices/approved/${encodeURIComponent(approvedCid)}/offers`,
    { financierRole: "financierA", advance: "90.00", advanceRate: "0.90" },
  );
  const offerB = await post(
    `/api/v1/invoices/approved/${encodeURIComponent(approvedCid)}/offers`,
    { financierRole: "financierB", advance: "88.00", advanceRate: "0.88" },
  );
  const accepted = await post(
    `/api/v1/offers/${encodeURIComponent(contractId(offerA, "FinancingOffer"))}/accept`,
    { financierRole: "financierA" },
  );
  const rejected = await post(
    `/api/v1/offers/${encodeURIComponent(contractId(offerB, "FinancingOffer"))}/accept`,
    { financierRole: "financierB" },
  );
  const financedCid = contractId(accepted, "FinancedInvoice");
  const repaid = await post(
    `/api/v1/financed/${encodeURIComponent(financedCid)}/repay`,
    {
      financierRole: "financierA",
      repaymentDate: "2026-10-01",
      paymentReference: `repayment-${randomUUID()}`,
    },
  );

  const duplicateDraft = await post("/api/v1/invoices/drafts", {
    invoiceCommitment: `duplicate-${randomUUID()}`,
    terms: {
      externalInvoiceNumber: invoiceNumber,
      faceValue: "100.00",
      currency: "USD",
      issuedDate: "2026-09-01",
      dueDate: "2026-10-01",
    },
  });
  const duplicateApproval = await post(
    `/api/v1/invoices/drafts/${encodeURIComponent(contractId(duplicateDraft, "InvoiceDraft"))}/approve`,
    {
      networkRulesCid: contractId(rules, "NetworkRules"),
      registryCid: currentRegistryCid,
    },
  );

  const financierBView = await get("/api/v1/roles/financierB/contracts");
  const auditorView = await get("/api/v1/roles/auditor/contracts");
  assert(rejected.status === 409, "Financier B acceptance was rejected with HTTP 409");
  assert(
    rejected.body.code === "INVOICE_UNAVAILABLE",
    "Financier B received the plain unavailable response",
  );
  assert(
    typeof rejected.body.submissionReference?.commandId === "string" &&
      typeof rejected.body.submissionReference?.submissionId === "string",
    "Financier B rejection contains the real failed submission reference",
  );
  assert(
    financierBView.body.contracts
      .filter((contract: any) => contract.templateId.includes("FinancingOffer"))
      .every((contract: any) => contract.createArgument?.financier !== config.parties.financierA),
    "Financier B view contains no Financier A offer",
  );
  assert(
    !JSON.stringify(financierBView.body).includes("FinancedInvoice"),
    "Financier B view contains no financed invoice",
  );
  assert(
    !financierBView.body.contracts.some((contract: any) =>
      contract.templateId.includes("InvoiceDetails"),
    ),
    "Financier B view contains no private invoice terms contract",
  );
  assert(
    auditorView.body.contracts.some((contract: any) =>
      contract.templateId.includes("RepaymentReceipt"),
    ),
    "Auditor view contains the repayment receipt",
  );
  assert(
    duplicateApproval.status === 409 &&
      duplicateApproval.body.code === "DUPLICATE_OR_INVALID_APPROVAL",
    "Buyer approval service rejected a duplicate external invoice number",
  );

  console.log(
    JSON.stringify(
      {
        invoiceNumber,
        funding: {
          updateId: accepted.body.updateId,
          offset: accepted.body.offset,
          financierBRejection: {
            status: rejected.status,
            code: rejected.body.code,
            message: rejected.body.error,
            submissionReference: rejected.body.submissionReference,
          },
        },
        repayment: {
          updateId: repaid.body.updateId,
          offset: repaid.body.offset,
        },
        duplicateApproval: {
          status: duplicateApproval.status,
          code: duplicateApproval.body.code,
        },
        financierBVisibleTemplates: financierBView.body.contracts.map(
          (contract: any) => contract.templateId,
        ),
        auditorVisibleTemplates: auditorView.body.contracts.map(
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
