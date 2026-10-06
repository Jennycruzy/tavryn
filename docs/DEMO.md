# Demo script (about 4 minutes)

Open the landing page (`/`), then **Open the app** (`/app`). Each company signs in to its
own account; the demo logins are listed on the sign-in page. To act as the next company,
sign out and sign in again. Every step is also run automatically by
`scripts/ui-accounts-clickthrough.mjs`, so each one is known to work.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:25 | Landing page, hero animation | "Fewer than one in twenty Nigerian small businesses can get bank credit, even when a big company owes them money. Banks can't see whether an invoice is already financed at another bank, so they lend to few. A shared list would fix it, but no bank will show its book." |
| 0:25–0:50 | **Supplier** → New invoice → Create invoice | "A packaging supplier in Lagos creates an invoice to a food manufacturer. Only the two of them can see it." |
| 0:50–1:15 | **Buyer** → Approve invoice (Lender A and B ticked) | "The buyer approves it, once. The same invoice number can never be approved again." |
| 1:15–1:40 | **Supplier** → send a private offer to Lender A, then to Lender B | "The supplier offers it to two lenders, separately." |
| 1:40–2:00 | **Lender B** | "Lender B sees its own offer. Nothing about Lender A's." |
| 2:00–2:30 | **Lender A** → Finance this invoice | "Lender A pays first, in Canton Coin. The invoice is now financed, once." |
| 2:30–2:55 | **Lender B** → "no longer available" | "Lender B is told the invoice is gone. Not who won. Not the price." |
| 2:55–3:15 | **Buyer** → Repay; **Auditor** | "The buyer repays Lender A. The auditor sees every payment, with amounts." |
| 3:15–3:55 | **Network admins** → propose a change → Admin 1 approves → Apply (refused) → Admin 2 approves → Apply | "No single company owns the rules. One approval isn't enough. Two of three, and the change applies." |
| 3:55–4:10 | Landing page | "Every invoice, financed once. Prove it without revealing it." |

After recording, add the link, length and SHA-256 checksum to
`docs/engineering/PROGRESS.md` (P10).
