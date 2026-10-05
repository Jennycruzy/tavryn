// Read-only DevNet readiness check. Logs in with the OIDC settings in the env file,
// then reports what the ledger user can do. Prints no token, password or secret.
//   npx tsx scripts/devnet-check.ts .env.devnet
import { readFileSync } from "node:fs";

import { LedgerTokenProvider } from "../src/ledger-api.js";

const file = process.argv[2] ?? ".env.devnet";
// First non-empty value wins, so a template's blank duplicate cannot erase a filled key.
const env: Record<string, string> = {};
for (const line of readFileSync(file, "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && match[2].trim() && !env[match[1]]) env[match[1]] = match[2].trim();
}

// Command-line environment overrides the file, for trying another client ID.
for (const key of ["CANTON_OIDC_CLIENT_ID", "CANTON_OIDC_SCOPE", "CANTON_USER_ID"]) {
  if (process.env[key]) env[key] = process.env[key] as string;
}
const filled = Object.keys(env).sort();
console.log("keys with values:", filled.join(", "));
const base = env.CANTON_LEDGER_API_URL?.replace(/\/+$/, "");
if (!base || !env.CANTON_OIDC_TOKEN_URL || !env.CANTON_OIDC_CLIENT_ID) {
  console.log("missing: CANTON_LEDGER_API_URL, CANTON_OIDC_TOKEN_URL or CANTON_OIDC_CLIENT_ID");
  process.exit(1);
}

const tokens = new LedgerTokenProvider(env.CANTON_LEDGER_API_TOKEN, {
  tokenUrl: env.CANTON_OIDC_TOKEN_URL,
  clientId: env.CANTON_OIDC_CLIENT_ID,
  clientSecret: env.CANTON_OIDC_CLIENT_SECRET,
  username: env.CANTON_OIDC_USERNAME,
  password: env.CANTON_OIDC_PASSWORD,
  refreshToken: env.CANTON_OIDC_REFRESH_TOKEN,
  audience: env.CANTON_OIDC_AUDIENCE,
  scope: env.CANTON_OIDC_SCOPE,
});

let token: string | undefined;
try {
  token = await tokens.token();
  const claims = JSON.parse(Buffer.from(token!.split(".")[1], "base64url").toString("utf8"));
  console.log("login: OK; token expires", new Date(claims.exp * 1000).toISOString(),
    "| subject", claims.sub, "| audience", JSON.stringify(claims.aud), "| scope", claims.scope);
} catch (error) {
  console.log("login: FAILED", (error as { status?: number }).status ?? "", (error as { payload?: unknown }).payload ?? "");
  process.exit(1);
}

async function get(path: string) {
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  return { status: response.status, body };
}

const me = await get("/v2/authenticated-user");
console.log("authenticated-user:", me.status, me.status === 200 ? JSON.stringify(me.body.user ?? me.body) : JSON.stringify(me.body).slice(0, 300));
const userId = me.body?.user?.id ?? env.CANTON_USER_ID;
if (userId) {
  const rights = await get(`/v2/users/${encodeURIComponent(userId)}/rights`);
  if (rights.status === 200) {
    const summary: Record<string, string[]> = {};
    for (const right of rights.body.rights ?? []) {
      for (const [kind, detail] of Object.entries<any>(right.kind ?? {})) {
        (summary[kind] ??= []).push(detail?.value?.party ?? "");
      }
    }
    for (const [kind, parties] of Object.entries(summary)) {
      console.log(`rights ${kind}: ${parties.length}`, parties.filter(Boolean).map((party) => party.split("::")[0]).join(", "));
    }
  } else {
    console.log("rights:", rights.status, JSON.stringify(rights.body).slice(0, 300));
  }
}
const end = await get("/v2/state/ledger-end");
console.log("ledger-end:", end.status, JSON.stringify(end.body).slice(0, 120));
const packages = await get("/v2/packages");
console.log("packages visible:", packages.status, Array.isArray(packages.body?.packageIds) ? packages.body.packageIds.length : JSON.stringify(packages.body).slice(0, 200));
