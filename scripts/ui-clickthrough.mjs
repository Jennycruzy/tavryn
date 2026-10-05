// Records a real browser session through the running Tavryn UI: create, approve, two
// private offers, Financier A funds with Canton Coin, Financier B is left with "no
// longer available", repayment, the auditor trail, then a governance change refused
// below the threshold and applied at it. Saves screenshots, a video and a JSON summary.
//
//   TAVRYN_UI_URL=http://127.0.0.1:18787 CANTON_COIN_SYMBOL=AMT \
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   node scripts/ui-clickthrough.mjs docs/evidence/P5_CLICKTHROUGH_<date>
import { mkdir, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.TAVRYN_UI_URL || "http://127.0.0.1:18787";
const currency = process.env.CANTON_COIN_SYMBOL;
const outDir = process.argv[2];
if (!currency || !outDir) {
  console.error("CANTON_COIN_SYMBOL and an output directory are required");
  process.exit(2);
}
await mkdir(outDir, { recursive: true });

const invoiceNumber = `TVN-UI-${Date.now().toString(36).toUpperCase()}`;
const steps = [];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  recordVideo: { dir: outDir, size: { width: 1440, height: 1100 } },
});
const page = await context.newPage();
page.on("dialog", (dialog) => dialog.dismiss());

async function role(name) {
  await page.click(`#roleButtons button[data-role="${name}"]`);
  // Wait until the role's ledger view has loaded and the buttons are enabled again.
  await page.waitForFunction(
    (label) =>
      document.querySelector("#contractsTitle")?.textContent?.startsWith(label) &&
      [...document.querySelectorAll("button")].every((button) => !button.disabled || button.textContent.includes("voted")),
    roleLabel(name),
    { timeout: 60_000 },
  );
  await page.waitForTimeout(500);
}

function roleLabel(name) {
  if (name.startsWith("financier")) return `Financier ${name.slice("financier".length)}`;
  return { supplier: "Supplier", buyer: "Buyer", auditor: "Auditor", operator: "Operators" }[name];
}

async function selectByLabel(selector, text) {
  const value = await page.$eval(
    selector,
    (select, wanted) => [...select.options].find((option) => option.textContent.includes(wanted))?.value,
    text,
  );
  if (!value) throw new Error(`No option containing ${text} in ${selector}`);
  await page.selectOption(selector, value);
}

// Each action starts from an empty result panel, so a status left over from the
// previous step can never be mistaken for this one.
async function act(clickable) {
  await page.evaluate(() => {
    document.querySelector("#resultBody").innerHTML = "";
  });
  await clickable.click();
}

async function result(expectedStatus, name) {
  await page.waitForFunction(
    (status) => document.querySelector("#resultBody .result-status")?.textContent === status,
    expectedStatus,
    { timeout: 120_000 },
  );
  const status = await page.textContent("#resultBody .result-status");
  const message = await page.textContent("#resultBody .result-message");
  const references = await page.$$eval("#resultBody .result-reference code", (codes) =>
    codes.map((code) => code.getAttribute("title")),
  );
  const screenshot = `${String(steps.length + 1).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: join(outDir, screenshot), fullPage: true });
  steps.push({ step: name, status, message, references, screenshot });
}

async function snapshot(name, check) {
  await page.waitForFunction(check.fn, check.arg, { timeout: 30_000 });
  const screenshot = `${String(steps.length + 1).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: join(outDir, screenshot), fullPage: true });
  steps.push({ step: name, screenshot, verified: check.description });
}

try {
  await page.goto(baseUrl);
  await page.waitForSelector('#roleButtons button[data-role="supplier"]');

  await role("supplier");
  await page.fill("#externalInvoiceNumber", invoiceNumber);
  await page.fill("#faceValue", "1.00");
  await page.fill("#currency", currency);
  await page.fill("#issuedDate", "2026-09-01");
  await page.fill("#dueDate", "2026-12-01");
  await act(page.locator('form[data-action="create-draft"] button[type="submit"]'));
  await result("DRAFT CREATED", "supplier-creates-draft");

  await role("buyer");
  await selectByLabel("#draftCid", invoiceNumber);
  for (const box of await page.$$('input[name="eligible"]')) {
    const value = await box.getAttribute("value");
    if (value !== "financierA" && value !== "financierB") await box.uncheck();
  }
  await act(page.locator('form[data-action="approve"] button[type="submit"]'));
  await result("APPROVED ONCE", "buyer-approves-once");

  await role("supplier");
  for (const [financier, advance] of [["financierA", "0.90"], ["financierB", "0.88"]]) {
    await selectByLabel("#approvedCid", invoiceNumber);
    await page.selectOption("#offerFinancier", financier);
    await page.fill("#offerAdvance", advance);
    await page.fill("#offerRate", advance);
    await act(page.locator('form[data-action="create-offer"] button[type="submit"]'));
    await result("OFFER CREATED", `supplier-offers-${financier}`);
  }

  await role("financierB");
  await snapshot("financierB-sees-only-own-offer", {
    fn: (number) =>
      [...document.querySelectorAll("#offerCid option")].filter((option) => option.textContent.includes(number)).length === 1,
    arg: invoiceNumber,
    description: "Before funding, Financier B sees exactly one offer for this invoice: its own",
  });

  await role("financierA");
  await selectByLabel("#offerCid", invoiceNumber);
  await act(page.locator('form[data-action="fund"] button[type="submit"]'));
  await result("FUNDED ONCE", "financierA-funds-with-canton-coin");

  await role("financierB");
  await snapshot("financierB-no-longer-available", {
    fn: (number) =>
      document.querySelector("#actionBody")?.textContent?.includes("This invoice is no longer available") &&
      ![...document.querySelectorAll("#offerCid option")].some((option) => option.textContent.includes(number)),
    arg: invoiceNumber,
    description: "Financier B's offer for this invoice is closed and cannot be funded; no winner or terms shown",
  });

  await role("buyer");
  await selectByLabel("#financedCid", invoiceNumber);
  await page.fill("#repaymentDate", "2026-10-05");
  await act(page.locator('form[data-action="repay"] button[type="submit"]'));
  await result("REPAID", "buyer-repays-with-canton-coin");

  await role("auditor");
  await snapshot("auditor-trail", {
    fn: () =>
      [...document.querySelectorAll(".contract-name")].some((node) => node.textContent === "Funding receipt") &&
      [...document.querySelectorAll(".contract-name")].some((node) => node.textContent === "Repayment receipt"),
    arg: null,
    description: "Auditor sees funding and repayment receipts",
  });

  await role("operator");
  // Propose a rate that differs from the current ceiling.
  const currentRate = await page.textContent("#rulesState");
  const rate = currentRate.startsWith("0.92") ? "0.93" : "0.92";
  const proposalText = `Set maximum advance rate to ${rate}`;
  await page.selectOption("#proposalType", "SetMaxAdvanceRate");
  await page.fill("#proposalRate", rate);
  await page.selectOption("#proposalOperator", "1");
  await act(page.locator('form[data-action="propose"] button[type="submit"]'));
  await result("PROPOSED", "operator-proposes-rate-change");
  const card = page.locator("article", { hasText: proposalText }).first();
  await act(card.locator('button[data-governance="vote"][data-operator="1"]'));
  await result("VOTE RECORDED", "operator1-votes");
  await act(page.locator("article", { hasText: proposalText }).first()
    .locator('button[data-governance="execute"]'));
  await result("BELOW THRESHOLD", "execute-refused-below-threshold");
  await act(page.locator("article", { hasText: proposalText }).first()
    .locator('button[data-governance="vote"][data-operator="2"]'));
  await result("VOTE RECORDED", "operator2-votes");
  await act(page.locator("article", { hasText: proposalText }).first()
    .locator('button[data-governance="execute"]'));
  await result("RULES CHANGED", "execute-at-threshold");
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    const recorded = await video.path();
    await rename(recorded, join(outDir, "clickthrough.webm"));
  }
}

await writeFile(
  join(outDir, "summary.json"),
  `${JSON.stringify(
    {
      date: new Date().toISOString(),
      url: baseUrl,
      browser: `Chromium (Playwright) headless`,
      invoiceNumber,
      video: "clickthrough.webm",
      steps,
      files: await readdir(outDir),
    },
    null,
    2,
  )}\n`,
);
console.log(JSON.stringify(steps.map((step) => [step.step, step.status ?? "verified"])));
