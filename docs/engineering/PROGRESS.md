# Tavryn progress

Evidence rule: a gate is complete only when the artifact named in the Evidence column
exists and can be reproduced. `Pending` is not a pass.

| Phase | Gate | Status | Evidence | Open dependency |
|---|---|---|---|---|
| P0 | One contract visible on LocalNet; Mana day 1 logged | Passed (owner-attested) | LocalNet contract visibility is proven by P2; the owner confirmed the Mana day-1 activity was completed | - |
| P1 | A funds; B fails; B cannot see A; duplicate approval refused | Passed | `dpm test` on SDK 3.5.12 for `tavryn-network` 0.1.4 (2026-10-05): 9 scripts pass, covering the lifecycle, single approval, a fake-network duplicate that cannot be funded, two-step funding and repayment, cancel only with the locking financier, the governance threshold, and funding after governance changes | - |
| P2 | Backend drives P1 with party-scoped reads | Passed | `docs/evidence/P2_CORE_2026-10-05-VPS.json`: A and B funded at the same moment; A won, B got HTTP 409 `INVOICE_UNAVAILABLE` from Canton `LOCAL_VERDICT_LOCKED_CONTRACTS` with its failed submission reference; B's view of that invoice is one `OfferClosed`; duplicate approval refused with `DUPLICATE_INVOICE` | - |
| P3 | Real Canton Coin funding and repayment | Passed | `docs/evidence/P3_SETTLEMENT_2026-10-05-VPS-0.1.4.json`: AMT funding and repayment with amounts matching the receipts; a crash after the transfer completed after restart by tracking ID; a wallet-rejected transfer reopened the invoice; a repayment retry moved no cash and reconciliation completed the original | Not atomic by design |
| P4 | Governance threshold fails below and succeeds at threshold | Passed | `docs/evidence/P4_GOVERNANCE_2026-10-05-VPS.json`: `AdmitFinancier` and `SetMaxAdvanceRate` each refused at 1 of 2 operator votes ("Not enough operator approvals (1 of 2). Nothing changed.") and applied at 2; an offer opened before the changes still funded; the admitted financier funded. No party can change the rules alone | DevNet reproduction remains P7 |
| P5 | Full lifecycle plus rejection from UI | Passed | `docs/evidence/P5_ACCOUNTS_2026-10-06/` (company accounts): each company signs in to its own account; the supplier uploads a PDF invoice that fills in the form, the buyer opens the file and approves, Lender A finances by bank transfer reference, Lender B finds it gone, the buyer repays, one admin is refused alone and a second organisation applies the change. Earlier, `docs/evidence/P5_CLICKTHROUGH_2026-10-06/` (current design; earlier run in `P5_CLICKTHROUGH_2026-10-05/`): a recorded headless-Chromium session (video and 14 screenshots) through the deployed app: draft, single approval, two offers, B sees only its own, A funds with Canton Coin, B left with "This invoice is no longer available", repayment, auditor receipts, a governance change refused below threshold and applied at it | - |
| P6 | Three real-looking invoice layouts extracted and corrected | Partly passed | `fixtures/invoices/`: three synthetic, labelled layouts (US net 60, EU VAT with credit note, services with retention) with the draft fields and the corrections a supplier makes by hand | Automatic extraction not built (roadmap); real permissioned invoices optional |
| P7 | Full lifecycle on DevNet | Passed (ledger lifecycle and governance) | `docs/evidence/P7_DEVNET_2026-10-05.json`: on shared node hackcanton-01, bootstrap by all three operators, simultaneous funding with B winning and A rejected by `LOCAL_VERDICT_LOCKED_CONTRACTS`, repayment, duplicate approval refused, both governance changes refused at 1 vote and applied at 2, pre-existing offer still funded | Canton Coin funding on DevNet passed 2026-10-06 (`docs/evidence/P3_SETTLEMENT_DEVNET_2026-10-06.json`, lender = owner DevNet wallet, 80 CC to the supplier, rival refused); repayment on DevNet not claimed (buyer has no DevNet wallet). Naira invoice through the bank-reference path passed on DevNet (`docs/evidence/NAIRA_DEVNET_2026-10-06.json`) |
| P8 | Grofty flow, only if DAR/MainNet question resolves | Excluded | The Grofty extension could not be installed for testing; the bounty is not selected and no Grofty integration is claimed (`SUBMISSION.md`) | - |
| P9 | Brief, pilot, validation, pitch materials | Passed | `docs/VALIDATION.md`: cited 2025 double-financing cases (First Brands, Tricolor) and market size (FCI); measured 45 of 45 simultaneous races with one winner on LocalNet and DevNet (`docs/evidence/METRICS_*_2026-10-06.json`) ; five consented interviews in `docs/engineering/INTERVIEWS.md` (two buyers, one bank lender, two suppliers) | - |
| P10 | Reproducible sub-five-minute demo | Pending | Video path and checksum | DevNet lifecycle |
| P11 | Private-window link check and submission | Link check passed | `docs/evidence/P11_PUBLIC_LINK_2026-10-06/`: tavryn.site, www, the app and a lender page in fresh Chromium contexts, all HTTP 200 with no console errors, failed requests or phone horizontal scroll; repo public | Project page and diary posts on the HackCanton platform (owner) |

## 0.1.5 milestone (2026-10-06)

- Adds the lender's fee to the offer and the supplier's balance after repayment: when the
  buyer pays the full invoice to the lender, a `BalanceDue` (invoice less advance less fee)
  is created, signed by lender and supplier, and the lender's `PayBalance` records a
  `BalanceReceipt` by bank reference or Canton Coin. Offers without a fee behave as before.
- Additive upgrade of `tavryn-network` (0.1.4 to 0.1.5): optional fields at the end of
  records, new choices and templates only. `dpm build` with `upgrades` against the deployed
  0.1.4 DAR reported 0 errors, and LocalNet accepted the upload (HTTP 200).
- Reads accept contracts from both package versions (`CANTON_PREVIOUS_PACKAGE_IDS`), so the
  network rules, registry and in-flight invoices created under 0.1.4 stay visible.
- DevNet: the owner uploaded 0.1.5 through the hackcanton-01 Console (the guest API user
  still gets 403); the naira invoice ran with the fee and the balance, ₦3,645,000 paid to
  the supplier (`docs/evidence/NAIRA_BALANCE_DEVNET_2026-10-06.json`).
- Evidence: `docs/evidence/BALANCE_LOCALNET_2026-10-06.json`, the full flow with the fee and
  balance in `docs/evidence/P5_ACCOUNTS_2026-10-06/`, and the race page in
  `docs/evidence/RACE_PAGE_2026-10-06.png`.

## 0.1.4 milestone

- Date: 2026-10-05 (Africa/Lagos), on the selected VPS LocalNet.
- Package `tavryn-network` 0.1.4, ID
  `c2071d2c1ddf1685e3c9f345a684199d817ccaa3e33f4979a2ae892892bebab9`, uploaded and
  deployed; `tavryn-backend` restarted on it and `/health` passed.
- `npm run bootstrap` created the network through the operators' bootstrap chain
  (finalized in update `122052b28e1ec2e3930202d50b7ad0c292b427007c5e8afeb5462d2b455c89ca683e`)
  and onboarded the buyer by governance vote
  (`12202799c7549d6588fbdbf942afb61bd3f65c2166befe7d91a45e9bf25e70ef6bcf`). A second run
  changed nothing.
- `dpm test`: 9 of 9 scripts pass. `npm test`: 9 of 9 unit tests pass, using Canton
  error bodies recorded from the VPS (`backend/test/fixtures/`).
- Integrations: P2, P3 and P4 evidence above; browser click-through P5 above.

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
- Interviews: 5 of 5 recorded (buyer-side finance manager, construction accounts manager, two suppliers, and an SME lending officer at a Nigerian commercial bank who is the owner's family member, disclosed; 2026-10-06, quoted by role with consent); no numbers or quotes invented.

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
