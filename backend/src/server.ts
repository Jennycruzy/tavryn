import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { resolve, sep } from "node:path";

import { Accounts, cookieValue, type PublicAccount } from "./accounts.js";
import { isFinancierRole, isRole, loadConfig, type Role } from "./config.js";
import { DocumentError, DocumentStore, MAX_DOCUMENT_BYTES } from "./documents.js";
import { prepareRaceInvoice, raceCandidates, runRace } from "./race.js";
import { CantonCoinSettlementError } from "./canton-coin.js";
import {
  LedgerApiError,
  type SubmissionResult,
} from "./ledger-api.js";
import {
  type GovernanceActionInput,
  TavrynConflictError,
  TavrynInputError,
  TavrynSettlementError,
  TavrynService,
} from "./tavryn-service.js";

interface ServerContext {
  accounts?: Accounts;
  documents?: DocumentStore;
}

// Raised when the signed-in company may not do what it asked.
class AccessError extends Error {
  constructor(message: string, readonly publicCode: string, readonly status: number) {
    super(message);
    this.name = "AccessError";
  }
}

const ACCOUNT_COOKIE = "tavryn_account";

export function createTavrynServer(
  service: TavrynService,
  context: ServerContext = {
    accounts: Accounts.fromEnvironment(),
    documents: DocumentStore.fromEnvironment(),
  },
) {
  const writeLimiter = new WriteRateLimiter(service.writeRateLimit());
  return createServer(async (request, response) => {
    try {
      if (isWriteApiRequest(request) && !writeLimiter.allow(clientKey(request))) {
        writeJson(
          response,
          429,
          {
            error: "Too many write requests. Please try again in a minute.",
            code: "WRITE_RATE_LIMITED",
          },
          { "Retry-After": "60" },
        );
        return;
      }
      await route(request, response, service, context);
    } catch (error) {
      writeError(response, error);
    }
  });
}

async function route(
  request: IncomingMessage,
  response: ServerResponse,
  service: TavrynService,
  context: ServerContext,
): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (method === "GET" && await serveStatic(url.pathname, response)) {
    return;
  }

  if (method === "GET" && url.pathname === "/health") {
    const offset = await service.ledgerEnd();
    writeJson(response, 200, { service: "tavryn-backend", ledgerEndOffset: offset });
    return;
  }

  const accounts = context.accounts;
  const account = accounts?.fromToken(cookieValue(request.headers.cookie, ACCOUNT_COOKIE));

  if (parts.join("/").startsWith("api/v1/auth/")) {
    await authRoute(method, parts.join("/"), request, response, accounts, account);
    return;
  }

  if (accounts && parts[0] === "api" && !account) {
    writeJson(response, 401, { error: "Sign in to continue.", code: "ACCOUNT_REQUIRED" });
    return;
  }

  if (method === "POST" && parts.join("/") === "api/v1/session") {
    if (!service.demoAuthEnabled()) {
      writeJson(response, 404, {
        error: "Demo sign-in is not enabled on this server.",
        code: "DEMO_AUTH_DISABLED",
      });
      return;
    }
    const body = await readJson(request);
    const session = service.issueDemoSession(stringField(body, "passphrase"));
    if (!session) {
      writeJson(response, 401, {
        error: "That demo passphrase is not correct.",
        code: "DEMO_AUTH_FAILED",
      });
      return;
    }
    writeJson(
      response,
      200,
      { authenticated: true },
      {
        "Set-Cookie": `tavryn_session=${encodeURIComponent(session)}; HttpOnly; SameSite=Strict; Path=/`,
      },
    );
    return;
  }

  if (
    parts[0] === "api" &&
    service.demoAuthEnabled() &&
    !hasDemoSession(request.headers.cookie, service.demoSessionValue())
  ) {
    writeJson(response, 401, {
      error: "Sign in to use the Tavryn demo.",
      code: "DEMO_AUTH_REQUIRED",
    });
    return;
  }

  const path = parts.join("/");

  if (method === "GET" && parts.length === 5 && path.startsWith("api/v1/roles/") && parts[4] === "contracts") {
    const role = parseRole(service, parts[3]);
    allow(account, (signedIn) => signedIn.role === role);
    writeJson(response, 200, { role, contracts: await service.contractsForRole(role) });
    return;
  }

  if (method === "GET" && path === "api/v1/network") {
    writeJson(response, 200, await service.networkStatus());
    return;
  }

  if (method === "POST" && path === "api/v1/governance/proposals") {
    const body = await readJson(request);
    const result = await service.propose(
      operatorIndexFor(account, body),
      parseGovernanceAction(body.action),
    );
    writeSubmission(response, 201, result);
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "governance", "proposals", "*", "votes"])) {
    const body = await readJson(request);
    const result = await service.vote(parts[4], operatorIndexFor(account, body));
    writeSubmission(response, 201, result);
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "governance", "proposals", "*", "execute"])) {
    const body = await readJson(request);
    const result = await service.execute(parts[4], operatorIndexFor(account, body));
    writeSubmission(response, 200, result);
    return;
  }

  if (method === "POST" && path === "api/v1/invoices/drafts") {
    allow(account, (signedIn) => signedIn.role === "supplier");
    const body = await readJson(request);
    const terms = {
      externalInvoiceNumber: stringNestedField(body, "terms", "externalInvoiceNumber"),
      faceValue: stringNestedField(body, "terms", "faceValue"),
      currency: stringNestedField(body, "terms", "currency"),
      issuedDate: stringNestedField(body, "terms", "issuedDate"),
      dueDate: stringNestedField(body, "terms", "dueDate"),
    };
    const documentSha256 = typeof body.documentSha256 === "string" ? body.documentSha256 : undefined;
    if (documentSha256) {
      if (!context.documents) {
        throw new TavrynInputError("Invoice files are not enabled on this server.", "DOCUMENTS_DISABLED");
      }
      context.documents.assertLinkable(documentSha256, terms.externalInvoiceNumber);
    }
    const result = await service.createInvoiceDraft(terms);
    if (documentSha256) context.documents?.link(documentSha256, terms.externalInvoiceNumber);
    writeSubmission(response, 201, result);
    return;
  }

  if (path === "api/v1/race" || path === "api/v1/race/prepare") {
    allow(account, (signedIn) => signedIn.role === "presenter");
    if (method === "GET" && path === "api/v1/race") {
      writeJson(response, 200, { candidates: await raceCandidates(service) });
      return;
    }
    if (method === "POST" && path === "api/v1/race/prepare") {
      writeJson(response, 201, { candidate: await prepareRaceInvoice(service) });
      return;
    }
    if (method === "POST" && path === "api/v1/race") {
      const body = await readJson(request);
      try {
        writeJson(response, 200, await runRace(service, stringField(body, "invoiceNumber")));
      } catch (error) {
        if ((error as { publicCode?: string }).publicCode === "RACE_NOT_AVAILABLE") {
          throw new AccessError((error as Error).message, "RACE_NOT_AVAILABLE", 409);
        }
        throw error;
      }
      return;
    }
  }

  if (path === "api/v1/documents" && method === "POST") {
    allow(account, (signedIn) => signedIn.role === "supplier");
    const documents = requireDocuments(context);
    const body = await readRaw(request, MAX_DOCUMENT_BYTES);
    const name = decodeHeader(request.headers["x-file-name"]);
    const type = String(request.headers["content-type"] ?? "").split(";")[0].trim();
    const stored = documents.upload(body, name, type);
    writeJson(response, 201, stored);
    return;
  }

  if (path === "api/v1/documents" && method === "GET") {
    const documents = requireDocuments(context);
    const invoices = documents.invoicesWithDocuments();
    const visible = account && isFinancierRole(service.config, account.role)
      ? await invoicesVisibleTo(service, account.role, invoices)
      : invoices;
    writeJson(response, 200, { invoices: visible });
    return;
  }

  if (method === "GET" && parts.length === 4 && path.startsWith("api/v1/documents/")) {
    const documents = requireDocuments(context);
    const invoiceNumber = parts[3];
    if (account && isFinancierRole(service.config, account.role)) {
      const visible = await invoicesVisibleTo(service, account.role, [invoiceNumber]);
      if (!visible.length) throw new AccessError("This invoice was not offered to you.", "FORBIDDEN", 403);
    } else {
      allow(account, (signedIn) => ["supplier", "buyer", "auditor"].includes(signedIn.role));
    }
    const document = documents.forInvoice(invoiceNumber);
    if (!document) {
      writeJson(response, 404, { error: "No file is attached to this invoice.", code: "DOCUMENT_NOT_FOUND" });
      return;
    }
    response.writeHead(200, {
      "Content-Type": document.meta.type,
      "Content-Length": document.body.byteLength,
      "Content-Disposition": `inline; filename="${document.meta.name.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(document.body);
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "invoices", "drafts", "*", "approve"])) {
    allow(account, (signedIn) => signedIn.role === "buyer");
    const body = await readJson(request);
    const roles = body.eligibleFinancierRoles;
    if (roles !== undefined && (!Array.isArray(roles) || roles.some((role) => typeof role !== "string"))) {
      throw new TavrynInputError("eligibleFinancierRoles must be an array of strings");
    }
    const result = await service.approveInvoice(parts[4], roles as string[] | undefined);
    writeSubmission(response, 200, result);
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "invoices", "approved", "*", "offers"])) {
    allow(account, (signedIn) => signedIn.role === "supplier");
    const body = await readJson(request);
    const result = await service.createOffer(
      parts[4],
      stringField(body, "financierRole"),
      stringField(body, "advance"),
      stringField(body, "advanceRate"),
      typeof body.fee === "string" && body.fee.trim() ? body.fee.trim() : undefined,
    );
    writeSubmission(response, 201, result);
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "offers", "*", "accept"])) {
    const body = await readJson(request);
    const result = await service.acceptOffer(
      parts[3],
      financierRoleFor(account, body),
      stringField(body, "paymentReference"),
    );
    writeSubmission(response, 200, result);
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "offers", "*", "fund"])) {
    const body = await readJson(request);
    const result = await service.fundOffer(parts[3], financierRoleFor(account, body));
    writeSettledSubmission(response, 200, result);
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "pending-funding", "*", "reconcile"])) {
    writeJson(response, 200, await service.reconcileFunding(parts[3]));
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "pending-repayment", "*", "reconcile"])) {
    writeJson(response, 200, await service.reconcileRepayment(parts[3]));
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "balances", "*", "pay"])) {
    const body = await readJson(request);
    const result = await service.payBalance(
      parts[3],
      financierRoleFor(account, body),
      stringField(body, "paymentReference"),
    );
    writeSubmission(response, 200, result);
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "balances", "*", "settle"])) {
    const body = await readJson(request);
    const result = await service.settleBalance(parts[3], financierRoleFor(account, body));
    writeSettledSubmission(response, 200, result);
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "financed", "*", "repay"])) {
    allow(account, (signedIn) => signedIn.role === "buyer");
    const body = await readJson(request);
    const result = await service.repay(
      parts[3],
      stringField(body, "repaymentDate"),
      stringField(body, "paymentReference"),
    );
    writeSubmission(response, 200, result);
    return;
  }

  if (method === "POST" && matches(parts, ["api", "v1", "financed", "*", "settle-repay"])) {
    allow(account, (signedIn) => signedIn.role === "buyer");
    const body = await readJson(request);
    const result = await service.repayWithSettlement(parts[3], stringField(body, "repaymentDate"));
    writeSettledSubmission(response, 200, result);
    return;
  }

  writeJson(response, 404, { error: "Route not found", code: "NOT_FOUND" });
}

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

async function serveStatic(pathname: string, response: ServerResponse): Promise<boolean> {
  let root: string;
  let relativePath: string;
  if (pathname === "/") {
    // The public landing page.
    root = resolve(projectRoot, "ui");
    relativePath = "index.html";
  } else if (pathname === "/race" || pathname === "/race/") {
    root = resolve(projectRoot, "ui");
    relativePath = "race.html";
  } else if (pathname === "/login" || pathname === "/login/") {
    root = resolve(projectRoot, "ui");
    relativePath = "login.html";
  } else if (pathname === "/app" || pathname === "/app/") {
    // The product workspace.
    root = resolve(projectRoot, "ui");
    relativePath = "app.html";
  } else if (pathname.startsWith("/ui/")) {
    root = resolve(projectRoot, "ui");
    relativePath = pathname.slice("/ui/".length);
  } else if (pathname.startsWith("/assets/")) {
    root = resolve(projectRoot, "assets");
    relativePath = pathname.slice("/assets/".length);
  } else {
    return false;
  }

  const filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    writeJson(response, 400, { error: "Invalid static path", code: "INVALID_PATH" });
    return true;
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store",
      "Content-Length": body.byteLength,
    });
    response.end(body);
  } catch {
    writeJson(response, 404, { error: "Static asset not found", code: "NOT_FOUND" });
  }
  return true;
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function startTavrynServer(service: TavrynService, port: number) {
  const server = createTavrynServer(service);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
  return server;
}

export async function stopTavrynServer(server: ReturnType<typeof createServer>): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
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

async function readRaw(request: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > limit) {
      throw new DocumentError("The file must be under 1 MB.", "DOCUMENT_TOO_LARGE");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function decodeHeader(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

async function authRoute(
  method: string,
  path: string,
  request: IncomingMessage,
  response: ServerResponse,
  accounts: Accounts | undefined,
  account: PublicAccount | undefined,
): Promise<void> {
  if (!accounts) {
    writeJson(response, 404, { error: "Company accounts are not enabled on this server.", code: "ACCOUNTS_DISABLED" });
    return;
  }
  if (method === "GET" && path === "api/v1/auth/me") {
    if (!account) {
      writeJson(response, 401, { error: "Sign in to continue.", code: "ACCOUNT_REQUIRED" });
      return;
    }
    writeJson(response, 200, { account });
    return;
  }
  if (method === "GET" && path === "api/v1/auth/demo-accounts") {
    writeJson(response, 200, { accounts: accounts.demoAccounts() });
    return;
  }
  const secure = request.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  if (method === "POST" && path === "api/v1/auth/login") {
    const body = await readJson(request);
    const signedIn = accounts.signIn(stringField(body, "email"), stringField(body, "password"));
    if (!signedIn) {
      writeJson(response, 401, { error: "That email or password is not right.", code: "SIGN_IN_FAILED" });
      return;
    }
    writeJson(response, 200, { account: signedIn.account }, {
      "Set-Cookie": `${ACCOUNT_COOKIE}=${encodeURIComponent(signedIn.token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${accounts.sessionSeconds()}${secure}`,
    });
    return;
  }
  if (method === "POST" && path === "api/v1/auth/logout") {
    writeJson(response, 200, { signedOut: true }, {
      "Set-Cookie": `${ACCOUNT_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`,
    });
    return;
  }
  writeJson(response, 404, { error: "Route not found", code: "NOT_FOUND" });
}

// With accounts enabled, the signed-in company must pass the check; without them the
// server is open.
function allow(account: PublicAccount | undefined, check: (account: PublicAccount) => boolean): void {
  if (account && !check(account)) {
    throw new AccessError("Your company can't do that.", "FORBIDDEN", 403);
  }
}

function financierRoleFor(account: PublicAccount | undefined, body: Record<string, unknown>): string {
  if (!account) return stringField(body, "financierRole");
  if (!account.role.startsWith("financier")) {
    throw new AccessError("Only a lender can finance an invoice.", "FORBIDDEN", 403);
  }
  if (typeof body.financierRole === "string" && body.financierRole !== account.role) {
    throw new AccessError("You can only finance as your own company.", "FORBIDDEN", 403);
  }
  return account.role;
}

function operatorIndexFor(account: PublicAccount | undefined, body: Record<string, unknown>): string {
  if (!account) return stringField(body, "operatorIndex");
  if (account.role !== "operator" || !account.operatorIndex) {
    throw new AccessError("Only a network admin can do that.", "FORBIDDEN", 403);
  }
  if (typeof body.operatorIndex === "string" && body.operatorIndex !== account.operatorIndex) {
    throw new AccessError("You can only act as your own organisation.", "FORBIDDEN", 403);
  }
  return account.operatorIndex;
}

function requireDocuments(context: ServerContext): DocumentStore {
  if (!context.documents) {
    throw new TavrynInputError("Invoice files are not enabled on this server.", "DOCUMENTS_DISABLED");
  }
  return context.documents;
}

// A lender may open an invoice file only for invoices that appear in its own view.
async function invoicesVisibleTo(
  service: TavrynService,
  role: string,
  invoiceNumbers: string[],
): Promise<string[]> {
  const contracts = await service.contractsForRole(role as Role);
  const seen = new Set<string>();
  for (const contract of contracts) {
    const terms = (contract.createArgument as Record<string, any> | undefined)?.terms;
    if (terms && typeof terms.externalInvoiceNumber === "string") seen.add(terms.externalInvoiceNumber);
  }
  return invoiceNumbers.filter((number) => seen.has(number));
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

function stringArrayField(body: Record<string, unknown>, field: string): string[] {
  const value = body[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TavrynInputError(`${field} must be an array of strings`);
  }
  return value as string[];
}

function parseRole(service: TavrynService, value: string): Role {
  if (!isRole(service.config, value)) {
    throw new TavrynInputError("Unknown role");
  }
  return value;
}

function parseGovernanceAction(value: unknown): GovernanceActionInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TavrynInputError("action must be an object");
  }
  const action = value as Record<string, unknown>;
  if (action.type === "AdmitFinancier" || action.type === "RemoveFinancier") {
    return { type: action.type, financierRole: stringField(action, "financierRole") };
  }
  if (action.type === "SetMaxAdvanceRate") {
    return { type: action.type, rate: stringField(action, "rate") };
  }
  throw new TavrynInputError(
    "action.type must be AdmitFinancier, RemoveFinancier or SetMaxAdvanceRate",
  );
}

function matches(parts: string[], pattern: string[]): boolean {
  return (
    parts.length === pattern.length &&
    pattern.every((segment, index) => segment === "*" || segment === parts[index])
  );
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

function writeSettledSubmission(
  response: ServerResponse,
  status: number,
  result: Awaited<ReturnType<TavrynService["fundOffer"]>>,
): void {
  writeJson(response, status, {
    updateId: result.ledger.transaction.updateId,
    offset: result.ledger.transaction.offset,
    synchronizerId: result.ledger.transaction.synchronizerId,
    createdContracts: result.ledger.createdContracts,
    cashTransfer: result.cash,
  });
}

function writeError(response: ServerResponse, error: unknown): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }
  if (error instanceof AccessError || error instanceof DocumentError) {
    writeJson(response, error.status, {
      error: error.message,
      code: error.publicCode,
      ...(error instanceof DocumentError ? error.details ?? {} : {}),
    });
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
      ...(error.details ?? {}),
    });
    return;
  }
  if (error instanceof CantonCoinSettlementError) {
    writeJson(response, error.status, {
      error: error.message,
      code: error.publicCode,
    });
    return;
  }
  if (error instanceof TavrynSettlementError) {
    writeJson(response, error.status, {
      error: error.message,
      code: error.publicCode,
      ...(error.paymentReference
        ? { paymentReference: error.paymentReference }
        : {}),
      ...(error.pendingContractId
        ? { pendingContractId: error.pendingContractId }
        : {}),
    });
    return;
  }
  if (error instanceof LedgerApiError) {
    // Server-side only: the Canton error identifiers, never tokens or payload bodies.
    console.error("Canton request failed", {
      status: error.status,
      code: error.code,
      errorCategory: error.errorCategory,
    });
    writeJson(response, 502, {
      error: "The ledger could not complete the request.",
      code: "LEDGER_REQUEST_FAILED",
      ...(error.submissionReference
        ? { submissionReference: error.submissionReference }
        : {}),
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

function writeJson(
  response: ServerResponse,
  status: number,
  value: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    ...extraHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function isWriteApiRequest(request: IncomingMessage): boolean {
  const method = request.method ?? "GET";
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS"
    && (request.url ?? "/").startsWith("/api/");
}

// Behind the host nginx, X-Real-IP is set by nginx itself; the first X-Forwarded-For
// entry can be supplied by the client, so it is not used to identify a visitor.
function clientKey(request: IncomingMessage): string {
  const realIp = request.headers["x-real-ip"];
  const value = Array.isArray(realIp) ? realIp[0] : realIp;
  return value?.trim() || request.socket.remoteAddress || "unknown";
}

class WriteRateLimiter {
  private readonly entries = new Map<string, { startedAt: number; count: number }>();

  constructor(private readonly limit: number, private readonly windowMs = 60_000) {}

  allow(key: string): boolean {
    const now = Date.now();
    const entry = this.entries.get(key);
    if (!entry || now - entry.startedAt >= this.windowMs) {
      this.entries.set(key, { startedAt: now, count: 1 });
      this.prune(now);
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }

  private prune(now: number): void {
    if (this.entries.size < 1000) return;
    for (const [key, entry] of this.entries) {
      if (now - entry.startedAt >= this.windowMs) this.entries.delete(key);
    }
  }
}

function hasDemoSession(cookieHeader: string | undefined, expected: string | undefined): boolean {
  if (!cookieHeader || !expected) return false;
  return cookieHeader.split(";").some((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return false;
    const name = part.slice(0, separator).trim();
    if (name !== "tavryn_session") return false;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim()) === expected;
    } catch {
      return false;
    }
  });
}

// On startup and every 60 s, settlement locks older than 30 s are reconciled against
// the wallet history by tracking ID. The sweep never sends cash.
export function startSettlementSweeper(service: TavrynService, intervalMs = 60_000) {
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      const outcomes = await service.sweepSettlementLocks();
      for (const outcome of outcomes) {
        if (outcome.outcome !== "pending") {
          console.log("Settlement lock reconciled", {
            contractId: outcome.contractId,
            outcome: outcome.outcome,
            trackingId: outcome.trackingId,
          });
        }
      }
    } catch (error) {
      console.error("Settlement sweep failed", {
        message: error instanceof Error ? error.message : "unknown error",
      });
    } finally {
      running = false;
    }
  };
  void sweep();
  const timer = setInterval(sweep, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

if (process.argv[1]?.endsWith("/server.ts") || process.argv[1]?.endsWith("/server.js")) {
  const config = loadConfig();
  const service = new TavrynService(config);
  const server = createTavrynServer(service);
  server.listen(config.httpPort, "127.0.0.1", () => {
    console.log(`Tavryn backend listening on 127.0.0.1:${config.httpPort}`);
  });
  startSettlementSweeper(service);
}
