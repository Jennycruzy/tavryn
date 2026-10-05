# Architecture and decisions

Current model: package `tavryn-network` 0.1.4 (`daml/Tavryn/`). It replaced the earlier
`tavryn` 0.1.0–0.1.3 package; the redesign is not upgrade-compatible, so it ships under a
new package name (see `FINDINGS.md`).

## Choice graph

```
CommitteeBootstrap ──Join…──Finalize──▶ GovernanceCommittee + NetworkRules v1
GovernanceCommittee.Propose ─▶ GovernanceProposal ─Vote×N─▶ GovernanceVote
GovernanceCommittee.Execute (≥ threshold distinct votes) ─▶ NetworkRules v+1
                                     (OnboardBuyer also creates BuyerApprovalRegistry)

InvoiceDraft.Approve ─▶ InvoiceDetails + FundingSlot + ApprovedInvoice
ApprovedInvoice.CreateOffer ─▶ FinancingOffer (one per financier)
FinancingOffer.BeginFunding ─▶ PendingFunding ─Complete─▶ FinancedInvoice + FundingReceipt
                                              └Cancel───▶ ApprovedInvoice + FundingSlot + offer
FinancingOffer.Accept (off-ledger cash) ─▶ FinancedInvoice + FundingReceipt
FinancingOffer.Withdraw ─▶ OfferClosed (losing offers)
FinancedInvoice.BeginRepayment ─▶ PendingRepayment ─CompleteRepayment─▶ RepaymentReceipt
                                                    └CancelRepayment──▶ FinancedInvoice
FinancedInvoice.Repay (off-ledger cash) ─▶ RepaymentReceipt
```

## Core ledger invariant

The full invoice terms live in private `InvoiceDetails`, signed by the buyer and supplier
and observed by the auditor. `ApprovedInvoice` is the approval seal and `FundingSlot` the
terms-free one-use semaphore; both are observed by the eligible financiers. Funding
(`BeginFunding` or `Accept`) consumes **both** the slot and the approved invoice in one
transaction. Whichever financier's transaction commits first wins; a simultaneous attempt
is rejected by Canton (`LOCAL_VERDICT_LOCKED_CONTRACTS`, recorded live in
`docs/evidence/P2_CORE_2026-10-05-VPS.json`), and any later attempt finds nothing to
consume.

The invoice commitment is computed on the ledger in `Approve` as
`sha256(toHex(show (supplier, buyer, terms, salt)))`, with a random salt held only in
`InvoiceDetails`. A supplier cannot attach a commitment that does not match the invoice.

Offers store the invoice commitment and the network ID and operators, never a contract
ID of the rules or the approved invoice. Funding choices are handed the current
`ApprovedInvoice` and `NetworkRules` and check that they match. Offers therefore survive a
cancelled funding attempt and every governance change.

## Governance

`NetworkRules` (network ID, operators, threshold, admitted financiers, onboarded buyers,
participants, maximum advance rate, version) is signed by **all operators** and has **no
choices**. It is created only by the bootstrap chain, in which every operator adds its
own signature, and replaced only by `GovernanceCommittee.Execute`. `Execute` requires at
least `threshold` votes from distinct operators for that proposal and that rules
version, and an unexpired proposal. A vote from one operator counts once, a vote for
another proposal is rejected, and a proposal made against an older rules version is
stale. There is no privileged governance party.

Membership gates funding: `Approve` admits only financiers in `rules.financiers`, and
`CreateOffer`, `Accept` and `BeginFunding` re-check membership and
`advanceRate <= rules.maxAdvanceRate` against the current rules. Removing a financier or
lowering the ceiling stops open offers that no longer comply.

Anyone can create a one-operator "network" of their own. That cannot touch the real
network: a financier funds only against the rules of the network its service is
configured for, and `lockForFunding` rejects an invoice approved on any other network
(tested in `Test.CoreLifecycle.testSingleApproval`).

## Single approval

`BuyerApprovalRegistry` is signed by the operators and observed by the buyer. It is
created only by an `OnboardBuyer` governance action, which refuses a buyer already
onboarded, so each buyer has exactly one registry. `Approve` consumes and recreates it,
refusing an external invoice number already recorded. The registry is a list, so approval
cost grows linearly with approvals; sharding it is roadmap work. The operators can read
the approved external invoice numbers.

## Settlement

Status: **two-step and not atomic**, with ledger-driven reconciliation.

1. The backend generates a tracking ID, then `BeginFunding` locks the invoice in
   `PendingFunding` with that tracking ID, the amount (which must equal the offer's
   advance) and the instrument (which must equal the invoice currency).
2. The backend sends the Canton Coin transfer from the financier's wallet with the same
   tracking ID.
3. `Complete` archives the private details and creates `FinancedInvoice` and a
   `FundingReceipt` with the amount, instrument, tracking ID and cash reference.
4. `Cancel` restores the approved invoice, a fresh slot and the offer. It needs the
   locking financier, so buyer and supplier cannot reopen funding behind its back.

Repayment uses the same pattern (`BeginRepayment` → transfer → `CompleteRepayment` or
`CancelRepayment`). A retry cannot pay twice: the financed invoice is locked before the
transfer, so a second attempt has nothing to lock.

If the process stops between the transfer and the ledger record, the lock stays. The
sweeper (on start and every 60 s) and `POST /api/v1/pending-funding/:cid/reconcile`
search the sender's wallet history for the tracking ID: a found transfer completes the
lock; no transfer after the transfer's expiry plus a margin cancels it; anything else
stays pending. A transfer the wallet refuses outright cancels the lock immediately.

## Visibility

- Supplier: its drafts, approved invoices and details, offers, and financed invoices.
- Buyer: drafts, approved invoices and details, its registry, repayment obligations.
- Each financier: its own offers and their terms, `OfferClosed` facts for offers it lost,
  the deals it funded, and the network rules. On an invoice where it is eligible it also
  learns which other financiers were eligible; removing those names needs explicit
  disclosure and a multi-participant proof (roadmap).
- Auditor: receipts and the private details of open invoices.
- Operators: rules, committee, proposals, votes and the buyer registry.

Rejected commands receive no `updateId`. The backend returns the real command and
submission IDs and the Canton error identifier with a plain message; the raw error body
stays server-side.

## Trust assumptions and production boundary

- The demo backend submits for every party through one ledger user. Production needs one
  participant or wallet per organization and single-controller choices (roadmap).
- The network cannot detect financing by a lender outside the network.
- Ledger reads are scoped to Tavryn templates of the configured package; the JSON API
  still refuses a single list longer than its node limit (200 on LocalNet), so a role
  with very many active contracts needs paging (roadmap).
- Credentials, package IDs, synchronizer IDs and party IDs are configuration from the
  running network, never source constants.
