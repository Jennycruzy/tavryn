// Uploads the DAR to the DevNet node with the OIDC login from the env file.
//   npx tsx scripts/devnet-upload.ts <env-file> <dar> <package-id>
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

import { LedgerTokenProvider } from "../src/ledger-api.js";

const [file, dar, packageId] = process.argv.slice(2);
const env: Record<string, string> = {};
for (const line of readFileSync(file, "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && match[2].trim() && !env[match[1]]) env[match[1]] = match[2].trim();
}
const base = env.CANTON_LEDGER_API_URL.replace(/\/+$/, "");
const token = await new LedgerTokenProvider(undefined, {
  tokenUrl: env.CANTON_OIDC_TOKEN_URL,
  clientId: env.CANTON_OIDC_CLIENT_ID,
  username: env.CANTON_OIDC_USERNAME,
  password: env.CANTON_OIDC_PASSWORD,
  audience: env.CANTON_OIDC_AUDIENCE,
  scope: env.CANTON_OIDC_SCOPE,
}).token();
const headers = { Authorization: `Bearer ${token}` };
const upload = await fetch(`${base}/v2/packages`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/octet-stream" },
  body: await readFile(dar),
});
const text = await upload.text();
console.log(`upload HTTP ${upload.status} ${upload.ok ? "" : text.slice(0, 300)}`);
const list = await fetch(`${base}/v2/packages`, { headers });
console.log(`package listed: ${list.ok && (await list.json()).packageIds?.includes(packageId)}`);
