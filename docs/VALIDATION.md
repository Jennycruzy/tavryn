# Validation

Three kinds of evidence: the problem is real and current, the market is large, and Tavryn
does what it claims on real Canton networks. Every figure below has a public source or a
recorded run in this repository.

## 1. The problem is happening now

**First Brands Group (United States, September 2025).** The auto-parts maker entered
Chapter 11 with **US$2.3bn in factoring liabilities**. Its chief restructuring officer is
investigating whether receivables were turned over to the factors who bought them, and
"whether the same receivables may have been factored more than once."
([Global Trade Review, 30 Sep 2025](https://www.gtreview.com/news/americas/first-brands-faces-investigation-into-double-financing-of-receivables-inventory/))
A later examination found that the lenders "typically did not see the actual underlying
invoices or verify the data against the invoices stored in [First Brands'] database."
([Global Trade Review, 29 Apr 2026](https://www.gtreview.com/news/americas/weaknesses-in-us-factoring-programmes-critical-to-first-brands-alleged-fraud/))
The factoring firm Raistone sought an examiner after up to **US$2.3bn** of factored
receivables went missing.
([Octus](https://octus.com/resources/articles/breaking-factoring-creditor-raistone-capital-seeks-examiner-appointment-in-first-brands-bankruptcy-over-2-3b-in-missing-funds/))

**Tricolor (United States, September 2025).** The subprime auto lender collapsed into
Chapter 7. US prosecutors charged its executives over schemes including to "double-pledge
collateral to multiple lenders": the same loans were used to secure credit lines from
different lenders.
([US Attorney's Office, Southern District of New York](https://www.justice.gov/usao-sdny/pr/ceo-cfo-coo-charged-connection-billion-dollar-collapse-tricolor-auto))

In both cases each lender could only see its own deals. That is exactly the gap Tavryn
closes: lenders share one fact (has this receivable already been financed?) without
sharing their books.

## 2. The market

Global factoring reached **€4,039 billion in 2025**, up 3.7% on 2024, and passed
€4 trillion for the first time.
([FCI, 5 May 2026](https://fci.nl/en/news/fci-releases-2025-world-industry-statistics-global-factoring-market-surpasses-eu4-trillion?language_content_entity=en))
Every one of those invoices is financed on the assumption that no one else has financed
it.

## 3. Measured on real Canton networks

Each round creates and approves an invoice, offers it to two lenders, and has **both pay at
the same instant**. It then tries to approve the same invoice number a second time.
Times are end to end through Tavryn's server, including its ledger reads.

| | LocalNet (VPS) | HackCanton DevNet (shared node) |
|---|---:|---:|
| Simultaneous races | 30 | 15 |
| Exactly one lender won | **30 of 30** | **15 of 15** |
| Second lender refused by Canton itself (`LOCAL_VERDICT_LOCKED_CONTRACTS`) | 30 of 30 | 15 of 15 |
| Second lender told "no longer available", median | **0.75 s** | 5.4 s |
| Winning payment recorded, median | 1.26 s | 9.4 s |
| Buyer approval, median | 0.51 s | 4.5 s |
| Duplicate approvals refused | 30 of 30 | 15 of 15 |

Canton Coin settlement (LocalNet): **5 of 5** fundings and **5 of 5** repayments completed,
median 3.4 s to fund and 2.8 s to repay, each with the amount on the receipt.

Records: [`evidence/METRICS_localnet_2026-10-06.json`](evidence/METRICS_localnet_2026-10-06.json),
[`evidence/METRICS_devnet_2026-10-06.json`](evidence/METRICS_devnet_2026-10-06.json).
Reproduce with `npx tsx scripts/race-benchmark.ts <rounds> <label> [cantonCoinRounds]`
in `backend/`.

## 4. Conversations with users

In progress: buyer-side payables, suppliers who have sold invoices, and invoice lenders.
Findings are added here only with the person's consent and the date of the conversation.
Nothing is invented.

Questions asked:

1. How long do your customers take to pay you (or you take to pay suppliers)?
2. Have you ever sold or borrowed against an invoice to get cash sooner?
3. Have you seen, or had to prove against, the same invoice being financed twice?
4. Would a system that guarantees an invoice can only be financed once, without showing
   your business to competitors, be useful to you?
