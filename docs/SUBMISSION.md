# Tavryn — HackCanton Season 3 submission working copy

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

Select **BitSafe Challenge — Contribution Pool: Decentralizing Apps on Canton**. Tavryn's
entry will integrate shared control over financier admission and
`NetworkRules.maxAdvanceRate`, then demonstrate on LocalNet that an action fails below
the approval threshold and succeeds at the threshold.

Do not select **BitSafe Gold** unless a Decentralized Party is actually deployed on
DevNet or MainNet and the deployment-path application is completed by its deadline. Do
not select the **Grofty Wallet Bounty** unless users can connect, sign, and transact with
Grofty in Tavryn's working core flow.

### Elevator pitch

Every invoice can be pledged once. Prove it without exposing competing bids. Tavryn stops
the same invoice from being financed twice — enforced by the Canton ledger. A lender
offered an invoice sees that invoice's terms, but never another lender's offer, price, or
win. The current model exposes which lenders were eligible for that invoice; removing
those names remains explicit-disclosure roadmap work.

### Compact elevator pitch

Tavryn stops double financing without exposing lenders' books. The first lender funds the
invoice; every later attempt fails, and no rival sees who won or on what terms.

## Core narrative

### Problem — one sentence

The same invoice can be financed by several lenders because each sees only its own deal;
a shared registry would stop it, but expose everyone's confidential business.

### Solution — one sentence

Tavryn lets lenders compete privately for a buyer-approved invoice, while the Canton
ledger allows only one of them to fund it.

### Why Canton — one sentence

Canton lets lenders share one fact — whether an invoice is still available — without
sharing their clients, prices, volumes, or deal terms.

### What makes it technically distinctive

When one lender funds an invoice, Canton consumes its one-use funding state. A second
lender's attempt fails. The losing lender sees only its own offer and “This invoice is no
longer available” — nothing about who won, the amount, or the terms. The implementation
keeps invoice details private and exposes only a terms-free `FundingSlot` to eligible
lenders.

### Working proof today

- The complete Daml lifecycle test passes: draft, buyer approval, two private offers,
  first funding, rival rejection, repayment, auditor trail, and duplicate-approval refusal.
- A role-scoped JSON Ledger API backend drives the same lifecycle on LocalNet.
- Successful funding and repayment have recorded Canton update IDs.
- Real Canton Coin wallet transfers have been proven for the supplier funding and buyer
  repayment legs on a Splice-backed local network; the two-step P3 path also passes on the
  selected VPS, and remains explicitly non-atomic.
- Shared governance is live on the selected VPS: one vote is rejected below the threshold,
  while two votes replace `NetworkRules` and admit the candidate financier.
- The losing lender receives `409 INVOICE_UNAVAILABLE`. If the request reaches Canton,
  Tavryn preserves the failed command and submission references; if the winning path has
  already closed the rival offer, the backend returns a preflight conflict without
  inventing a submission reference.
- Party-scoped reads prove the losing lender cannot see the winner's offer, financed
  invoice, or private invoice details.

### Honest current boundary

The single-financing and privacy invariant works. Tavryn contains a real, two-step Canton
Coin settlement path, but it is not atomic. Governed membership is proven on the selected
VPS; browser lifecycle evidence, DevNet evidence, and customer interviews remain in
progress and must not be described as complete.

## Judge-facing positioning

| Judge question | Tavryn answer | Proof to surface |
|---|---|---|
| Is the problem valuable? | Double financing forces lenders to choose between fraud risk and exposing confidential books. | Buyer/supplier/financier workflow and pilot plan |
| Why does this need Canton? | Selective visibility and one-use shared state are both load-bearing. | Lender B's failed funding plus private party view |
| Is it technically non-trivial? | Competing private offers contend for one terms-free funding right without revealing invoice terms. | Daml contracts, role-scoped backend, real update IDs |
| Does it work? | The core lifecycle runs on LocalNet through the real JSON Ledger API. | Reproducible integration output and short demo |
| Can it become a business? | Buyers sponsor reverse-factoring programmes; financiers pay per verified invoice because they carry the duplicate-financing risk. | Pilot design, integrations, and interview evidence |
| Is it complete? | Core invariant, governance, and the real two-step LocalNet Canton Coin path are reproducible on the selected VPS. Browser lifecycle capture, DevNet, UI, and interviews remain explicit gates. | Progress matrix with no inflated claims |

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

### Entry 1 — core invariant proven

Built Tavryn's core control: a buyer-approved invoice can be funded once without exposing
competing lenders' books. The Daml lifecycle and role-scoped backend now pass on LocalNet.
In the decisive run, Financier A funded successfully; Financier B's real ledger submission
was rejected as `INVOICE_UNAVAILABLE`, and B's party view contained none of A's offer,
receivable, or private invoice details. Duplicate buyer approval was also refused. This
proves the product's load-bearing claim before UI polish. Next: rerun the new two-step
Canton Coin path end to end and record both wallet and ledger references.

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
- [x] Role-switching UI (served/static smoke proof; browser lifecycle capture remains open)
- [ ] DevNet lifecycle evidence
- [ ] Customer interview evidence
- [ ] Under-five-minute demo video
- [ ] Public demo link checked in a private browser
