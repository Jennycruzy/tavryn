// Canton Coin funding on the HackCanton DevNet node, with the owner's DevNet wallet as
// lender financierD. Prerequisites, done once outside this script:
//   - the wallet holds DevNet Canton Coin (validator /v0/wallet/tap);
//   - the supplier has a TransferPreapproval with the wallet as provider, so it receives
//     in one step;
//   - TAVRYN_FINANCIERS names financierD, CANTON_WALLET_TOKEN_FINANCIER_D=oidc and
//     CANTON_VALIDATOR_API_URL ends in /api/validator.
// The script admits financierD by a 2-of-3 operator vote if needed, funds one invoice
// with real Canton Coin, and shows the rival financier is refused. Repayment is not run:
// the buyer party has no DevNet wallet.
//   TAVRYN_ENV_FILE=<env> npx tsx scripts/devnet-settlement.ts <evidence.json>
import { writeFileSync } from "node:fs";

import { LedgerTokenProvider } from "../src/ledger-api.js";
import {
  assert,
  contractId,
  created,
  startIntegration,
  uniqueInvoiceNumber,
} from "../src/integration-client.js";

const out = process.argv[2];
const role = "financierD";
const run = await startIntegration();
const { config, post, get } = run;
const currency = config.settlement.cantonCoinSymbol;
assert(currency, "CANTON_COIN_SYMBOL must be configured");
assert(config.financiers.has(role), `${role} must be configured`);
const tokens = new LedgerTokenProvider(config.ledgerApiToken, config.oidc);

async function supplierHoldings(): Promise<Array<{ contractId: string; amount: string }>> {
  const token = await tokens.token();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const end = (await (await fetch(`${config.ledgerApiUrl}/v2/state/ledger-end`, { headers })).json()) as {
    offset: number;
  };
  const response = await fetch(`${config.ledgerApiUrl}/v2/state/active-contracts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      activeAtOffset: end.offset,
      filter: {
        filtersByParty: {
          [config.parties.supplier]: {
            cumulative: [
              { identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } },
            ],
          },
        },
      },
    }),
  });
  const entries = (await response.json()) as any[];
  return entries
    .map((entry) => entry.contractEntry?.JsActiveContract?.createdEvent)
    .filter((event) => event && String(event.templateId).endsWith(":Splice.Amulet:Amulet"))
    .map((event) => ({
      contractId: event.contractId,
      amount: String(event.createArgument.amount.initialAmount),
    }));
}

async function governed(action: Record<string, unknown>) {
  const proposal = await post("/api/v1/governance/proposals", { operatorIndex: "1", action });
  assert(proposal.status === 201, `Proposal failed: ${JSON.stringify(proposal.body)}`);
  const proposalCid = contractId(proposal, "GovernanceProposal");
  const vote = (index: string) =>
    post(`/api/v1/governance/proposals/${encodeURIComponent(proposalCid)}/votes`, {
      operatorIndex: index,
    });
  const execute = () =>
    post(`/api/v1/governance/proposals/${encodeURIComponent(proposalCid)}/execute`, {
      operatorIndex: "1",
    });
  await vote("1");
  const below = await execute();
  assert(
    below.status === 409 && below.body.code === "GOVERNANCE_THRESHOLD_NOT_MET",
    `One vote was not rejected: ${JSON.stringify(below.body)}`,
  );
  for (let index = 2; index <= config.governance.threshold; index += 1) {
    await vote(String(index));
  }
  const atThreshold = await execute();
  assert(atThreshold.status === 200, `Threshold execution failed: ${JSON.stringify(atThreshold.body)}`);
  return {
    action,
    below: { status: below.status, code: below.body.code },
    atThreshold: { status: atThreshold.status, updateId: atThreshold.body.updateId },
  };
}

try {
  await run.service.bootstrapNetwork();
  const network = (await get("/api/v1/network")).body;
  const admitted = network.rules.financiers.some((financier: any) => financier.role === role);
  const admission = admitted ? "already admitted" : await governed({ type: "AdmitFinancier", financierRole: role });

  const invoiceNumber = uniqueInvoiceNumber("TVN-DEVNET-CC");
  const draft = await post("/api/v1/invoices/drafts", {
    terms: {
      externalInvoiceNumber: invoiceNumber,
      faceValue: "100.00",
      currency,
      issuedDate: "2026-10-01",
      dueDate: "2026-12-31",
    },
  });
  assert(draft.status === 201 || draft.status === 200, `Draft failed: ${JSON.stringify(draft.body)}`);
  const approved = await post(
    `/api/v1/invoices/drafts/${encodeURIComponent(contractId(draft, "InvoiceDraft"))}/approve`,
    { eligibleFinancierRoles: [role, "financierA"] },
  );
  assert(approved.status === 200, `Approval failed: ${JSON.stringify(approved.body)}`);
  const approvedCid = contractId(approved, "ApprovedInvoice");
  const offer = async (financierRole: string) =>
    contractId(
      await post(`/api/v1/invoices/approved/${encodeURIComponent(approvedCid)}/offers`, {
        financierRole,
        advance: "80.00",
        advanceRate: "0.80",
      }),
      "FinancingOffer",
    );
  const offerD = await offer(role);
  const offerA = await offer("financierA");

  const balanceBefore = await run.service.settlement.unlockedBalance(role);
  const holdingsBefore = await supplierHoldings();
  const started = Date.now();
  const funded = await post(`/api/v1/offers/${encodeURIComponent(offerD)}/fund`, {
    financierRole: role,
  });
  const fundingMs = Date.now() - started;
  assert(funded.status === 200, `Funding failed: ${JSON.stringify(funded.body)}`);
  const receipt = created(funded, "FundingReceipt");
  assert(
    Number(funded.body.cashTransfer.amount) === 80 &&
      Number(receipt.createArgument.settlementAmount) === 80 &&
      receipt.createArgument.trackingId === funded.body.cashTransfer.trackingId,
    "The moved amount or tracking ID does not match the receipt",
  );
  const balanceAfter = await run.service.settlement.unlockedBalance(role);
  const holdingsAfter = await supplierHoldings();
  const known = new Set(holdingsBefore.map((holding) => holding.contractId));
  const received = holdingsAfter.filter((holding) => !known.has(holding.contractId));
  assert(
    received.some((holding) => Number(holding.amount) === 80),
    `The supplier did not receive an 80 CC holding: ${JSON.stringify(received)}`,
  );

  const rival = await post(`/api/v1/offers/${encodeURIComponent(offerA)}/accept`, {
    financierRole: "financierA",
    paymentReference: "devnet-rival",
  });
  assert(
    rival.status === 409 && rival.body.code === "INVOICE_UNAVAILABLE",
    `The rival was not rejected: ${JSON.stringify(rival.body)}`,
  );

  const evidence = {
    date: new Date().toISOString().slice(0, 10),
    environment: "HackCanton S3 shared DevNet node hackcanton-01 (NODERS)",
    packageId: config.packageId,
    lender: {
      role,
      party: config.financiers.get(role),
      wallet: "the owner's DevNet wallet user on hackcanton-01, funded from the DevNet faucet",
      admission,
    },
    invoice: { externalInvoiceNumber: invoiceNumber, faceValue: "100.00", currency },
    funding: {
      updateId: funded.body.updateId,
      cashTransfer: funded.body.cashTransfer,
      receipt: {
        contractId: receipt.contractId,
        settlementAmount: receipt.createArgument.settlementAmount,
        instrument: receipt.createArgument.instrument,
        trackingId: receipt.createArgument.trackingId,
      },
      lenderUnlockedBalance: { before: balanceBefore, after: balanceAfter },
      supplierReceivedHoldings: received,
      elapsedMs: fundingMs,
    },
    rival: { role: "financierA", status: rival.status, code: rival.body.code, message: rival.body.error },
    notClaimed: [
      "Repayment on DevNet: the buyer party has no DevNet wallet, so the repayment leg is proven on LocalNet only.",
      "Atomic settlement: funding is two-step (ledger lock, wallet transfer, ledger completion) with reconciliation by tracking ID.",
    ],
  };
  console.log(JSON.stringify(evidence, null, 2));
  if (out) writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`);
} finally {
  await run.stop();
}
