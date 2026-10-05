# Shared rules

Tavryn's network rules — which lenders may join, which buyers are onboarded, and the
maximum share of an invoice a lender may advance — are not owned by any one company.

- The rules are signed by **every** network admin, and nothing can edit them directly.
- Any admin can propose a change. It applies only after **two of the three** admins approve
  it; with one approval the network refuses and nothing changes.
- A proposal made against older rules is out of date and can't be applied.
- Changing the rules never breaks invoices that are already open.

The contracts are in [`daml/Tavryn/Governance.daml`](../daml/Tavryn/Governance.daml) and
[`daml/Tavryn/Rules.daml`](../daml/Tavryn/Rules.daml). The records from the live runs are in
[`docs/evidence/P4_GOVERNANCE_2026-10-05-VPS.json`](../docs/evidence/P4_GOVERNANCE_2026-10-05-VPS.json)
(local network) and
[`docs/evidence/P7_DEVNET_2026-10-05.json`](../docs/evidence/P7_DEVNET_2026-10-05.json)
(HackCanton DevNet).

The same voting step could later be run through BitSafe's Decentralization Manager, with
each admin on its own Canton node; that integration is not part of this build.
