# Tavryn progress

Evidence rule: a gate is complete only when the artifact named in the Evidence column
exists and can be reproduced. `Pending` is not a pass.

| Phase | Gate | Status | Evidence | Open dependency |
|---|---|---|---|---|
| P0 | One contract visible on LocalNet; Mana day 1 logged | Pending | LocalNet contract visibility is proven by the P2 integration; Mana activity is not claimed | User Mana confirmation |
| P1 | A funds; B fails; B cannot see A; duplicate approval refused | Passed | `dpm test` on SDK 3.5.12: `testCoreLifecycle: ok, 6 active contracts, 11 transactions` (2026-09-29) | Backend proof is recorded separately in P2 |
| P2 | Backend drives P1 with party-scoped reads | Passed | `backend/npm run integration` on LocalNet (2026-09-30): funding update `1220f10925f78f7741e2c58ec4ca042448278f17390b1045ab98c15b4389af95848e`, offset 152; repayment update `12207d8db06577a3b5ac37280b93ec895d946f8e5f26c64ceb04430a71ddf0fc4d6a`, offset 155; Financier B received HTTP 409 `INVOICE_UNAVAILABLE` with failed command `tavryn-8b959286-b713-4430-8f5b-ad7ce072b129` and submission `88b1a60f-f281-4f31-a20b-0be1a8464eb7`; duplicate approval received HTTP 409 `DUPLICATE_OR_INVALID_APPROVAL`; B view had no `InvoiceDetails`, `FinancedInvoice`, or A offer | Settlement is not part of this backend gate |
| P3 | Real Canton Coin funding and repayment | Passed | `docs/evidence/P3_SETTLEMENT_2026-10-05-VPS.json`: live VPS run completed two-step AMT funding and repayment, recorded ledger and wallet event IDs, returned `409 INVOICE_UNAVAILABLE` for the closed rival offer, and left zero active `PendingFunding` contracts | — |
| P4 | Governance threshold fails below and succeeds at threshold | Passed | `docs/evidence/P4_GOVERNANCE_2026-10-03.json`: full Daml suite passed; plain `npm run governance-integration` returned HTTP 409 below threshold and admitted `tavryn-financier-c` at threshold in update `12200024ea2fdc2adda3c4172492f1c5d106e3134812270dcfc333f9c43ac40ca436` | DevNet reproduction remains P7 |
| P5 | Full lifecycle plus rejection from UI | Pending | `ui/` is served by the backend; static smoke passed in `docs/evidence/P5_UI_SMOKE_2026-10-01.json`, and a live browser render plus all six role routes passed in `docs/evidence/P5_UI_BROWSER_2026-10-03.json`; click-through lifecycle capture remains pending | Browser lifecycle capture |
| P6 | Three real-looking invoice layouts extracted and corrected | Pending | Fixture paths and correction records | User-provided or legally usable invoice fixtures |
| P7 | Full lifecycle on DevNet | Pending | DevNet update IDs | Hackathon DevNet access details |
| P8 | Grofty flow, only if DAR/MainNet question resolves | Pending | MainNet evidence or documented exclusion | Grofty access and approved DAR path |
| P9 | Brief, pilot, validation, pitch materials | Pending | Document paths and genuine interviews | Five interview conversations |
| P10 | Reproducible sub-five-minute demo | Pending | Video path and checksum | DevNet lifecycle |
| P11 | Private-window link check and submission | Pending | Checklist and screenshots | Public repo, project profile, Mana requirement |

## Remote VPS milestone

- Date: 2026-10-01 (Africa/Lagos).
- The clean pushed source at commit `a017ec2` was transferred to the selected VPS without
  copying `.env`, wallet tokens, keys, or local build caches.
- The pinned Canton Builder Tool started LocalNet with Splice 0.6.11, and the App Provider
  validator reached ready state. The DAR SHA-256 and package ID are recorded in
  `docs/evidence/P3_SETTLEMENT_2026-10-01-VPS.json`.
- `npm ci`, `npm run build`, `npm run integration`, and `npm run settlement-integration`
  passed against the remote participant. The remote run reproduced the P2 privacy/rejection
  gate and the P3 real two-step Canton Coin funding and repayment gate.
- The runtime `.env` exists only on the VPS as a root-only ignored file. No credential or
  wallet token is part of this evidence or the repository.

## 0.1.4 pre-change baseline

- Date: 2026-10-03 (Africa/Lagos), commit `c615cf6`, VPS `/root/tavryn`.
- The deployment directory was archived as `/root/tavryn-pre-git-202610031435.tgz`,
  converted into a checkout of `origin/main`, and the obsolete audit clone was removed.
- Toolchain installed on the VPS: DPM 3.5.12 and OpenJDK 17.0.20.1. `JAVA_HOME` and the
  DPM path are persisted in `/root/.profile`.
- `dpm build` passed and produced `tavryn-0.1.3.dar`; `dpm test` passed
  `testCoreLifecycle` (6 active contracts, 11 transactions) and
  `testGovernanceThreshold` (2 active contracts, 7 transactions).
- `npm ci`, `npm run build`, `npm run integration`, and
  `npm run governance-integration` passed. Governance rejected one vote with HTTP 409 and
  executed at threshold in update
  `12204191908d5c59ea3c09a860ce699666bef118da3f4261417088a9ca4500ffc953`.
- `npm run settlement-integration` failed truthfully: the validator wallet returned HTTP
  401 and the backend returned `SETTLEMENT_REJECTED`. This is a baseline blocker, not a
  passing gate.
- LocalNet health at baseline: `canton` and `splice` healthy, `nginx` restarting, and
  `splice-onboarding` unhealthy. D5 remains open.
- The VPS GitHub identity cannot access the private Tavryn repository. Builds and
  deployment remain on the VPS; pushes are bridged through the authenticated local
  checkout until repository access is granted.

## P4 governance milestone

- Date: 2026-10-03 (Africa/Lagos; ledger references are from the selected VPS).
- Tavryn DAR `0.1.3` was deployed to the Builder LocalNet with package ID
  `d949d0f17cc2be0727767b447f75918987dcabfd58de4d41519be33e4166bf80`.
- The backend is supervised by the checked-in `deploy/tavryn-backend.service` unit and
  reports a healthy Ledger API connection.
- A two-operator committee with threshold 2 rejected execution with one vote as
  `GOVERNANCE_THRESHOLD_NOT_MET`, then admitted the candidate after the second vote and
  replaced `NetworkRules` with the candidate in its member set.
- The live ledger API user was granted act-as rights for the configured operator parties;
  this is runtime setup on the VPS and is not a repository secret.
- The exact local and live evidence is preserved in
  `docs/evidence/P4_GOVERNANCE_2026-10-03.json`.

## P3 settlement repair and rerun

- Date: 2026-10-05 (Africa/Lagos; selected VPS).
- The LocalNet restart invalidated the old wallet JWT signatures. Fresh self-signed tokens
  were minted for the existing Tavryn wallet principals (`tavryn-buyer-wallet`,
  `tavryn-financier-a-wallet`, and `tavryn-financier-b-wallet`); no token was committed.
- The live Splice wallet reports Canton Coin as `AMT`, so the settlement integration now
  uses the configured instrument instead of hard-coding `USD`.
- The current wallet API reports sender debits as signed negative amounts. The backend now
  matches their absolute decimal value when verifying the completed transfer.
- Two `PendingFunding` contracts left by the pre-fix lookup timeout were reconciled against
  their completed wallet event IDs. The final run left zero active `PendingFunding` contracts.
- Full proof is preserved in `docs/evidence/P3_SETTLEMENT_2026-10-05-VPS.json`.

## LocalNet network and bind repair

- Date: 2026-10-05 (Africa/Lagos; selected VPS).
- The selected Canton Builder LocalNet compose project was backed up and corrected so
  Canton and Splice API publications, including ports 2975, 3901, 3902, 3903, and 3975,
  bind to `127.0.0.1` rather than `0.0.0.0`. The existing PostgreSQL and UI mappings were
  preserved.
- The LocalNet `nginx` container was recreated and reattached to the `localnet` Docker
  network. Final verification showed `tavryn-backend` active, Canton/Splice/nginx/Postgres
  healthy or running, the requested ports loopback-only, and UFW exposing only 22/80/443.
- The VPS change is operational configuration, not a repository secret. The generated
  compose backup is retained on the VPS for recovery if the Builder is upgraded.

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
- Tavryn package `0.1.1` (`ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05`)
  was uploaded and vetted on the connected global synchronizer before the gate run.
- The end-to-end `fund` and `settle-repay` routes passed for invoice
  `TVN-SETTLED-81BAD415`. The exact ledger, wallet, rejection and visibility evidence is
  preserved in `docs/evidence/P3_SETTLEMENT_2026-10-01.json`.
- A same-day `dpm test` rerun reached the Daml Script service but ended with a script-context
  deadline. The earlier P1 Daml result remains recorded; P3 is supported by the successful
  participant-backed integration, not by that timed-out rerun.
