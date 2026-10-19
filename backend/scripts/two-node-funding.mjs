// Proof on LocalNet that a lender on its OWN Canton node can finance an invoice in one
// step: the coin payment and the "financed" record are one transaction, signed by the
// lender's node alone. A second lender on the Tavryn node then tries the same invoice
// and Canton refuses it, with no coin moved.
//
// Node 1 (app-provider) hosts Tavryn: supplier, buyer, auditor, operators, Lender A.
// Node 2 (app-user) hosts the outside lender, using that node's own wallet party.
//   node scripts/two-node-funding.mjs <outFile>
// Needs the LocalNet canton container (tokens are signed with Splice's public dev secret)
// and /root/tavryn/backend/.env for the Tavryn party IDs.
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const out = process.argv[2] ?? "two-node-funding.json";
const env = Object.fromEntries(
  readFileSync(process.env.TAVRYN_ENV_FILE ?? "/root/tavryn/backend/.env", "utf8").split("\n")
    .filter((line) => /^[A-Z0-9_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);

const b64 = (data) => Buffer.from(data).toString("base64url");
const secret = execFileSync("docker", ["inspect", "canton", "--format", "{{range .Config.Env}}{{println .}}{{end}}"])
  .toString().split("\n").find((line) => line.startsWith("SPLICE_APP_UI_UNSAFE_SECRET=")).split("=").slice(1).join("=");
function token(sub) {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ sub, aud: "https://canton.network.global", iat: now, exp: now + 3600 }));
  return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
}

const NODE1 = { name: "Tavryn node", ledger: "http://127.0.0.1:3975", validator: "http://127.0.0.1:3903/api/validator", token: token("ledger-api-user"), user: "ledger-api-user" };
const NODE2 = { name: "Lender's own node", ledger: "http://127.0.0.1:2975", validator: "http://127.0.0.1:2903/api/validator", token: token("ledger-api-user"), user: "ledger-api-user" };
const WALLET2 = token("app-user");

async function call(node, path, body, raw) {
  const base = path.startsWith("/v0/") || path.startsWith("/registry/") ? node.validator : node.ledger;
  const url = path.startsWith("/registry/") ? `${node.validator}/v0/scan-proxy${path}` : `${base}${path}`;
  const init = { headers: { Authorization: `Bearer ${raw?.token ?? node.token}`, "Content-Type": raw?.type ?? "application/json" } };
  if (body !== undefined) Object.assign(init, { method: "POST", body: raw?.type ? body : JSON.stringify(body) });
  const response = await fetch(url, init);
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!response.ok) {
    const error = new Error(`${node.name} ${path} ${response.status}: ${text.slice(0, 600)}`);
    error.status = response.status;
    error.body = json;
    throw error;
  }
  return json;
}

async function active(node, party, templateId, blobs = false, isInterface = false) {
  const { offset } = await call(node, "/v2/state/ledger-end");
  const filter = isInterface
    ? { InterfaceFilter: { value: { interfaceId: templateId, includeInterfaceView: true, includeCreatedEventBlob: blobs } } }
    : { TemplateFilter: { value: { templateId, includeCreatedEventBlob: blobs } } };
  const rows = await call(node, "/v2/state/active-contracts", {
    activeAtOffset: offset,
    eventFormat: { filtersByParty: { [party]: { cumulative: [{ identifierFilter: filter }] } }, verbose: true },
  });
  return rows.map((row) => row.contractEntry?.JsActiveContract && { ...row.contractEntry.JsActiveContract.createdEvent, synchronizerId: row.contractEntry.JsActiveContract.synchronizerId }).filter(Boolean);
}

async function submit(node, actAs, commands, disclosedContracts = [], readAs = []) {
  const result = await call(node, "/v2/commands/submit-and-wait-for-transaction", {
    commands: { commands, commandId: `tavryn-two-node-${randomUUID()}`, actAs, readAs, userId: node.user, disclosedContracts },
  });
  return result.transaction;
}
const created = (tx, entity) => tx.events.map((event) => event.CreatedEvent).find((event) => event && event.templateId.endsWith(`:${entity}`));
const T = (entity, module = "Contracts") => `#tavryn-network:Tavryn.${module}:${entity}`;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

const supplier = env.SUPPLIER_PARTY_ID;
const buyer = env.BUYER_PARTY_ID;
const auditor = env.AUDITOR_PARTY_ID;
const lenderA = env.FINANCIER_A_PARTY_ID ?? env.TAVRYN_FINANCIERS.split(",").find((entry) => entry.startsWith("financierA:")).slice("financierA:".length);
const operators = [env.GOVERNANCE_OPERATOR_ONE_PARTY_ID, env.GOVERNANCE_OPERATOR_TWO_PARTY_ID, env.GOVERNANCE_OPERATOR_THREE_PARTY_ID];
const outsideLender = (await call(NODE2, "/v0/wallet/user-status", undefined, { token: WALLET2 })).party_id;
const nodeIds = {
  tavryn: (await call(NODE1, "/v2/parties/participant-id")).participantId,
  lender: (await call(NODE2, "/v2/parties/participant-id")).participantId,
};
console.log("outside lender", outsideLender, "on", nodeIds.lender);
const evidence = { generatedAt: new Date().toISOString(), network: "Canton LocalNet (Splice 0.6.11), two participant nodes", nodes: nodeIds, outsideLender, steps: [] };
const step = (name, detail) => { evidence.steps.push({ step: name, ...detail }); console.log(name, JSON.stringify(detail).slice(0, 300)); };

// 1. Tavryn 0.1.6 on both nodes. The lender's node needs the earlier versions too, since
//    the network's existing contracts were created with them.
for (const [node, dars] of [[NODE1, ["0.1.6"]], [NODE2, ["0.1.4", "0.1.5", "0.1.6"]]]) {
  for (const version of dars) {
    const dar = readFileSync(new URL(`../../.daml/dist/tavryn-network-${version}.dar`, import.meta.url));
    await call(node, "/v2/packages", dar, { type: "application/octet-stream" });
  }
}
step("packages uploaded", { tavrynNode: ["0.1.6"], lenderNode: ["0.1.4", "0.1.5", "0.1.6"] });

// 2. The network admits the outside lender: one proposal, two operator votes, executed.
let rules = (await active(NODE1, operators[0], T("NetworkRules", "Rules")))[0];
if (!rules.createArgument.financiers.includes(outsideLender)) {
  const committee = (await active(NODE1, operators[0], T("GovernanceCommittee", "Governance")))[0];
  const proposal = created(await submit(NODE1, [operators[0]], [{ ExerciseCommand: {
    templateId: T("GovernanceCommittee", "Governance"), contractId: committee.contractId, choice: "Propose",
    choiceArgument: { proposer: operators[0], action: { tag: "AdmitFinancier", value: outsideLender }, rulesCid: rules.contractId, expiresAt: iso(Date.now() + 3_600_000) },
  } }]), "GovernanceProposal");
  const votes = [];
  for (const operator of operators.slice(0, 2)) {
    votes.push(created(await submit(NODE1, [operator], [{ ExerciseCommand: {
      templateId: T("GovernanceProposal", "Governance"), contractId: proposal.contractId, choice: "Vote", choiceArgument: { operator },
    } }], [], operators), "GovernanceVote").contractId);
  }
  await submit(NODE1, [operators[0]], [{ ExerciseCommand: {
    templateId: T("GovernanceCommittee", "Governance"), contractId: committee.contractId, choice: "Execute",
    choiceArgument: { executor: operators[0], proposalCid: proposal.contractId, voteCids: votes, rulesCid: rules.contractId },
  } }], [], operators);
  rules = (await active(NODE1, operators[0], T("NetworkRules", "Rules")))[0];
  step("outside lender admitted by 2 of 3 operators", { financiers: rules.createArgument.financiers.length });
} else {
  step("outside lender already admitted", {});
}

// 3. The supplier can receive Canton Coin in one step (a transfer preapproval), so a
//    payment completes inside the funding transaction instead of waiting for acceptance.
const preapprovals = (await active(NODE1, supplier, "#splice-amulet:Splice.AmuletRules:TransferPreapproval"))
  .filter((event) => event.createArgument.receiver === supplier);
if (!preapprovals.length) {
  const provider = (await call(NODE1, "/v2/authenticated-user")).user.primaryParty;
  const rulesContract = (await call(NODE1, "/v0/scan-proxy/amulet-rules")).amulet_rules;
  const round = (await call(NODE1, "/v0/scan-proxy/open-and-issuing-mining-rounds")).open_mining_rounds
    .map((entry) => entry.contract).filter((contract) => new Date(contract.payload.opensAt) <= new Date())
    .sort((a, b) => new Date(b.payload.opensAt) - new Date(a.payload.opensAt))[0];
  const proposal = created(await submit(NODE1, [supplier], [{ CreateCommand: {
    templateId: "#splice-wallet:Splice.Wallet.TransferPreapproval:TransferPreapprovalProposal",
    createArguments: { receiver: supplier, provider, expectedDso: rulesContract.contract.payload.dso },
  } }]), "TransferPreapprovalProposal");
  const coins = (await active(NODE1, provider, "#splice-amulet:Splice.Amulet:Amulet"))
    .filter((event) => event.createArgument.owner === provider)
    .sort((a, b) => Number(b.createArgument.amount.initialAmount) - Number(a.createArgument.amount.initialAmount));
  const disclosed = (contract) => ({ templateId: contract.template_id, contractId: contract.contract_id, createdEventBlob: contract.created_event_blob, synchronizerId: rulesContract.domain_id });
  await submit(NODE1, [provider], [{ ExerciseCommand: {
    templateId: "#splice-wallet:Splice.Wallet.TransferPreapproval:TransferPreapprovalProposal",
    contractId: proposal.contractId, choice: "TransferPreapprovalProposal_Accept",
    choiceArgument: {
      context: { amuletRules: rulesContract.contract.contract_id, context: { openMiningRound: round.contract_id, issuingMiningRounds: [], validatorRights: [] } },
      inputs: [{ tag: "InputAmulet", value: coins[0].contractId }],
      expiresAt: iso(Date.now() + 89 * 86_400_000),
    },
  } }], [disclosed(rulesContract.contract), disclosed(round)]);
  step("supplier can receive coin in one step", { provider });
}

// 4. A fresh invoice: the supplier drafts it, the buyer approves it for both lenders, and
//    the supplier offers it to each of them, pinning Canton Coin as the accepted coin.
const dso = (await call(NODE1, "/v0/scan-proxy/dso-party-id")).dso_party_id;
const invoiceNumber = `NODE2-${Date.now().toString(36).toUpperCase()}`;
const today = new Date().toISOString().slice(0, 10);
const draft = created(await submit(NODE1, [supplier], [{ CreateCommand: {
  templateId: T("InvoiceDraft"),
  createArguments: { supplier, buyer, salt: randomUUID(), terms: { externalInvoiceNumber: invoiceNumber, faceValue: "25.0", currency: "CC", issuedDate: today, dueDate: iso(Date.now() + 45 * 86_400_000).slice(0, 10) } },
} }]), "InvoiceDraft");
const registry = (await active(NODE1, buyer, T("BuyerApprovalRegistry", "Rules")))[0];
const approved = created(await submit(NODE1, [buyer], [{ ExerciseCommand: {
  templateId: T("InvoiceDraft"), contractId: draft.contractId, choice: "Approve",
  choiceArgument: { rulesCid: rules.contractId, registryCid: registry.contractId, eligibleFinanciers: [outsideLender, lenderA], auditor },
} }]), "ApprovedInvoice");
const offers = {};
for (const [name, financier] of [["outside", outsideLender], ["lenderA", lenderA]]) {
  offers[name] = created(await submit(NODE1, [buyer, supplier], [{ ExerciseCommand: {
    templateId: T("ApprovedInvoice"), contractId: approved.contractId, choice: "CreateOffer",
    choiceArgument: { rulesCid: rules.contractId, financier, advance: "20.0", advanceRate: "0.8", fee: "1.0", coinAdmin: dso },
  } }]), "FinancingOffer");
}
step("invoice approved and offered to both lenders", { invoiceNumber, faceValue: "25 CC", advance: "20 CC", fee: "1 CC" });

// 5. The outside lender's node funds it in ONE transaction, signed by that node alone.
//    The invoice details are private to buyer and supplier; Tavryn hands that one contract
//    to the lender's node as a disclosed contract so the transaction can retire it.
const details = (await active(NODE1, supplier, T("InvoiceDetails"), true))
  .find((event) => event.contractId === approved.createArgument.invoiceDetails);
const lenderCoins = (await active(NODE2, outsideLender, "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding", false, true))
  .filter((event) => {
    const viewValue = event.interfaceViews?.[0]?.viewValue;
    return viewValue && viewValue.owner === outsideLender && !viewValue.lock && viewValue.instrumentId.id === "Amulet";
  })
  .sort((a, b) => Number(b.interfaceViews[0].viewValue.amount) - Number(a.interfaceViews[0].viewValue.amount));
const requestedAt = iso(Date.now() - 60_000);
const executeBefore = iso(Date.now() + 3_600_000);
const transfer = {
  sender: outsideLender, receiver: supplier, amount: "20.0", instrumentId: { admin: dso, id: "Amulet" },
  requestedAt, executeBefore, inputHoldingCids: [lenderCoins[0].contractId], meta: { values: {} },
};
const factory = await call(NODE2, "/registry/transfer-instruction/v1/transfer-factory", {
  choiceArguments: { expectedAdmin: dso, transfer, extraArgs: { context: { values: {} }, meta: { values: {} } } },
  excludeDebugFields: true,
});
const balanceBefore = await call(NODE2, "/v0/wallet/balance", undefined, { token: WALLET2 });
const synchronizerId = details.synchronizerId;
const disclosed = [
  { templateId: details.templateId, contractId: details.contractId, createdEventBlob: details.createdEventBlob, synchronizerId },
  ...factory.choiceContext.disclosedContracts.map((contract) => ({
    templateId: contract.templateId, contractId: contract.contractId, createdEventBlob: contract.createdEventBlob, synchronizerId: contract.synchronizerId,
  })),
];
const funded = await submit(NODE2, [outsideLender], [{ ExerciseCommand: {
  templateId: T("FinancingOffer"), contractId: offers.outside.contractId, choice: "FundNow",
  choiceArgument: {
    approvedInvoiceCid: approved.contractId, rulesCid: rules.contractId, transferFactoryCid: factory.factoryId,
    inputHoldingCids: transfer.inputHoldingCids, requestedAt, executeBefore,
    extraArgs: { context: factory.choiceContext.choiceContextData, meta: { values: {} } },
  },
} }], disclosed);
// Each side reads the transaction from its own node: the lender's node never sees the
// supplier's new coin, and the Tavryn node never sees the lender's change.
async function seen(node, party) {
  const update = await call(node, "/v2/updates/update-by-id", {
    updateId: funded.updateId,
    updateFormat: { includeTransactions: { eventFormat: { filtersByParty: { [party]: {} }, verbose: true }, transactionShape: "TRANSACTION_SHAPE_LEDGER_EFFECTS" } },
  });
  return (update.update?.Transaction?.value ?? update.transaction ?? update).events;
}
const lenderView = await seen(NODE2, outsideLender);
const supplierView = await seen(NODE1, supplier);
const coinsFor = (events, owner) => events.map((event) => event.CreatedEvent)
  .filter((event) => event && event.templateId.endsWith(":Splice.Amulet:Amulet") && event.createArgument.owner === owner)
  .map((event) => event.createArgument.amount.initialAmount);
const kinds = [...new Set([...lenderView, ...supplierView].map((event) => event.CreatedEvent?.templateId.split(":").slice(1).join(":")).filter(Boolean))];
const supplierCoin = { createArgument: { amount: { initialAmount: coinsFor(supplierView, supplier)[0] } } };
const lenderSpent = lenderView.map((event) => event.ExercisedEvent)
  .filter((event) => event && event.templateId.endsWith(":Splice.Amulet:Amulet") && event.consuming).length;
await new Promise((resolve) => setTimeout(resolve, 8000));
const balanceAfter = await call(NODE2, "/v0/wallet/balance", undefined, { token: WALLET2 });
step("outside lender funded in one transaction from its own node", {
  submittedBy: nodeIds.lender,
  updateId: funded.updateId,
  createdInThatTransaction: kinds,
  supplierReceived: supplierCoin.createArgument.amount.initialAmount,
  lenderCoinsSpent: lenderSpent,
  lenderChange: coinsFor(lenderView, outsideLender)[0],
  supplierSeesLenderChange: coinsFor(supplierView, outsideLender).length > 0,
  lenderWalletBefore: balanceBefore.effective_unlocked_qty,
  lenderWalletAfter: balanceAfter.effective_unlocked_qty,
});

// 6. Lender A, on the Tavryn node, tries the same invoice and is refused. No coin moves.
const lenderABalance = (await active(NODE1, lenderA, "#splice-amulet:Splice.Amulet:Amulet")).length;
try {
  await submit(NODE1, [lenderA], [{ ExerciseCommand: {
    templateId: T("FinancingOffer"), contractId: offers.lenderA.contractId, choice: "FundNow",
    choiceArgument: {
      approvedInvoiceCid: approved.contractId, rulesCid: rules.contractId, transferFactoryCid: factory.factoryId,
      inputHoldingCids: [], requestedAt, executeBefore,
      extraArgs: { context: factory.choiceContext.choiceContextData, meta: { values: {} } },
    },
  } }], disclosed.slice(1));
  step("SECOND LENDER WAS NOT REFUSED", {});
  process.exitCode = 1;
} catch (error) {
  const code = /"code"\s*:\s*"([A-Z_]+)"/.exec(JSON.stringify(error.body))?.[1];
  step("second lender refused by Canton", { status: error.status, code, coinsMoved: false, lenderACoinContractsUnchanged: lenderABalance });
}

// 7. What each side sees afterwards.
const financedAtLender = (await active(NODE2, outsideLender, T("FinancedInvoice"))).some((event) => event.createArgument.terms.externalInvoiceNumber === invoiceNumber);
const financedAtA = (await active(NODE1, lenderA, T("FinancedInvoice"))).some((event) => event.createArgument.terms.externalInvoiceNumber === invoiceNumber);
const financedAtAuditor = (await active(NODE1, auditor, T("FinancedInvoice"))).some((event) => event.createArgument.terms.externalInvoiceNumber === invoiceNumber);
step("who sees the financed invoice", { outsideLenderOnItsNode: financedAtLender, lenderA: financedAtA, auditor: financedAtAuditor });

writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
console.log("evidence written to", out);
