import { loadConfig } from "./config.js";
import { TavrynService } from "./tavryn-service.js";

// Idempotent: finds or creates the committee, first rules and the buyer's registry for
// TAVRYN_NETWORK_ID, verifies the configured package is on the participant, and
// prints the contract IDs. Re-running it changes nothing once the network exists.
const config = loadConfig();
const service = new TavrynService(config);

if (config.packageId) {
  const packages = await service.ledger.packageIds();
  if (!packages.includes(config.packageId)) {
    throw new Error("CANTON_PACKAGE_ID is not uploaded to this participant");
  }
}
if (config.userId) {
  const rights = await service.ledger.userRights(config.userId);
  const actAs = new Set(
    rights.filter((right) => right.kind === "CanActAs").map((right) => right.party),
  );
  const needed: Array<[string, string]> = [
    ["supplier", config.parties.supplier],
    ["buyer", config.parties.buyer],
    ["auditor", config.parties.auditor],
    ...[...config.financiers.entries()],
    ...config.governance.operatorPartyIds.map(
      (party, index): [string, string] => [`operator${index + 1}`, party],
    ),
  ];
  const missing = needed.filter(([, party]) => !actAs.has(party));
  if (missing.length > 0 && !rights.some((right) => right.kind === "CanActAsAnyParty")) {
    // A participant admin (LocalNet) can grant itself the missing rights; a guest user
    // on a shared node cannot, and must have them granted in the node console.
    if (!rights.some((right) => right.kind === "ParticipantAdmin")) {
      throw new Error(
        `The ledger user cannot act as: ${missing.map(([role]) => role).join(", ")}`,
      );
    }
    await service.ledger.grantActAs(
      config.userId,
      missing.map(([, party]) => party),
    );
    console.error(`Granted actAs for: ${missing.map(([role]) => role).join(", ")}`);
  }
}

console.log(JSON.stringify(await service.bootstrapNetwork(), null, 2));
