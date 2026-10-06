const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const out = process.argv[2];
const browser = await chromium.launch();
const results = [];
for (const [name, url, w] of [["landing-desktop","https://tavryn.site/",1366],["landing-phone","https://tavryn.site/",390],["app-supplier","https://tavryn.site/app",1366],["app-financierB","https://tavryn.site/app#financierB",1366],["www","https://www.tavryn.site/",1366]]) {
  const context = await browser.newContext({ viewport: { width: w, height: 900 } }); // fresh, no cookies or storage
  const page = await context.newPage();
  const errors = []; const failed = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  page.on("requestfailed", r => failed.push(r.url()));
  page.on("response", r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  const title = await page.title();
  const hScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: name.startsWith("landing") });
  results.push({ name, url, status: res.status(), finalUrl: page.url(), title, horizontalScroll: hScroll, consoleErrors: errors, failedRequests: failed });
  await context.close();
}
await browser.close();
console.log(JSON.stringify({ date: new Date().toISOString(), method: "fresh Chromium contexts with no cookies or storage (equivalent to a private window), headless, from the VPS", results }, null, 2));
