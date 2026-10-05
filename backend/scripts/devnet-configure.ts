// Completes a DevNet env file from the node itself: the ledger user, the tavryn-* party
// IDs the user can act as, and the uploaded package. Rewrites only non-secret keys.
//   npx tsx scripts/devnet-configure.ts <env-file> <package-id>
import { readFileSync, writeFileSync } from "node:fs";

import { LedgerTokenProvider } from "../src/ledger-api.js";

const [file, packageId] = process.argv.slice(2);
const lines = readFileSync(file, "utf8").split("\n");
const env: Record<string, string> = {};
for (const line of lines) {
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
const get = async (path: string) =>
  (await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } })).json() as Promise<any>;

const userId = (await get("/v2/authenticated-user")).user.id as string;
const packages: string[] = (await get("/v2/packages")).packageIds;
if (!packages.includes(packageId)) throw new Error("The package is not on this node yet");
const parties = new Map<string, string>();
for (const right of (await get(`/v2/users/${userId}/rights`)).rights ?? []) {
  const party: string | undefined = right.kind?.CanActAs?.value?.party;
  const name = party?.split("::")[0].match(/tavryn-[a-z0-9-]+$/)?.[0];
  if (party && name) parties.set(name, party);
}
const need = (name: string) => {
  const party = parties.get(name);
  if (!party) throw new Error(`No actAs right for ${name}`);
  return party;
};
const values: Record<string, string> = {
  CANTON_USER_ID: userId,
  CANTON_PACKAGE_ID: packageId,
  SUPPLIER_PARTY_ID: need("tavryn-supplier"),
  BUYER_PARTY_ID: need("tavryn-buyer"),
  AUDITOR_PARTY_ID: need("tavryn-auditor"),
  TAVRYN_FINANCIERS: ["a", "b", "c"]
    .map((suffix) => `financier${suffix.toUpperCase()}:${need(`tavryn-financier-${suffix}`)}`)
    .join(","),
  GOVERNANCE_OPERATOR_ONE_PARTY_ID: need("tavryn-operator-1"),
  GOVERNANCE_OPERATOR_TWO_PARTY_ID: need("tavryn-operator-2"),
  GOVERNANCE_OPERATOR_THREE_PARTY_ID: need("tavryn-operator-3"),
  GOVERNANCE_THRESHOLD: "2",
  TAVRYN_NETWORK_ID: "tavryn",
  TAVRYN_HTTP_PORT: "18797",
};
const kept = lines.filter((line) => {
  const key = /^([A-Z0-9_]+)=/.exec(line.trim())?.[1];
  return !key || !(key in values);
});
while (kept.length && kept[kept.length - 1] === "") kept.pop();
writeFileSync(file, `${[...kept, ...Object.entries(values).map(([k, v]) => `${k}=${v}`)].join("\n")}\n`, { mode: 0o600 });
console.log(`configured ${Object.keys(values).length} keys for user ${userId}; ${parties.size} tavryn parties`);
