// One-time DevNet setup: lets each lender party receive Canton Coin in one step, so a
// buyer's repayment (from Loop or the demo wallet) lands without the lender accepting it.
// The lender proposes a TransferPreapproval with the demo wallet as provider; the wallet
// accepts it, passing AmuletRules and an open round from the scan proxy as disclosed
// contracts. This is how the supplier's preapproval was made on 2026-10-06.
//   TAVRYN_ENV_FILE=<devnet env> node scripts/devnet-preapprovals.mjs
// Needs TAVRYN_DEMO_WALLET_PARTY (the provider, whose wallet pays the preapproval fee).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(process.env.TAVRYN_ENV_FILE, "utf8").split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
const form = new URLSearchParams({
  client_id: env.CANTON_OIDC_CLIENT_ID,
  grant_type: "password",
  username: env.CANTON_OIDC_USERNAME,
  password: env.CANTON_OIDC_PASSWORD,
  scope: env.CANTON_OIDC_SCOPE,
});
const token = (await (await fetch(env.CANTON_OIDC_TOKEN_URL, { method: "POST", body: form })).json()).access_token;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const ledger = env.CANTON_LEDGER_API_URL;
const validator = env.CANTON_VALIDATOR_API_URL;
const provider = env.TAVRYN_DEMO_WALLET_PARTY;
if (!provider) throw new Error("TAVRYN_DEMO_WALLET_PARTY is required");

async function call(url, body) {
  const response = await fetch(url, body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${url} ${response.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function active(party, templateId) {
  const end = (await call(`${ledger}/v2/state/ledger-end`)).offset;
  const rows = await call(`${ledger}/v2/state/active-contracts`, {
    activeAtOffset: end,
    eventFormat: {
      filtersByParty: { [party]: { cumulative: [{ identifierFilter: { TemplateFilter: { value: { templateId, includeCreatedEventBlob: false } } } }] } },
      verbose: true,
    },
  });
  return rows.map((row) => row.contractEntry?.JsActiveContract?.createdEvent).filter(Boolean);
}

async function submit(actAs, command, disclosedContracts = []) {
  return call(`${ledger}/v2/commands/submit-and-wait-for-transaction`, {
    commands: {
      commands: [command],
      commandId: `tavryn-preapproval-${randomUUID()}`,
      actAs,
      userId: env.CANTON_USER_ID,
      disclosedContracts,
    },
  });
}

const lenders = env.TAVRYN_FINANCIERS.split(",").map((entry) => {
  const at = entry.indexOf(":");
  return { role: entry.slice(0, at), party: entry.slice(at + 1) };
});

for (const { role, party } of lenders) {
  const existing = (await active(party, "#splice-amulet:Splice.AmuletRules:TransferPreapproval"))
    .filter((event) => event.createArgument.receiver === party);
  if (existing.length) {
    console.log(`${role}: already receives (expires ${existing[0].createArgument.expiresAt})`);
    continue;
  }

  const rules = (await call(`${validator}/v0/scan-proxy/amulet-rules`)).amulet_rules;
  const rounds = (await call(`${validator}/v0/scan-proxy/open-and-issuing-mining-rounds`)).open_mining_rounds
    .map((entry) => entry.contract)
    .filter((contract) => new Date(contract.payload.opensAt) <= new Date())
    .sort((a, b) => new Date(b.payload.opensAt) - new Date(a.payload.opensAt));
  if (!rounds.length) throw new Error("No open mining round");
  const round = rounds[0];
  const dso = rules.contract.payload.dso;

  const proposal = await submit([party], {
    CreateCommand: {
      templateId: "#splice-wallet:Splice.Wallet.TransferPreapproval:TransferPreapprovalProposal",
      createArguments: { receiver: party, provider, expectedDso: dso },
    },
  });
  const proposalCid = proposal.transaction.events
    .map((event) => event.CreatedEvent)
    .find((event) => event && event.templateId.endsWith(":TransferPreapprovalProposal")).contractId;

  const coins = (await active(provider, "#splice-amulet:Splice.Amulet:Amulet"))
    .filter((event) => event.createArgument.owner === provider)
    .sort((a, b) => Number(b.createArgument.amount.initialAmount) - Number(a.createArgument.amount.initialAmount));
  if (!coins.length) throw new Error("The demo wallet holds no coins to pay the preapproval fee");

  const expiresAt = new Date(Date.now() + 89 * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z");
  const disclosed = (contract) => ({
    templateId: contract.template_id,
    contractId: contract.contract_id,
    createdEventBlob: contract.created_event_blob,
    synchronizerId: rules.domain_id,
  });
  const accepted = await submit(
    [provider],
    {
      ExerciseCommand: {
        templateId: "#splice-wallet:Splice.Wallet.TransferPreapproval:TransferPreapprovalProposal",
        contractId: proposalCid,
        choice: "TransferPreapprovalProposal_Accept",
        choiceArgument: {
          context: {
            amuletRules: rules.contract.contract_id,
            context: { openMiningRound: round.contract_id, issuingMiningRounds: [], validatorRights: [] },
          },
          inputs: [{ tag: "InputAmulet", value: coins[0].contractId }],
          expiresAt,
        },
      },
    },
    [disclosed(rules.contract), disclosed(round)],
  );
  console.log(`${role}: receives now (proposal ${proposal.transaction.updateId.slice(0, 16)}…, accepted ${accepted.transaction.updateId.slice(0, 16)}…)`);
}
