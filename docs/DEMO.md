# Demo run sheet (under five minutes)

This is the recording plan, not evidence of a recorded demo. Record on DevNet when P7
passes; a LocalNet recording must say so on screen. The UI steps below are the same ones
the automated click-through runs (`scripts/ui-clickthrough.mjs`,
`docs/evidence/P5_CLICKTHROUGH_2026-10-05/`), so each one is known to work.

| Time | Screen | Say |
|---|---|---|
| 0:00–0:25 | Title | "The same invoice can be financed by several lenders, because each sees only its own deal. A shared registry would stop it, but expose everyone's books." |
| 0:25–0:50 | Supplier: create draft (currency = Canton Coin symbol) | "A supplier issues an invoice. Only the supplier and buyer see it." |
| 0:50–1:15 | Buyer: approve once, A and B eligible | "The buyer approves it once. The ledger seals it with a commitment and creates one funding slot." |
| 1:15–1:40 | Supplier: offer to A, offer to B | "Two lenders get separate private offers." |
| 1:40–2:05 | Financier B: one offer, its own | "B sees its own offer. Nothing about A." |
| 2:05–2:40 | Financier A: fund with Canton Coin; show both references | "A funds it. Real Canton Coin moves, and the slot is consumed." |
| 2:40–3:05 | Financier B: "This invoice is no longer available" | "B is too late. It learns only that the invoice is gone — not who won, or at what price." |
| 3:05–3:30 | Buyer: repay; Auditor: receipts | "The buyer repays. The auditor sees the full trail with amounts." |
| 3:30–4:30 | Operators: propose, vote 1, execute (refused), vote 2, execute (applied) | "The network rules belong to its operators. One vote: nothing changes. Two of three: the rule changes." |
| 4:30–4:50 | Title | "Every invoice can be pledged once. Prove it without revealing it." |

After recording: add the link, duration and SHA-256 checksum to `PROGRESS.md` (P10).
