# Architecture and decisions

## Core ledger invariant

The full invoice terms live in private `InvoiceDetails`, signed by the buyer and supplier
and observed by the auditor. `ApprovedInvoice` is a terms-free approval seal, observed by
the eligible financiers, and `FundingSlot` is the shared one-use semaphore. The current
Daml visibility rule does not permit a non-stakeholder financier to exercise a hidden
`ApprovedInvoice` choice; explicit disclosure would reveal the invoice payload.

Each `FinancingOffer` is signed by the buyer and supplier, observed by its named
financier, and carries only that financier's proposed terms. `Accept` is controlled by
the buyer, supplier, and named financier. It consumes the shared `FundingSlot`, then
nested-consumes the approval seal and private details to create `FinancedInvoice`. The
winning financier therefore becomes a stakeholder of its own receivable, while a losing
financier sees its own offer and the terms-free seal but not the winner's offer, terms, or
receivable. There is no `FundingAuthorization` template in the current model.

No unique contract key is used. The buyer approval service is the single maintainer of
external invoice numbers and checks duplicates before creating `ApprovedInvoice`. The MVP
also represents that maintained state as a buyer-signed, consuming
`BuyerApprovalRegistry`: it is ordinary ledger state, not a unique key, and makes the
duplicate-approval failure testable without pretending that Canton globally enforces
key uniqueness.

## Visibility

- Supplier: its drafts, approved invoices, offers, and financed invoices.
- Buyer: its drafts/approved invoices and repayment obligations.
- Each financier: only its own offers and the deals it funded.
- Auditor: explicit observer on the full history.
- Governance: network membership/rules only.

The implementation must verify this with party-specific queries; a centrally privileged
backend view is not evidence of Canton privacy.

Rejected funding commands do not receive a Canton transaction `updateId`, because no
ledger transaction is committed. The backend returns the real generated command and
submission IDs with the plain rejection message; the raw Canton error payload remains
server-side.

## Settlement decision

Status: **two-step settlement selected for the MVP; it is not atomic**.

The local Splice-backed network accepted the documented V2 allocation request, but the
complete allocation settlement choice was not captured as a Tavryn funding transaction.
The implementation therefore uses the documented fallback:

1. `FinancingOffer.BeginFunding` consumes the opaque `FundingSlot` and creates
   `PendingFunding`.
2. The backend submits a real Canton Coin token-standard transfer from the financier's
   wallet to the supplier's wallet.
3. After the wallet history exposes the transfer event/update reference,
   `PendingFunding.Complete` consumes the approved invoice and creates `FinancedInvoice`
   plus an auditor-visible `FundingReceipt` containing that reference.
4. Repayment follows the same external-transfer-then-ledger-record pattern. The buyer's
   transfer reference is stored in `RepaymentReceipt`.

This preserves the single-financing invariant while cash is in flight, but the cash move
and the ledger transition are separate transactions. If a wallet transfer succeeds and
the follow-up ledger command fails, the `PendingFunding` contract remains for explicit
reconciliation; the service never silently marks it complete.

The atomic allocation spike and the two-step path are both recorded in
`docs/FINDINGS.md`. P3 remains pending until the new backend endpoints are rerun end to
end against the Splice participant and their update IDs are recorded here and in
`docs/PROGRESS.md`.

## Governance decision

The target governed action is admitting a financier and changing
`NetworkRules.maxAdvanceRate`. The threshold, operators, node names, and independence
must come from the Decentralization Manager run. If integration stalls, the fallback is a
working shared-control module contributed to or documented against the manager rather
than a simulated governance screen.

## Trust assumptions and production boundary

- The buyer approval service is trusted to reject duplicate external invoice numbers.
- The network cannot detect financing by a lender outside the network.
- The MVP backend may submit multiple demo parties; production isolates participants,
  credentials, and reads per organization.
- Credentials, package IDs, synchronizer IDs, token admin IDs, fees, and party IDs are
  configuration obtained from the running network, never source code constants.
