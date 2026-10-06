# Tavryn, HackCanton Season 3 submission working copy

This is the source of truth for the public project page, development diary, demo, and
final submission. Update proof as it lands; never promote a planned feature into a claim.

## First-screen copy

### Project name

**Tavryn**

### Tagline

**Every invoice can be pledged once. Prove it without revealing it.**

### Track

**Real-World Asset & Business Workflows**

### Challenges

Select **BitSafe Challenge (Contribution Pool: Decentralizing Apps on Canton)**. Tavryn's
network rules (financier admission, removal, buyer onboarding and the maximum advance
rate) are signed by every operator and change only through a threshold of operator votes;
on LocalNet an action fails below the threshold and succeeds at it
(`docs/evidence/P4_GOVERNANCE_2026-10-05-VPS.json`).

Do not select **BitSafe Gold** unless a Decentralized Party is actually deployed on
DevNet or MainNet and the deployment-path application is completed by its deadline. The
**Grofty Wallet Bounty** is deliberately not selected: the Grofty browser extension could
not be installed for testing, so users cannot connect, sign and transact with Grofty in
Tavryn's core flow, and no Grofty integration is claimed.

### Elevator pitch

Every invoice can be pledged once. Prove it without exposing competing bids. Tavryn stops
the same invoice from being financed twice, enforced by the Canton ledger. A lender
offered an invoice sees that invoice's terms, but never another lender's offer, price, or
win. The current model exposes which lenders were eligible for that invoice; removing
those names remains explicit-disclosure roadmap work.

### Compact elevator pitch

Tavryn stops double financing without exposing lenders' books. The first lender funds the
invoice; every later attempt fails, and no rival sees who won or on what terms.

## Core narrative

### Problem, one sentence

The same invoice can be financed by several lenders because each sees only its own deal;
a shared registry would stop it, but expose everyone's confidential business.

### Solution, one sentence

Tavryn lets lenders compete privately for a buyer-approved invoice, while the Canton
ledger allows only one of them to fund it.

### Why Canton, one sentence

Canton lets lenders share one fact (whether an invoice is still available) without
sharing their clients, prices, volumes, or deal terms.

### What makes it technically distinctive

When one lender funds an invoice, Canton consumes its one-use funding state. A second
lender's attempt fails. The losing lender sees only its own offer and “This invoice is no
longer available”, nothing about who won, the amount, or the terms. The implementation
keeps invoice details private and exposes only a terms-free `FundingSlot` to eligible
lenders.

### Working proof today

- On the Canton ledger, the same invoice cannot be financed twice. Two financiers funded
  the same invoice at the same moment; Canton accepted one and rejected the other
  (`LOCAL_VERDICT_LOCKED_CONTRACTS`), and the loser saw only "This invoice is no longer
  available".
- The losing lender cannot see the winner, the amount or the terms; party-scoped reads
  prove it.
- Real Canton Coin moves for funding and repayment, with amounts recorded on the
  receipts. The two steps are reconciled by tracking ID: a crash after the cash moves is
  completed automatically, and a retried repayment never pays twice.
- On the HackCanton DevNet, a lender paid the supplier 80 CC from its own DevNet wallet
  through Tavryn; the rival lender was refused
  (`docs/evidence/P3_SETTLEMENT_DEVNET_2026-10-06.json`).
- Shared governance: the network rules are signed by every operator and change only when
  two of three vote. One vote is refused ("Not enough operator approvals (1 of 2).
  Nothing changed."); two votes admit a financier or change the maximum advance rate.
  Invoices already in flight keep working.
- A buyer approves each external invoice number once, through a registry only governance
  can create; the invoice commitment is computed on the ledger.
- A recorded browser session runs the whole flow through the UI.

### Honest current boundary

Settlement is two-step and not atomic, with reconciliation. The lifecycle, governance and
Canton Coin funding run on the HackCanton DevNet node; Canton Coin repayment is proven on
LocalNet only, because the DevNet buyer party has no wallet. Customer interviews are still
pending. The demo backend acts for every party through one ledger user; production needs
one participant or wallet per organization.

## Judge-facing positioning

| Judge question | Tavryn answer | Proof to surface |
|---|---|---|
| Is the problem valuable? | Double financing forces lenders to choose between fraud risk and exposing confidential books. | Buyer/supplier/financier workflow and pilot plan |
| Why does this need Canton? | Selective visibility and one-use shared state are both load-bearing. | Lender B's failed funding plus private party view |
| Is it technically non-trivial? | Competing private offers contend for one terms-free funding right without revealing invoice terms. | Daml contracts, role-scoped backend, real update IDs |
| Does it work? | The core lifecycle runs on LocalNet through the real JSON Ledger API. | Reproducible integration output and short demo |
| Can it become a business? | Buyers sponsor reverse-factoring programmes; financiers pay per verified invoice because they carry the duplicate-financing risk. | Pilot design, integrations, and interview evidence |
| Is it complete? | Core invariant and governance run on LocalNet and the HackCanton DevNet node, with a recorded browser click-through; two-step Canton Coin funding is proven on LocalNet and DevNet, repayment on LocalNet. Interviews remain an explicit gate. | Progress matrix with no inflated claims |

## Language discipline

Use:

- “the same invoice cannot be financed twice”
- “the Canton ledger lets only one lender fund it”
- “lenders see only their own deals”
- “This invoice is no longer available”
- “working on LocalNet”
- “within the participating network”

Avoid:

- “invoice management app”
- “control layer” in the opening copy
- “one-use ledger right” before explaining the user outcome
- “blockchain transparency”
- “marketplace for invoices” as the primary description
- “eliminates invoice fraud”
- “globally prevents double financing”
- “atomic Canton Coin settlement”; the MVP path is explicitly two-step
- long explanations of templates before stating the business consequence

## Development diary

Each entry should follow: **result -> proof -> why it matters -> next risk**. Keep it below
120 words and attach a screenshot, update ID, or commit whenever possible.

### Entry 1, core invariant proven

Built Tavryn's core control: a buyer-approved invoice can be funded once without exposing
competing lenders' books. The Daml lifecycle and role-scoped backend now pass on LocalNet.
In the decisive run, Financier A funded successfully; Financier B's real ledger submission
was rejected as `INVOICE_UNAVAILABLE`, and B's party view contained none of A's offer,
receivable, or private invoice details. Duplicate buyer approval was also refused. This
proves the product's load-bearing claim before UI polish. Next: rerun the new two-step
Canton Coin path end to end and record both wallet and ledger references.

### Entry 2, the rules belong to the network, not to us

Rebuilt Tavryn's rules (which lenders may join, the maximum advance) so every operator
signs them and a change needs two of three votes. Proof: on LocalNet and the HackCanton
DevNet, one vote was refused ("Not enough operator approvals (1 of 2). Nothing changed.")
and two applied the change; an invoice already in flight still funded
(`docs/evidence/P4_GOVERNANCE_2026-10-05-VPS.json`, `P7_DEVNET_2026-10-05.json`). Why it
matters: a lender network nobody owns is the point; a single admin would be another
registry to trust. Next: measure the race under load.

### Entry 3, 45 races, 45 single winners

Ran 45 rounds where two lenders pay for the same invoice at the same instant: 30 on
LocalNet, 15 on the DevNet. Exactly one won every time; Canton itself refused the second
(`LOCAL_VERDICT_LOCKED_CONTRACTS`), and the loser was told in 0.75 s (median, LocalNet).
Every duplicate approval was refused. Proof: `docs/evidence/METRICS_*_2026-10-06.json`.
Why it matters: First Brands and Tricolor (2025) failed on invoices and collateral
pledged more than once; this is the failure Tavryn removes. Next: real Canton Coin on the
DevNet.

### Entry 4, real Canton Coin on the DevNet

A lender paid a supplier 80 CC from its own DevNet wallet, through Tavryn. The lender's
balance fell by exactly 80, the supplier received an 80 CC holding, the ledger receipt
carries the same payment reference, and the rival lender was refused. Admitting that
lender took two of three operator votes. Proof:
`docs/evidence/P3_SETTLEMENT_DEVNET_2026-10-06.json`. Why it matters: money, not just
records, now moves on the hackathon network. Next: customer conversations.

### Reusable diary template

**Result:** What became demonstrably true today?

**Proof:** What command, update ID, screenshot, transaction, or user response proves it?

**Why it matters:** Which business or Canton-specific risk did this remove?

**Next:** What is the single highest-risk assumption being tested next?

## Demo spine

1. “The same invoice can be sold twice because lenders cannot share their books.”
2. Buyer approves one invoice; Tavryn exposes only a terms-free availability signal.
3. Two lenders receive separate private offers.
4. Financier A funds and receives the private receivable.
5. Financier B tries to fund the same invoice and gets a plain ledger-backed rejection.
6. Switch to B's view: no winner, price, terms, or receivable is visible.
7. Buyer repays; auditor sees the complete trail.
8. Close with: “Every invoice can be pledged once. Prove it without revealing it.”

## Submission evidence checklist

- [x] Public GitHub repository
- [x] Daml build and lifecycle test
- [x] LocalNet backend integration
- [x] Funding and repayment update IDs
- [x] Local Splice wallet transfer spike
- [x] Rival rejection and privacy proof
- [ ] Project page created with first-screen copy
- [ ] Daily diary entries posted with artifacts
- [x] Tavryn end-to-end two-step Canton Coin funding and repayment
- [x] Governance threshold proof
- [x] Role-switching UI with governance view and recorded browser click-through
- [x] DevNet lifecycle and governance evidence (`docs/evidence/P7_DEVNET_2026-10-05.json`)
- [x] DevNet Canton Coin funding (`docs/evidence/P3_SETTLEMENT_DEVNET_2026-10-06.json`)
- [x] Sample invoices, synthetic and labelled (`fixtures/invoices/`)
- [ ] Customer interview evidence
- [ ] Under-five-minute demo video
- [x] Public demo link checked in fresh browser contexts (`docs/evidence/P11_PUBLIC_LINK_2026-10-06/`)
