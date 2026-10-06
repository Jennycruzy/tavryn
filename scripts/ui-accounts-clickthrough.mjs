// A recorded browser session through Tavryn with company accounts: each company signs
// in to its own workspace. The supplier uploads a PDF invoice (generated from the
// synthetic Lagos fixture with a fresh number), the buyer opens the file and approves
// it, two lenders receive offers, one finances it by bank transfer reference, the
// other finds it gone, the buyer repays, and two network admins change a rule.
//   node scripts/ui-accounts-clickthrough.mjs <baseUrl> <outDir>
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const [base = "http://127.0.0.1:18840", outDir = "docs/evidence/P5_ACCOUNTS"] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });

const run = Date.now().toString(36).toUpperCase();
const invoiceNumber = `MRL/INV/2026/${run}`;
const accounts = {
  supplier: ["accounts@adeyemi-packaging.demo", "adeyemi-demo"],
  buyer: ["payables@sunrise-foods.demo", "sunrise-demo"],
  lenderA: ["credit@lender-a.demo", "lender-a-demo"],
  lenderB: ["credit@lender-b.demo", "lender-b-demo"],
  auditor: ["audit@auditor.demo", "auditor-demo"],
  admin1: ["admin@network-1.demo", "admin-1-demo"],
  admin2: ["admin@network-2.demo", "admin-2-demo"],
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, recordVideo: { dir: outDir } });
const page = await context.newPage();
const steps = [];
let shot = 0;

async function capture(name, note) {
  shot += 1;
  const file = `${String(shot).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: join(outDir, file), fullPage: true });
  const result = (await page.locator("#resultBody").innerText().catch(() => "")).trim();
  steps.push({ step: shot, name, note, screenshot: file, result });
  console.log(`${shot}. ${name}: ${result.split("\n")[0] || note}`);
}

async function signIn(who) {
  await page.goto(`${base}/login`);
  await page.fill("#email", accounts[who][0]);
  await page.fill("#password", accounts[who][1]);
  await page.click("button[type=submit]");
  await page.waitForURL(`${base}/app`);
  await page.waitForSelector("#actionBody form, #actionBody .notice");
  // Wait until the workspace has finished loading, so its forms are not redrawn.
  await page.waitForFunction(() =>
    /Connected/.test(document.querySelector("#connectionText")?.textContent || "") &&
    !/Loading/.test(document.querySelector("#contractsList")?.textContent || "") &&
    ![...document.querySelectorAll("button")].some((button) => button.disabled && !button.dataset.locked));
}

async function signOut() {
  await page.click("#signOut");
  await page.waitForURL(`${base}/login`);
}

async function submit(action) {
  await page.click(`form[data-action="${action}"] button[type=submit]`);
  await page.waitForFunction(() => document.querySelector("#resultBody .result-box"));
  await page.waitForFunction(() => ![...document.querySelectorAll("button")].some((button) => button.disabled && !button.dataset.locked));
}

async function choose(selectId, text) {
  const value = await page.$eval(`#${selectId}`, (select, wanted) =>
    [...select.options].find((option) => option.textContent.includes(wanted))?.value, text);
  if (!value) throw new Error(`No option containing ${text} in #${selectId}`);
  await page.selectOption(`#${selectId}`, value);
}

// The invoice PDF, rendered from the synthetic Lagos fixture with this run's number.
const fixture = await readFile("fixtures/invoices/SYN-003-meridian-logistics.html", "utf8");
const pdfPage = await context.newPage();
await pdfPage.setContent(fixture.replaceAll("MRL/INV/2026/318", invoiceNumber));
const pdfPath = join(outDir, `invoice-${run}.pdf`);
await pdfPage.pdf({ path: pdfPath, format: "A4" });
await pdfPage.close();

try {
  await page.goto(`${base}/app`);
  await page.waitForURL(`${base}/login`);
  await capture("sign-in", "Opening the app without a session goes to the sign-in page");

  await signIn("supplier");
  await page.setInputFiles("#invoiceFile", pdfPath);
  await page.waitForFunction(() => /attached/.test(document.querySelector("#uploadStatus")?.textContent || ""));
  await capture("supplier-upload", "The PDF fills in the invoice; the supplier checks it");
  const filled = await page.inputValue("#externalInvoiceNumber");
  if (filled !== invoiceNumber) throw new Error(`Read ${filled} instead of ${invoiceNumber}`);
  await page.fill("#dueDate", "2026-11-04");
  await submit("create-draft");
  await capture("supplier-created", "Invoice created with the file attached");
  await signOut();

  await signIn("buyer");
  await choose("draftCid", invoiceNumber);
  await page.waitForSelector("#draftFile a");
  await capture("buyer-sees-file", "The buyer can open the uploaded invoice before approving");
  await submit("approve");
  await capture("buyer-approved", "Approved for Lender A and Lender B");
  await signOut();

  await signIn("supplier");
  for (const lender of ["Lender A", "Lender B"]) {
    await choose("approvedCid", invoiceNumber);
    await choose("offerFinancier", lender);
    await page.fill("#offerAdvance", "16200000");
    await submit("create-offer");
  }
  await capture("supplier-offered", "Private offers to two lenders");
  await signOut();

  await signIn("lenderB");
  await capture("lender-b-offer", "Lender B sees only its own offer");
  await signOut();

  await signIn("lenderA");
  await choose("offerCid", invoiceNumber);
  await page.fill("#fundReference", `NIP-DEMO-${run}`);
  await submit("fund");
  await capture("lender-a-financed", "Lender A finances by bank transfer reference");
  await signOut();

  await signIn("lenderB");
  await capture("lender-b-closed", "Lender B is told the invoice is no longer available");
  await signOut();

  await signIn("buyer");
  await choose("financedCid", invoiceNumber);
  await page.fill("#repayReference", `NIP-REPAY-${run}`);
  await submit("repay");
  await capture("buyer-repaid", "The buyer repays the lender who financed it");
  await signOut();

  await signIn("auditor");
  await capture("auditor", "The auditor sees the payment references");
  await signOut();

  await signIn("admin1");
  await page.selectOption("#proposalType", "SetMaxAdvanceRate");
  await page.fill("#proposalRate", "90");
  await submit("propose");
  await page.click('button[data-governance="vote"]');
  await page.waitForFunction(() => /approved/i.test(document.querySelector("#resultBody")?.textContent || ""));
  await page.click('button[data-governance="execute"]');
  await page.waitForFunction(() => /Not enough/i.test(document.querySelector("#resultBody")?.textContent || ""));
  await capture("admin-1-refused", "One admin alone cannot change the rules");
  await signOut();

  await signIn("admin2");
  await page.click('button[data-governance="vote"]');
  await page.waitForFunction(() => /approved/i.test(document.querySelector("#resultBody")?.textContent || ""));
  await page.click('button[data-governance="execute"]');
  await page.waitForFunction(() => /Rules changed/i.test(document.querySelector("#resultBody")?.textContent || ""));
  await capture("admin-2-applied", "A second organisation approves and the change applies");
} finally {
  await writeFile(join(outDir, "steps.json"), `${JSON.stringify({ base, invoiceNumber, steps }, null, 2)}\n`);
  await context.close();
  await browser.close();
}
