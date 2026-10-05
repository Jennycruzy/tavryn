// Allocates Tavryn's demo parties on a shared DevNet node and grants the team's ledger
// user actAs on them, if the node permits it. Prints party IDs only (not secret).
//   npx tsx scripts/devnet-parties.ts <env-file> [hint ...]
import { readFileSync } from "node:fs";

import { LedgerTokenProvider } from "../src/ledger-api.js";

const [file, ...hints] = process.argv.slice(2);
const env: Record<string, string> = {};
for (const line of readFileSync(file, "utf8").split("\n")) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (match && match[2].trim() && !env[match[1]]) env[match[1]] = match[2].trim();
}
const base = env.CANTON_LEDGER_API_URL.replace(/\/+$/, "");
const tokens = new LedgerTokenProvider(undefined, {
  tokenUrl: env.CANTON_OIDC_TOKEN_URL,
  clientId: env.CANTON_OIDC_CLIENT_ID,
  username: env.CANTON_OIDC_USERNAME,
  password: env.CANTON_OIDC_PASSWORD,
  audience: env.CANTON_OIDC_AUDIENCE,
  scope: env.CANTON_OIDC_SCOPE,
});
const token = await tokens.token();
const claims = JSON.parse(Buffer.from(token!.split(".")[1], "base64url").toString("utf8"));
const userId: string = claims.sub;

async function post(path: string, body: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* keep text */ }
  return { status: response.status, body: parsed };
}

for (const hint of hints) {
  const allocated = await post("/v2/parties", { partyIdHint: hint, identityProviderId: "", userId });
  if (allocated.status !== 200) {
    console.log(`${hint}: allocate HTTP ${allocated.status} ${allocated.body?.code ?? ""} ${String(allocated.body?.cause ?? "").slice(0, 160)}`);
    continue;
  }
  const party = allocated.body.partyDetails?.party;
  const granted = await post(`/v2/users/${encodeURIComponent(userId)}/rights`, {
    userId,
    identityProviderId: "",
    rights: [{ kind: { CanActAs: { value: { party } } } }],
  });
  console.log(`${hint}: ${party} | actAs grant HTTP ${granted.status} ${granted.status === 200 ? "" : granted.body?.code ?? ""}`);
}
