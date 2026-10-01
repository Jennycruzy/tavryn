# Tavryn progress

Evidence rule: a gate is complete only when the artifact named in the Evidence column
exists and can be reproduced. `Pending` is not a pass.

| Phase | Gate | Status | Evidence | Open dependency |
|---|---|---|---|---|
| P0 | One contract visible on LocalNet; Mana day 1 logged | Pending | LocalNet contract visibility is proven by the P2 integration; Mana activity is not claimed | User Mana confirmation |
| P1 | A funds; B fails; B cannot see A; duplicate approval refused | Passed | `dpm test` on SDK 3.5.12: `testCoreLifecycle: ok, 6 active contracts, 11 transactions` (2026-09-29) | Backend proof is recorded separately in P2 |
| P2 | Backend drives P1 with party-scoped reads | Passed | `backend/npm run integration` on LocalNet (2026-09-30): funding update `1220f10925f78f7741e2c58ec4ca042448278f17390b1045ab98c15b4389af95848e`, offset 152; repayment update `12207d8db06577a3b5ac37280b93ec895d946f8e5f26c64ceb04430a71ddf0fc4d6a`, offset 155; Financier B received HTTP 409 `INVOICE_UNAVAILABLE` with failed command `tavryn-8b959286-b713-4430-8f5b-ad7ce072b129` and submission `88b1a60f-f281-4f31-a20b-0be1a8464eb7`; duplicate approval received HTTP 409 `DUPLICATE_OR_INVALID_APPROVAL`; B view had no `InvoiceDetails`, `FinancedInvoice`, or A offer | Settlement is not part of this backend gate |
| P3 | Real Canton Coin funding and repayment | Pending | Splice 0.6.11 local validator: real Financier A → supplier funding event `#122091ae058ab59fa57a9fd46a014ee8b941e93a71e871cc9db3f3066ce1ed75b7bd:0` and buyer → Financier A repayment event `#12207125f187c3c3ee3d9f6127991715f5d05f13995170ea3b89c81a375cdcc138ce:0` recorded 2026-10-01; backend two-step implementation added but end-to-end Tavryn rerun is still open | Re-run `fund` and `settle-repay` against the deployed DAR; record both wallet and ledger update IDs |
| P4 | Governance threshold fails below and succeeds at threshold | Pending | Clean-environment run and update IDs | Decentralization Manager example, machine capacity |
| P5 | Full lifecycle plus rejection from UI | Pending | Screenshot/video path | P2 backend and P3 settlement |
| P6 | Three real-looking invoice layouts extracted and corrected | Pending | Fixture paths and correction records | User-provided or legally usable invoice fixtures |
| P7 | Full lifecycle on DevNet | Pending | DevNet update IDs | Hackathon DevNet access details |
| P8 | Grofty flow, only if DAR/MainNet question resolves | Pending | MainNet evidence or documented exclusion | Grofty access and approved DAR path |
| P9 | Brief, pilot, validation, pitch materials | Pending | Document paths and genuine interviews | Five interview conversations |
| P10 | Reproducible sub-five-minute demo | Pending | Video path and checksum | DevNet lifecycle |
| P11 | Private-window link check and submission | Pending | Checklist and screenshots | Public repo, project profile, Mana requirement |

## Day 1 log

- Date: 2026-09-29 (Africa/Lagos; deadline facts remain UTC).
- Project name: Tavryn, selected and applied across the repository.
- DPM installer: official installer installed SDK 3.5.12; `dpm build`, `dpm test`, and the LocalNet backend integration pass.
- Mana activity: **user confirmation required; not claimed**.
- Git identity: the foundation commit and subsequent work use local identity
  `jennycruzy` / `jennycruzy@users.noreply.github.com`.
- GitHub repository URL: `https://github.com/Jennycruzy/tavryn.git` (provided 2026-09-29;
  configured as the local `origin`; remote access not yet verified).
- Grofty DAR question: user must confirm whether access was requested and whether a Grofty
  user can sign a Tavryn DAR on MainNet after participant package vetting.
- Interviews: not conducted; no numbers or quotes invented.

## P3 settlement spike log

- Date: 2026-10-01 (Africa/Lagos; ledger references are from the local Splice network).
- Splice-backed local validator version: 0.6.11; local wallet/amulet package versions
  observed as 0.1.22/0.1.21.
- Receiver preapprovals were created for the local supplier, buyer, and Financier A.
- Token-standard transfers completed with real wallet history event IDs for funding and
  repayment; the update IDs are the event IDs without the `#` prefix and `:node` suffix.
- A V2 allocation request was accepted, but its settlement choice was not captured. The
  MVP therefore implements the documented two-step path and labels it non-atomic.
- The next P3 gate is an end-to-end run through Tavryn's new `POST /api/v1/offers/:cid/fund`
  and `POST /api/v1/financed/:cid/settle-repay` routes. No pass is claimed until that run
  succeeds and its ledger update IDs are added above.
