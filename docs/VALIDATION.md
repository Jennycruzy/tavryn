# Validation

Three kinds of evidence: the problem is real and current, the market is large, and Tavryn
does what it claims on real Canton networks. Every figure below has a public source or a
recorded run in this repository.

## 1. The problem in Nigeria

- **Small businesses cannot get credit.** "Fewer than one in twenty MSMEs have access to
  bank credit; loans are often short-term and costly", and "collateral requirements
  exclude many viable firms." ([World Bank, 22 Dec 2025](https://www.worldbank.org/en/news/press-release/2025/12/22/world-bank-approves-500-million-to-expand-finance-for-small-businesses-in-nigeria))
- **The gap is large.** Unmet demand for credit by Nigerian MSMEs is "approximately 13
  trillion naira, equivalent to $32.2 billion." ([IFC Market Bite Nigeria, 2022](https://www.ifc.org/en/insights-reports/2022/market-bite-nigeria-innovation-offers-key-to-the-broader-msme-finance-market))
- **Invoices are already used, with heavy safeguards.** Nigerian banks offer invoice
  discounting; Stanbic IBTC, for example, advances up to 80% of an invoice and asks for the
  confirmed invoice, the delivery receipt, a personal guarantee and domiciliation of the
  buyer's payment with the bank. ([Stanbic IBTC](https://www.stanbicibtcbank.com/nigeriabank/business/products-and-services/finance-your-business/business-loans/see-all-loans/invoice-discounting)) Those safeguards exist because a
  lender cannot see the rest of the market.
- **The registry exists but is underused.** The National Collateral Registry (2016) and the
  Secured Transactions in Movable Assets Act (2017) let lenders register security over
  receivables, yet "credit providers still have a marked preference for immovable
  security", and the IFC and World Bank recommend promoting the registry's use.
  ([Nigerian Credit Infrastructure Reform, Sept 2023](https://www.ifc.org/content/dam/ifc/doc/2024/nigerian-credit-infrastructure-reform-snapshot-of-progress-and-next-steps.pdf))
- **Demand for supplier finance is real.** CycleFlow, powered by C2FO and the IFC, launched
  in Nigeria in 2026 to pay approved MSME suppliers early on verified invoices from anchor
  buyers. ([report](https://news.yrules.com/en/archives/12708))

What we have not found: a public, documented Nigerian case of one invoice financed twice.
We do not claim one. The cases below are from the United States, and show what the
failure costs when it happens at scale.

## 2. The failure, when it happens

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

## 3. The market

In Nigeria, the MSME credit gap above (₦13 trillion) is the addressable need. Globally,
factoring reached **€4,039 billion in 2025**, up 3.7% on 2024, and passed
€4 trillion for the first time.
([FCI, 5 May 2026](https://fci.nl/en/news/fci-releases-2025-world-industry-statistics-global-factoring-market-surpasses-eu4-trillion?language_content_entity=en))
Every one of those invoices is financed on the assumption that no one else has financed
it.

## 4. Measured on real Canton networks

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

Canton Coin settlement (HackCanton DevNet, 6 October 2026): a lender's own DevNet wallet
paid the supplier **80 CC** through Tavryn in 17.2 s end to end; the lender's balance fell
by exactly 80, the supplier received one 80 CC holding, and the rival lender was refused
with "This invoice is no longer available"
([`evidence/P3_SETTLEMENT_DEVNET_2026-10-06.json`](evidence/P3_SETTLEMENT_DEVNET_2026-10-06.json)).
Repayment on DevNet is not claimed: the buyer party there has no wallet.

Naira, the Nigerian pilot path (HackCanton DevNet, 6 October 2026): the synthetic Lagos
invoice `fixtures/invoices/SYN-003` (₦20,250,000) was approved, offered to two lenders who
paid at the same moment, funded by exactly one at ₦16,200,000, and repaid, with each bank
payment reference recorded on the receipts; the second lender was told "This invoice is no
longer available". The references are synthetic and no naira moved
([`evidence/NAIRA_DEVNET_2026-10-06.json`](evidence/NAIRA_DEVNET_2026-10-06.json)).
With package 0.1.5 the same invoice carries the lender's fee (₦405,000) agreed in the
offer; after the buyer paid ₦20,250,000 to the winning lender, the lender paid the
supplier's ₦3,645,000 balance, all on the DevNet
([`evidence/NAIRA_BALANCE_DEVNET_2026-10-06.json`](evidence/NAIRA_BALANCE_DEVNET_2026-10-06.json)).

Records: [`evidence/METRICS_localnet_2026-10-06.json`](evidence/METRICS_localnet_2026-10-06.json),
[`evidence/METRICS_devnet_2026-10-06.json`](evidence/METRICS_devnet_2026-10-06.json).
Reproduce with `npx tsx scripts/race-benchmark.ts <rounds> <label> [cantonCoinRounds]`
in `backend/`.

## 5. Conversations with users

All five conversations are recorded: two buyers, one bank lender and two suppliers, all on
6 October 2026. Findings are added only with the person's consent. Nothing is invented. Full
answers: [`engineering/INTERVIEWS.md`](engineering/INTERVIEWS.md).

**Finance manager, large supermarket and distribution company (buyer side, 6 Oct 2026).**

- On the gap: "we don't really have a way to know that. ... If the supplier has taken that
  same invoice to a bank or another finance company, we may not know unless somebody
  contacts us."
- On the risk: "The bigger problem would be if two different finance companies are
  claiming the same payment. That can become a serious issue."
- On privacy, the condition Tavryn is built around: "I will not agree to put our supplier
  information and prices somewhere everybody can see. ... But if the system only tells me
  that this particular invoice has already been used somewhere, without exposing all the
  details, then I can consider it."
- On who pays: "if a finance company wants to check before giving a supplier money, I think
  they should pay for the check. They are the ones taking the risk." Buyers will not pay
  per invoice; Tavryn's pricing is lender-paid.

**Accounts manager, large construction company (buyer side, 6 Oct 2026).**

- On how lenders check today: "Sometimes a bank or finance company will call us and ask,
  'Is this invoice genuine? Have you paid it?' We can answer that. But we cannot tell them
  whether that supplier has already shown the same invoice to another lender."
- On the cost: "I have seen situations where payment had to be held because there was
  confusion about who was supposed to receive the money."
- On privacy: "Construction pricing is sensitive. ... But if you can just check whether an
  invoice has already been used, without showing the whole contract, that is different."
- On who pays: "If they are about to give somebody ₦20 million based on one invoice,
  paying a small amount to check it makes sense."

Both buyers, separately: they cannot see whether an invoice is financed elsewhere, they
refuse a registry that shows their prices, they would accept an "already used" check, and
the lender should pay for it.

**SME lending officer, Nigerian commercial bank (lender, 6 Oct 2026; a member of the
owner's family, disclosed).**

- On the gap: "there is no central place where we can check that in Nigeria. ... We can
  confirm that the invoice is genuine, but knowing whether the customer has already taken
  that same invoice to another lender is more difficult."
- On whether it happens: "Yes, it happens. ... The problem normally comes out when the
  buyer finally pays and more than one lender is expecting that same money."
- On the cost to good businesses: "A small business may have a genuine ₦20 million
  invoice from a strong company but no property to give as collateral. You can still end
  up saying no because you don't have enough visibility."
- On paying: "Compared with losing millions because an invoice was financed twice, the
  checking fee is nothing. ... the lender giving the money should pay for the check."
- On privacy: "I don't need to see which bank financed it, how much they charged or their
  customer's private information. I just need to know whether somebody already has a claim
  on that invoice."
- A limit it exposes: borrowers sometimes reuse "the same contract or the same payment they
  are expecting" under different invoice numbers. Tavryn checks each buyer-approved invoice
  once; covering purchase orders and contracts is roadmap.

Questions asked:

1. How long do your customers take to pay you (or you take to pay suppliers)?
2. Have you ever sold or borrowed against an invoice to get cash sooner?
3. Have you seen, or had to prove against, the same invoice being financed twice?
4. Would a system that guarantees an invoice can only be financed once, without showing
   your business to competitors, be useful to you?

**Supermarket supplier (food and household items, 6 Oct 2026).**

- On waiting: "Usually around 30 days, but sometimes it can enter 45 days or even more."
- On bank invoice finance: "The process was too much. They asked for plenty documents ...
  At the end, I just left it because the money was taking too long to come."
- On Tavryn's offer: "Yes, definitely. If my customer has already confirmed that they will
  pay me, and I can get most of the money now ... It will help me restock and continue
  business."

**Building-material supplier (6 Oct 2026).**

- On waiting: "Some will tell you 30 days, but in reality you can wait 60 days."
- On bank invoice finance: "they wanted collateral and plenty paperwork. For me, if I
  already have to bring property before you give me money, then what is the point of the
  invoice?"
- On Tavryn's offer: "You can have ₦15 million that customers are owing you and still be
  struggling to buy materials for the next job. If different banks can give me their
  offers and I choose the best one, I will use it."

**Across all five.** Buyers and the lender agree no one can see whether an invoice is
already financed, nobody will share prices in a registry, an "already used" check is
acceptable, and the lender should pay for it. Suppliers have given up on bank invoice
finance because of paperwork and collateral, and would use competing offers on an
approved invoice. What the conversations did not test: the size of the per-check fee, and
whether a buyer will approve invoices through Tavryn in a live pilot.

