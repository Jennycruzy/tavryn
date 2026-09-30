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

Status: **not decided until the spike**.

1. Prove a plain Canton Coin transfer between two LocalNet parties.
2. Prove the documented allocation/settlement path inside a Tavryn funding choice.
3. If the allocation path fails by the phase gate, implement the documented two-step
   `PendingFunding` flow with real coin movement, and label it non-atomic everywhere.

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
