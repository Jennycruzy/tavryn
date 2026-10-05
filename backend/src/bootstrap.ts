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
  const needed = [
    config.parties.supplier,
    config.parties.buyer,
    config.parties.auditor,
    ...config.financiers.values(),
    ...config.governance.operatorPartyIds,
  ];
  const missing = needed.filter((party) => !actAs.has(party)).length;
  if (missing > 0 && !rights.some((right) => right.kind === "CanActAsAnyParty")) {
    throw new Error(`The ledger user cannot act as ${missing} configured part(ies)`);
  }
}

console.log(JSON.stringify(await service.bootstrapNetwork(), null, 2));
