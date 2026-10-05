// Uploads a DAR to the configured participant through the JSON Ledger API and reports
// only the HTTP status and whether the package is now listed. Never prints the token.
// Reads TAVRYN_ENV_FILE (default .env) from the current directory.
import { config } from "dotenv";
import { readFile } from "node:fs/promises";

config({ path: process.env.TAVRYN_ENV_FILE?.trim() || ".env" });
const [darPath, packageId] = process.argv.slice(2);
if (!darPath || !packageId) {
  console.error("usage: node scripts/upload-dar.mjs <path-to-dar> <main-package-id>");
  process.exit(2);
}
const base = process.env.CANTON_LEDGER_API_URL?.replace(/\/+$/, "");
const token = process.env.CANTON_LEDGER_API_TOKEN;
const headers = token ? { Authorization: `Bearer ${token}` } : {};

const upload = await fetch(`${base}/v2/packages`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/octet-stream" },
  body: await readFile(darPath),
});
const uploadText = await upload.text();
console.log(`upload HTTP ${upload.status}${upload.ok ? "" : ` ${uploadText.slice(0, 400)}`}`);

const list = await fetch(`${base}/v2/packages`, { headers });
const listed = list.ok && (await list.json()).packageIds?.includes(packageId);
console.log(`package ${packageId} listed: ${Boolean(listed)}`);
process.exit(listed ? 0 : 1);
