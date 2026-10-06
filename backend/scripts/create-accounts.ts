// Writes the company accounts file that TAVRYN_ACCOUNTS_FILE points to.
//   npx tsx scripts/create-accounts.ts <path> [--demo]
// With --demo every account gets a password that the sign-in page publishes, so anyone
// can try the demo; the companies are fictional. Without it, random passwords are
// generated and printed once. Keep the file outside the repository.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

import { hashPassword } from "../src/accounts.js";

const [path, flag] = process.argv.slice(2);
if (!path) {
  console.error("Usage: npx tsx scripts/create-accounts.ts <path> [--demo]");
  process.exit(1);
}
const demo = flag === "--demo";

const companies = [
  { email: "accounts@adeyemi-packaging.demo", name: "Adeyemi Packaging Ltd", role: "supplier", demoPassword: "adeyemi-demo" },
  { email: "payables@sunrise-foods.demo", name: "Sunrise Foods plc", role: "buyer", demoPassword: "sunrise-demo" },
  { email: "credit@lender-a.demo", name: "Lender A", role: "financierA", demoPassword: "lender-a-demo" },
  { email: "credit@lender-b.demo", name: "Lender B", role: "financierB", demoPassword: "lender-b-demo" },
  { email: "credit@lender-c.demo", name: "Lender C", role: "financierC", demoPassword: "lender-c-demo" },
  { email: "audit@auditor.demo", name: "Auditor", role: "auditor", demoPassword: "auditor-demo" },
  { email: "admin@network-1.demo", name: "Network admin 1", role: "operator", operatorIndex: "1", demoPassword: "admin-1-demo" },
  { email: "admin@network-2.demo", name: "Network admin 2", role: "operator", operatorIndex: "2", demoPassword: "admin-2-demo" },
  { email: "admin@network-3.demo", name: "Network admin 3", role: "operator", operatorIndex: "3", demoPassword: "admin-3-demo" },
  { email: "presenter@tavryn.demo", name: "Demo presenter", role: "presenter", demoPassword: "presenter-demo" },
];

const accounts = companies.map(({ demoPassword, ...company }) => {
  const password = demo ? demoPassword : randomBytes(9).toString("base64url");
  if (!demo) console.log(`${company.email}  ${password}`);
  return { ...company, passwordHash: hashPassword(password), ...(demo ? { demoPassword } : {}) };
});

writeFileSync(
  path,
  `${JSON.stringify({ sessionSecret: randomBytes(32).toString("hex"), accounts }, null, 2)}\n`,
  { mode: 0o600 },
);
console.log(`Wrote ${accounts.length} accounts to ${path}`);
