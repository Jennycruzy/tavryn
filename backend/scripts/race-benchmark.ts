// Measures Tavryn on a real network. For each round: create and approve an invoice, offer
// it to two lenders, have both pay at the same instant, try a duplicate approval, and time
// every step. Writes a JSON summary; nothing is simulated.
//   TAVRYN_ENV_FILE=<env> npx tsx scripts/race-benchmark.ts <rounds> <label> [cantonCoinRounds]
import { writeFileSync } from "node:fs";

import { contractId, created, startIntegration, uniqueInvoiceNumber } from "../src/integration-client.js";

const rounds = Number(process.argv[2] ?? 20);
const label = process.argv[3] ?? "network";
const coinRounds = Number(process.argv[4] ?? 0);
const run = await startIntegration();
const { post } = run;

async function timed<T>(work: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();
  const result = await work();
  return [result, performance.now() - start];
}

async function openInvoice(currency: string, face: string) {
  const terms = {
    externalInvoiceNumber: uniqueInvoiceNumber("TVN-BENCH"),
    faceValue: face,
    currency,
    issuedDate: "2026-10-01",
    dueDate: "2026-12-01",
  };
  const draft = await post("/api/v1/invoices/drafts", { terms });
  const [approved, approveMs] = await timed(() =>
    post(`/api/v1/invoices/drafts/${encodeURIComponent(contractId(draft, "InvoiceDraft"))}/approve`, {
      eligibleFinancierRoles: ["financierA", "financierB"],
    }),
  );
  const approvedCid = contractId(approved, "ApprovedInvoice");
  const offer = async (role: string, advance: string, rate: string) =>
    contractId(
      await post(`/api/v1/invoices/approved/${encodeURIComponent(approvedCid)}/offers`, {
        financierRole: role,
        advance,
        advanceRate: rate,
      }),
      "FinancingOffer",
    );
  return { terms, approveMs, approved, offerA: await offer("financierA", "0.80", "0.80"), offerB: await offer("financierB", "0.79", "0.79") };
}

const races: Array<Record<string, unknown>> = [];
try {
  await run.service.bootstrapNetwork();
  for (let round = 0; round < rounds; round += 1) {
    const invoice = await openInvoice("USD", "1.00");
    const attempt = (role: "financierA" | "financierB", offerCid: string) =>
      timed(() =>
        post(`/api/v1/offers/${encodeURIComponent(offerCid)}/accept`, {
          financierRole: role,
          paymentReference: `bench-${role}-${round}`,
        }),
      );
    const [[a, aMs], [b, bMs]] = await Promise.all([
      attempt("financierA", invoice.offerA),
      attempt("financierB", invoice.offerB),
    ]);
    const winners = [a, b].filter((response) => response.status === 200).length;
    const loser = a.status === 200 ? { response: b, ms: bMs } : { response: a, ms: aMs };
    const winnerMs = a.status === 200 ? aMs : bMs;
    const duplicateDraft = await post("/api/v1/invoices/drafts", { terms: invoice.terms });
    const duplicate = await post(
      `/api/v1/invoices/drafts/${encodeURIComponent(contractId(duplicateDraft, "InvoiceDraft"))}/approve`,
      {},
    );
    races.push({
      round,
      winners,
      approveMs: Math.round(invoice.approveMs),
      winnerMs: Math.round(winnerMs),
      loserMs: Math.round(loser.ms),
      loserStatus: loser.response.status,
      loserCode: loser.response.body.code,
      loserLedgerCode: loser.response.body.ledgerErrorCode ?? "closed before submission",
      duplicateRefused: duplicate.status === 409 && duplicate.body.code === "DUPLICATE_INVOICE",
    });
    process.stderr.write(`round ${round + 1}/${rounds}: winners=${winners} loser=${loser.response.body.code}\n`);
  }

  const coin: Array<Record<string, unknown>> = [];
  const symbol = run.config.settlement.cantonCoinSymbol;
  for (let round = 0; round < coinRounds && symbol; round += 1) {
    const invoice = await openInvoice(symbol, "1.00");
    const [funded, fundMs] = await timed(() =>
      post(`/api/v1/offers/${encodeURIComponent(invoice.offerA)}/fund`, { financierRole: "financierA" }),
    );
    const [repaid, repayMs] = await timed(() =>
      post(`/api/v1/financed/${encodeURIComponent(contractId(funded, "FinancedInvoice"))}/settle-repay`, {
        repaymentDate: "2026-10-06",
      }),
    );
    coin.push({
      round,
      fundStatus: funded.status,
      fundMs: Math.round(fundMs),
      repayStatus: repaid.status,
      repayMs: Math.round(repayMs),
      cashUpdateId: funded.body.cashTransfer?.updateId,
      receiptAmount: created(funded, "FundingReceipt")?.createArgument?.settlementAmount,
    });
    process.stderr.write(`coin round ${round + 1}/${coinRounds}: fund=${funded.status} repay=${repaid.status}\n`);
  }

  const stats = (values: number[]) => {
    const sorted = [...values].sort((x, y) => x - y);
    const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    return { median: pick(0.5), p95: pick(0.95), min: sorted[0], max: sorted.at(-1) };
  };
  const ms = (key: string, from: Array<Record<string, unknown>>) => from.map((row) => Number(row[key]));
  const summary = {
    label,
    date: new Date().toISOString(),
    packageId: run.config.packageId,
    rounds,
    exactlyOneWinner: races.filter((race) => race.winners === 1).length,
    loserRefusedAsUnavailable: races.filter((race) => race.loserCode === "INVOICE_UNAVAILABLE").length,
    loserRefusedByLedgerContention: races.filter((race) => race.loserLedgerCode === "LOCAL_VERDICT_LOCKED_CONTRACTS").length,
    duplicateApprovalsRefused: races.filter((race) => race.duplicateRefused).length,
    approvalMs: stats(ms("approveMs", races)),
    winningPaymentMs: stats(ms("winnerMs", races)),
    loserRefusalMs: stats(ms("loserMs", races)),
    cantonCoin: coin.length
      ? {
        rounds: coin.length,
        fundedOk: coin.filter((row) => row.fundStatus === 200).length,
        repaidOk: coin.filter((row) => row.repayStatus === 200).length,
        fundMs: stats(ms("fundMs", coin)),
        repayMs: stats(ms("repayMs", coin)),
        sample: coin[0],
      }
      : undefined,
    races,
  };
  const file = `../docs/evidence/METRICS_${label}_${summary.date.slice(0, 10)}.json`;
  writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ ...summary, races: undefined }, null, 2));
} finally {
  await run.stop();
}
