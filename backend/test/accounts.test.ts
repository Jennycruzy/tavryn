import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { Accounts, hashPassword } from "../src/accounts.js";
import { DocumentStore } from "../src/documents.js";
import { createTavrynServer, stopTavrynServer } from "../src/server.js";
import type { TavrynService } from "../src/tavryn-service.js";

const accounts = new Accounts({
  sessionSecret: "test-secret",
  accounts: [
    { email: "ap@supplier.test", name: "Supplier Ltd", role: "supplier", passwordHash: hashPassword("s-pass"), demoPassword: "s-pass" },
    { email: "ap@buyer.test", name: "Buyer plc", role: "buyer", passwordHash: hashPassword("b-pass") },
    { email: "credit@lender-a.test", name: "Lender A", role: "financierA", passwordHash: hashPassword("a-pass") },
    { email: "credit@lender-b.test", name: "Lender B", role: "financierB", passwordHash: hashPassword("l-pass") },
    { email: "admin2@network.test", name: "Admin 2", role: "operator", operatorIndex: "2", passwordHash: hashPassword("o-pass") },
    { email: "presenter@demo.test", name: "Presenter", role: "presenter", passwordHash: hashPassword("p-pass") },
  ],
});

test("a password signs in only its own account, and a tampered session is refused", () => {
  assert.equal(accounts.signIn("ap@supplier.test", "wrong"), undefined);
  const signedIn = accounts.signIn("AP@Supplier.test", "s-pass");
  assert.equal(signedIn?.account.role, "supplier");
  assert.equal(accounts.fromToken(signedIn?.token)?.email, "ap@supplier.test");
  const [email, expires] = (signedIn?.token ?? "").split(".");
  const forged = `${Buffer.from("ap@buyer.test").toString("base64url")}.${expires}.${(signedIn?.token ?? "").split(".")[2]}`;
  assert.equal(accounts.fromToken(forged), undefined);
  assert.equal(accounts.fromToken(`${email}.${Number(expires) + 1}.${(signedIn?.token ?? "").split(".")[2]}`), undefined);
});

test("only accounts with a published demo password are listed", () => {
  assert.deepEqual(accounts.demoAccounts().map((account) => account.email), ["ap@supplier.test"]);
});

const dir = mkdtempSync(join(tmpdir(), "tavryn-docs-"));
after(() => rmSync(dir, { recursive: true, force: true }));

test("the same file cannot back two invoice numbers", () => {
  const documents = new DocumentStore(join(dir, "store"));
  const file = Buffer.from("%PDF-1.4 invoice 1");
  const first = documents.upload(file, "inv.pdf", "application/pdf");
  documents.link(first.sha256, "INV-1");
  const again = documents.upload(file, "copy.pdf", "application/pdf");
  assert.equal(again.duplicateOf, "INV-1");
  assert.throws(() => documents.link(first.sha256, "INV-2"), { publicCode: "DUPLICATE_DOCUMENT" });
  assert.throws(() => documents.upload(Buffer.from("x"), "a.exe", "application/octet-stream"), {
    publicCode: "DOCUMENT_TYPE_UNSUPPORTED",
  });
  // The index survives a restart.
  assert.equal(new DocumentStore(join(dir, "store")).forInvoice("INV-1")?.meta.sha256, first.sha256);
});

// A stand-in service: these tests check who may call what, before any ledger work.
const calls: string[] = [];
const submission = { transaction: { updateId: "u", offset: 1, synchronizerId: "s" }, createdContracts: [] };
const fakeService = {
  config: { financiers: new Map([["financierA", "pa"], ["financierB", "pb"]]) },
  writeRateLimit: () => 1000,
  demoAuthEnabled: () => false,
  contractsForRole: async () => [],
  networkStatus: async () => ({}),
  createInvoiceDraft: async () => { calls.push("draft"); return submission; },
  acceptOffer: async (_cid: string, role: string) => { calls.push(`accept:${role}`); return submission; },
  vote: async (_cid: string, index: string) => { calls.push(`vote:${index}`); return submission; },
  payBalance: async (_cid: string, role: string) => { calls.push(`balance:${role}`); return submission; },
} as unknown as TavrynService;

test("each company can act only as itself", async () => {
  const documents = new DocumentStore(join(dir, "server-store"));
  const app = createTavrynServer(fakeService, { accounts, documents });
  await new Promise<void>((resolve) => app.listen(0, "127.0.0.1", () => resolve()));
  const base = `http://127.0.0.1:${(app.address() as { port: number }).port}`;
  try {
    const login = async (email: string, password: string) => {
      const response = await fetch(`${base}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200);
      return (response.headers.get("set-cookie") ?? "").split(";")[0];
    };
    const post = (path: string, cookie: string | undefined, body: unknown) =>
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(body),
      });
    const terms = { externalInvoiceNumber: "INV-9", faceValue: "10", currency: "NGN", issuedDate: "2026-10-01", dueDate: "2026-11-01" };

    assert.equal((await post("/api/v1/invoices/drafts", undefined, { terms })).status, 401);
    const supplier = await login("ap@supplier.test", "s-pass");
    const buyer = await login("ap@buyer.test", "b-pass");
    const lenderB = await login("credit@lender-b.test", "l-pass");
    const admin2 = await login("admin2@network.test", "o-pass");

    assert.equal((await post("/api/v1/invoices/drafts", buyer, { terms })).status, 403);
    assert.equal((await post("/api/v1/invoices/drafts", supplier, { terms })).status, 201);
    assert.equal((await post("/api/v1/offers/c1/accept", lenderB, { financierRole: "financierA", paymentReference: "r" })).status, 403);
    assert.equal((await post("/api/v1/offers/c1/accept", lenderB, { paymentReference: "r" })).status, 200);
    assert.equal((await post("/api/v1/governance/proposals/p1/votes", admin2, { operatorIndex: "1" })).status, 403);
    assert.equal((await post("/api/v1/governance/proposals/p1/votes", admin2, {})).status, 201);
    const view = await fetch(`${base}/api/v1/roles/financierA/contracts`, { headers: { Cookie: lenderB } });
    assert.equal(view.status, 403);

    const upload = (cookie: string, body: string) =>
      fetch(`${base}/api/v1/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf", "X-File-Name": "inv.pdf", Cookie: cookie },
        body,
      });
    assert.equal((await upload(buyer, "%PDF b")).status, 403);
    const stored = await (await upload(supplier, "%PDF-1.4 file")).json();
    const withFile = { terms: { ...terms, externalInvoiceNumber: "INV-10" }, documentSha256: stored.sha256 };
    assert.equal((await post("/api/v1/invoices/drafts", supplier, withFile)).status, 201);
    const reused = await post("/api/v1/invoices/drafts", supplier, { ...withFile, terms: { ...terms, externalInvoiceNumber: "INV-11" } });
    assert.equal(reused.status, 409);
    assert.equal((await reused.json()).code, "DUPLICATE_DOCUMENT");
    const file = await fetch(`${base}/api/v1/documents/INV-10`, { headers: { Cookie: buyer } });
    assert.equal(file.status, 200);
    assert.equal(await file.text(), "%PDF-1.4 file");
    assert.equal((await fetch(`${base}/api/v1/documents/INV-10`, { headers: { Cookie: lenderB } })).status, 403);

    const presenter = await login("presenter@demo.test", "p-pass");
    assert.equal((await fetch(`${base}/api/v1/race`, { headers: { Cookie: supplier } })).status, 403);
    assert.equal((await fetch(`${base}/api/v1/race`, { headers: { Cookie: presenter } })).status, 200);
    assert.equal((await post("/api/v1/race/prepare", lenderB, {})).status, 403);
    assert.equal((await post("/api/v1/invoices/drafts", presenter, { terms })).status, 403);

    assert.equal((await post("/api/v1/balances/b1/pay", buyer, { paymentReference: "r" })).status, 403);
    assert.equal((await post("/api/v1/balances/b1/pay", lenderB, { financierRole: "financierA", paymentReference: "r" })).status, 403);
    assert.equal((await post("/api/v1/balances/b1/pay", lenderB, { paymentReference: "r" })).status, 200);

    assert.deepEqual(calls, ["draft", "accept:financierB", "vote:2", "draft", "balance:financierB"]);
  } finally {
    await stopTavrynServer(app);
  }
});
