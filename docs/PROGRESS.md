# Tavryn progress

Evidence rule: a gate is complete only when the artifact named in the Evidence column
exists and can be reproduced. `Pending` is not a pass.

| Phase | Gate | Status | Evidence | Open dependency |
|---|---|---|---|---|
| P0 | One contract visible on LocalNet; Mana day 1 logged | Pending | LocalNet contract visibility is proven by the P2 integration; Mana activity is not claimed | User Mana confirmation |
| P1 | A funds; B fails; B cannot see A; duplicate approval refused | Passed | `dpm test` on SDK 3.5.12: `testCoreLifecycle: ok, 6 active contracts, 11 transactions` (2026-09-29) | Backend proof is recorded separately in P2 |
| P2 | Backend drives P1 with party-scoped reads | Passed | `backend/npm run integration` on LocalNet (2026-09-30): funding update `1220765a95d425f1f0ee245c9f023b4e42e55f720312e48d9e99ff462582cb4c23a9`, offset 125; repayment update `12203b846ccfd2f78cd83578bbc1dcac63b9e5a82b9ddc32cbe563d63548c7144677`, offset 128; Financier B received HTTP 409 `INVOICE_UNAVAILABLE`; duplicate approval received HTTP 409 `DUPLICATE_OR_INVALID_APPROVAL`; B view had no `InvoiceDetails`, `FinancedInvoice`, or A offer | Settlement is not part of this backend gate |
| P3 | Real Canton Coin funding and repayment | Pending | The Tavryn-only DPM sandbox has no Splice/token-standard package; no settlement claim made | Splice-backed DevNet/LocalNet, token admin, CC buffer |
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
