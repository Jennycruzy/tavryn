import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";

import { isRole, loadConfig, type Role } from "./config.js";
import {
  LedgerApiError,
  type SubmissionResult,
} from "./ledger-api.js";
import {
  TavrynConflictError,
  TavrynInputError,
  TavrynService,
} from "./tavryn-service.js";

export function createTavrynServer(service: TavrynService) {
  return createServer(async (request, response) => {
    try {
      await route(request, response, service);
    } catch (error) {
      writeError(response, error);
    }
  });
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  service: TavrynService,
): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (method === "GET" && url.pathname === "/health") {
    const offset = await service.ledgerEnd();
    writeJson(response, 200, { service: "tavryn-backend", ledgerEndOffset: offset });
    return;
  }

  if (
    method === "GET" &&
    parts.length === 5 &&
    parts[0] === "api" &&
    parts[1] === "v1" &&
    parts[2] === "roles" &&
    parts[4] === "contracts"
  ) {
    const role = parseRole(parts[3]);
    writeJson(response, 200, {
      role,
      contracts: await service.contractsForRole(role),
    });
    return;
  }

  if (method === "POST" && parts.join("/") === "api/v1/setup/rules") {
    const body = await readJson(request);
    const result = await service.createNetworkRules(stringField(body, "maxAdvanceRate"));
    writeSubmission(response, 201, result);
    return;
  }

  if (method === "POST" && parts.join("/") === "api/v1/setup/registry") {
    const result = await service.createBuyerRegistry();
    writeSubmission(response, 201, result);
    return;
  }

  if (method === "POST" && parts.join("/") === "api/v1/invoices/drafts") {
    const body = await readJson(request);
    const result = await service.createInvoiceDraft({
      invoiceCommitment: stringField(body, "invoiceCommitment"),
      terms: {
        externalInvoiceNumber: stringNestedField(body, "terms", "externalInvoiceNumber"),
        faceValue: stringNestedField(body, "terms", "faceValue"),
        currency: stringNestedField(body, "terms", "currency"),
        issuedDate: stringNestedField(body, "terms", "issuedDate"),
        dueDate: stringNestedField(body, "terms", "dueDate"),
      },
    });
    writeSubmission(response, 201, result);
    return;
  }

  if (
    method === "POST" &&
    parts.length === 6 &&
    parts[0] === "api" &&
    parts[1] === "v1" &&
    parts[2] === "invoices" &&
    parts[3] === "drafts" &&
    parts[5] === "approve"
  ) {
    const body = await readJson(request);
    const result = await service.approveInvoice(
      parts[4],
      stringField(body, "networkRulesCid"),
      stringField(body, "registryCid"),
    );
    writeSubmission(response, 200, result);
    return;
  }

  if (
    method === "POST" &&
    parts.length === 6 &&
    parts[0] === "api" &&
    parts[1] === "v1" &&
    parts[2] === "invoices" &&
    parts[3] === "approved" &&
    parts[5] === "offers"
  ) {
    const body = await readJson(request);
    const result = await service.createOffer(
      parts[4],
      parseFinancierRole(stringField(body, "financierRole")),
      stringField(body, "advance"),
      stringField(body, "advanceRate"),
    );
    writeSubmission(response, 201, result);
    return;
  }

  if (
    method === "POST" &&
    parts.length === 5 &&
    parts[0] === "api" &&
    parts[1] === "v1" &&
    parts[2] === "offers" &&
    parts[4] === "accept"
  ) {
    const body = await readJson(request);
    const result = await service.acceptOffer(
      parts[3],
      parseFinancierRole(stringField(body, "financierRole")),
    );
    writeSubmission(response, 200, result);
    return;
  }

  if (
    method === "POST" &&
    parts.length === 5 &&
    parts[0] === "api" &&
    parts[1] === "v1" &&
    parts[2] === "financed" &&
    parts[4] === "repay"
  ) {
    const body = await readJson(request);
    const result = await service.repay(
      parts[3],
      parseFinancierRole(stringField(body, "financierRole")),
      stringField(body, "repaymentDate"),
      stringField(body, "paymentReference"),
    );
    writeSubmission(response, 200, result);
    return;
  }

  writeJson(response, 404, { error: "Route not found", code: "NOT_FOUND" });
}

export async function startTavrynServer(service: TavrynService, port: number) {
  const server = createTavrynServer(service);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  return server;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > 1_000_000) {
      throw new TavrynInputError("Request body is too large");
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new TavrynInputError("Request body must be valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TavrynInputError("Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function stringField(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string") {
    throw new TavrynInputError(`${field} must be a string`);
  }
  return value;
}

function stringNestedField(
  body: Record<string, unknown>,
  parent: string,
  field: string,
): string {
  const value = body[parent];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TavrynInputError(`${parent} must be an object`);
  }
  return stringField(value as Record<string, unknown>, field);
}

function parseRole(value: string): Role {
  if (!isRole(value)) {
    throw new TavrynInputError("Unknown role");
  }
  return value;
}

function parseFinancierRole(value: string): "financierA" | "financierB" {
  if (value !== "financierA" && value !== "financierB") {
    throw new TavrynInputError("financierRole must be financierA or financierB");
  }
  return value;
}

function writeSubmission(
  response: ServerResponse,
  status: number,
  result: SubmissionResult,
): void {
  writeJson(response, status, {
    updateId: result.transaction.updateId,
    offset: result.transaction.offset,
    synchronizerId: result.transaction.synchronizerId,
    createdContracts: result.createdContracts,
  });
}

function writeError(response: ServerResponse, error: unknown): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  if (error instanceof TavrynInputError) {
    writeJson(response, error.status, { error: error.message, code: error.publicCode });
    return;
  }
  if (error instanceof TavrynConflictError) {
    writeJson(response, error.status, {
      error: error.message,
      code: error.publicCode,
      ...(error.submissionReference
        ? { submissionReference: error.submissionReference }
        : {}),
    });
    return;
  }
  if (error instanceof LedgerApiError) {
    console.error("Canton request failed", { status: error.status });
    writeJson(response, 502, {
      error: "The ledger could not complete the request.",
      code: "LEDGER_REQUEST_FAILED",
    });
    return;
  }
  console.error("Tavryn backend request failed", {
    message: error instanceof Error ? error.message : "unknown error",
  });
  writeJson(response, 500, {
    error: "The Tavryn service could not complete the request.",
    code: "SERVICE_ERROR",
  });
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

if (process.argv[1]?.endsWith("/server.ts") || process.argv[1]?.endsWith("/server.js")) {
  const config = loadConfig();
  const service = new TavrynService(config);
  const server = createTavrynServer(service);
  server.listen(config.httpPort, "127.0.0.1", () => {
    console.log(`Tavryn backend listening on 127.0.0.1:${config.httpPort}`);
  });
}
