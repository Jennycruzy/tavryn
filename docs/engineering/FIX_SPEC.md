# Tavryn fix specification

Audit date: 2026-10-03, against `main` @ `c615cf6` and the live VPS ledger (package
`d949d0f1…`, DAR 0.1.3). This spec is the work order for the next build pass. Every item
has an acceptance check; an item is done only when that check passes with recorded output.
The existing rules still apply: no mocks of the ledger or wallet, no claim without an
artifact, and the settlement path is never called atomic.

HackCanton S3 timing: on 2026-10-03 the AppsFactory dashboard countdown read 6 days 7 hours
until submission closes, so it closes on **2026-10-09**. The Grand Final is 2026-10-14. Tier 1 below is
what must land before submission. Tier 2 is product work and must not block Tier 1.

---

## 0. Ground rules for this pass

1. **One DAR change.** Make every Daml change in sections A–C in a single version bump to
   `tavryn` **0.1.4**. That build is deployed to LocalNet first, then to DevNet. Do not ship
   0.1.4, then 0.1.5 a day later; each version means another upload, vetting, and evidence run.
2. **Regenerate bindings.** Run `dpm codegen-js .daml/dist/tavryn-0.1.4.dar -o backend/daml.js`,
   commit `backend/daml.js/tavryn-0.1.4`, import from it in every backend file, and delete
   the hand-written `settlement-contracts.ts` and `governance-contracts.ts`. Remove the 0.1.0
   and 0.1.1 binding directories once nothing imports them.
3. **Reads are package-scoped.** `LedgerApi.activeContracts` must filter on the configured
   `CANTON_PACKAGE_ID`. The live ledger currently returns 0.1.1 and 0.1.3 contracts mixed
   together (for example 2 + 16 `NetworkRules`), and the UI picks `[0]`.
4. **Build, test and deploy on the VPS.** The VPS is the build machine and the deployment.
   Everything in this spec is built, tested and deployed there. The owner has authorized
   Codex to deploy every fix in this spec to the VPS without asking again. Do the following
   once, at the start of the pass, before any code change.

   a. **Toolchain.**
      - Install Java 17: `apt-get install -y openjdk-17-jre-headless`, or a Temurin 17
        tarball under `/opt` if apt is not wanted.
      - Install DPM with the official installer (`https://get.digitalasset.com/install/install.sh`).
        Pin SDK **3.5.12**, the version the repo was built with.
      - Put `dpm` on `PATH` for root and set `JAVA_HOME` in `/root/.profile`.
      - Verify `dpm version` and `java -version`. Record both in `docs/PROGRESS.md`.
      - Neither tool is currently installed on the VPS, so `dpm build` and `dpm test` have
        never run there.

   b. **Git checkout.** `/root/tavryn` is not a git checkout. Codex copied files in, and it
      is one day behind `main`. Convert it in place:
      1. Back up the folder first: `tar czf /root/tavryn-pre-git-$(date +%Y%m%d%H%M).tgz -C /root tavryn`.
      2. Run `git init`, `git remote add origin https://github.com/Jennycruzy/tavryn.git`,
         `git fetch origin`, then `git reset --hard origin/main` and `git branch -u origin/main`.
      3. Confirm with `git status` that it is clean and at `origin/main`.
      4. Confirm that `backend/.env`, `node_modules`, `backend/dist` and `.daml/dist` still
         exist. They are git-ignored, so the reset leaves them alone.

      A clean clone also exists at `/root/tavryn-remote`. It is a scratch copy for audits;
      do not deploy from it. Delete it once `/root/tavryn` is a checkout.

   c. **Baseline before changing anything.** In `/root/tavryn`, all of these must pass on
      the VPS and be recorded as the pre-change baseline:
      - `dpm build`
      - `dpm test`
      - `cd backend && npm ci && npm run build && npm run integration`
      - `npm run settlement-integration`
      - `npm run governance-integration`

      If `dpm test` times out on the script context (seen 2026-10-01), raise the script
      timeout or the participant resources and record what fixed it. Do not skip the test.

5. **Deploy loop on the VPS.** Use this for every landed workstream (A, B, D…):
   1. Commit and push from `/root/tavryn`.
   2. Run `dpm build`, `dpm test` and codegen.
   3. Upload and vet the new DAR on LocalNet, then update `CANTON_PACKAGE_ID` in
      `backend/.env`.
   4. Run `npm ci && npm run build`, then `systemctl restart tavryn-backend`.
   5. Check `curl 127.0.0.1:18787/health`.
   6. Run all integrations and write the evidence JSON.

   If a deploy breaks `/health` or an integration, roll back to the previous commit and
   the previous `CANTON_PACKAGE_ID`, restart, and record what happened.

   **Hard limits.** The VPS hosts other live projects. Never edit, reload or restart the
   host nginx, other systemd units, or other projects' directories, with one exception:
   adding a dedicated Tavryn server block once a hostname exists. Docker changes are
   limited to the Canton/Splice LocalNet compose project (see D5). Never print, commit or
   copy tokens out of `backend/.env` or `.env.devnet`.
6. **Commits.** Author `Jennycruzy`, subject-only messages, no AI attribution trailers.

---

## A. Governance, make the threshold real (Tier 1; this is the BitSafe entry)

### Defects found

| # | Defect | Where |
|---|---|---|
| A-d1 | `governanceParty` alone can call `NetworkRules.AddFinancier` and `SetMaxAdvanceRate`. The committee threshold is optional. | `daml/Tavryn/Contracts.daml:17,25` |
| A-d2 | `maxAdvanceRate` has no governed path, although the submission claims shared control over it. | `Governance.daml` |
| A-d3 | `NetworkRules.members` is never checked. Eligible financiers are hardcoded to A and B in the backend, so an admitted financier can never fund. | `Contracts.daml` `Approve`; `tavryn-service.ts:251` |
| A-d4 | Every invoice, offer and pending funding stores a `NetworkRules` contract ID. Any governance execution archives that contract, so every in-flight invoice fails. The backend reports this as `INVOICE_UNAVAILABLE`. | `Contracts.daml:251,267` |
| A-d5 | `GovernanceCommittee.ReplaceNetworkRules` lets `governanceParty` alone repoint the committee. | `Governance.daml` |
| A-d6 | No governance screen in the UI. | `ui/` |

### Required design

**A1. Operators own the rules; nobody can act alone.**
- `NetworkRules` gets fields `networkId : Text`, `operators : [Party]`, `threshold : Int`,
  `financiers : [Party]`, `participants : [Party]` (buyers, suppliers and auditor that may
  read the rules), `maxAdvanceRate : Decimal`, and `version : Int`.
  - Its signatories are `operators`.
  - Its observers are `financiers ++ participants`.
  - It has **no choices** besides those reached from the committee.
- `GovernanceCommittee` is signed by **all operators**. It is created through a bootstrap
  propose/accept chain: `CommitteeBootstrap` is signed by the operators who have accepted so
  far, and `Accept` by the next operator adds that operator's signature. When the last
  operator accepts, the chain creates the committee and the first `NetworkRules`. This is
  the only way either comes into existence.
- Proposals are generic:
  `data GovernanceAction = AdmitFinancier Party | RemoveFinancier Party | SetMaxAdvanceRate Decimal | AdmitParticipant Party`.
  `FinancierAdmissionProposal` becomes `GovernanceProposal` with `action`, `proposer`,
  `expiresAt : Time`, and `rulesVersion : Int`.
- `Execute` is controlled by any operator. It requires at least `threshold` distinct-operator
  votes for *this* proposal and *this* `rulesVersion`, and requires that the proposal has
  not expired. The choice body runs with the committee signatories' (all operators')
  authority, archives the current `NetworkRules`, and creates the new one with `version + 1`.
- Delete `ReplaceNetworkRules`, `AddFinancier` and `SetMaxAdvanceRate` as standalone choices.
  `governanceParty` disappears as a privileged party. If an "executor" identity is wanted
  for display, it carries no authority.
- Votes stay single-signatory (the operator) and are consumed on execute. A vote for an
  older `rulesVersion` cannot be reused.

**A2. Pass the current rules in; never store them.**
- Remove the `networkRules : ContractId NetworkRules` field from `ApprovedInvoice`,
  `FinancingOffer` and `PendingFunding`. Store `networkId : Text` and the rules `operators`
  instead.
- Every choice that needs rules (`Approve`, `CreateOffer`, `Accept`, `BeginFunding`) takes
  `rulesCid : ContractId NetworkRules` as an argument. It fetches the contract and asserts
  `rules.networkId == networkId && rules.operators == operators`. Rules can only be created
  by the operators and are archived on every change, so there is exactly one active
  `NetworkRules` per network, and the passed contract is current by construction.
- The backend resolves the single active `NetworkRules` for the configured network on every
  call. It never caches a contract ID across requests.

**A3. Membership gates eligibility.**
- `Approve` asserts that every `eligibleFinancier` is in `rules.financiers`.
- `CreateOffer`, `Accept` and `BeginFunding` assert that the financier is in
  `rules.financiers` and `advanceRate <= rules.maxAdvanceRate`. Removing a financier must
  stop its unfunded offers.
- Backend: replace the `financierA` / `financierB` literal union with a configured map
  `TAVRYN_FINANCIERS=financierA:<party>,financierB:<party>,financierC:<party>`. The old
  variables stay as a fallback. Eligible financiers on approval come from the request
  body (`eligibleFinancierRoles`), validated against the current rules' `financiers`.

**A4. Governance in the UI.** Add a "Governance" role view that shows:
- operators, threshold, current rules version and `maxAdvanceRate`, and the financier list;
- open proposals with their vote count against the threshold;
- buttons for propose, vote as operator N, and execute.

  Executing below threshold must show the plain message "Not enough operator approvals
  (1 of 2). Nothing changed." together with the submission reference.

**A5. Decentralization Manager (time-boxed: 4 hours).** Clone `DLC-link/decentralization-manager`
and follow `docs/CUSTOM_DAML_TEMPLATES.md`. If its three-participant compose runs on the
VPS within the time box, point its governed choice at `GovernanceProposal.Execute` and
record update IDs. If not, stop and keep `governance/README.md` as the documented
boundary. Do not select BitSafe **Gold** unless a Decentralized Party really exists on
DevNet or MainNet.

### Acceptance (Daml Script, `daml/Test/Governance.daml`)
- A `NetworkRules` choice submitted by any single operator fails, because there is none.
  `createCmd NetworkRules` by one operator fails authorization.
- Execute with `threshold - 1` votes fails. Execute with `threshold` votes succeeds, and the
  rules version increments.
- A duplicate vote from the same operator does not count. Votes for another proposal or an
  older `rulesVersion` are rejected. An expired proposal cannot execute.
- `SetMaxAdvanceRate 0.5` at threshold, followed by an `Accept` at rate 0.6, fails.
- **The regression for A-d4:** create an approved invoice with an open offer, execute
  `AdmitFinancier C` at threshold, then fund the open offer. Funding **succeeds**.
- An admitted financier C can be made eligible, receive an offer, and fund. A removed
  financier's open offer can no longer be funded.
- Backend: `npm run governance-integration` records the below-threshold 409 and the
  at-threshold update ID for both `AdmitFinancier` and `SetMaxAdvanceRate`, then funds an
  invoice that was opened *before* the governance change.

---

## B. Single-financing and settlement integrity (Tier 1)

### Defects found

| # | Defect | Where |
|---|---|---|
| B-d1 | `BuyerApprovalRegistry` is buyer-signed only, so the buyer can create any number of them (12 are live now). The duplicate-approval guard only covers the one registry passed in. | `Contracts.daml:36`; `POST /api/v1/setup/registry` |
| B-d2 | `ApprovedInvoice.ReopenFunding` lets buyer and supplier together mint a fresh `FundingSlot` at any time, including while a `PendingFunding` has already moved cash. A second financier can then fund the same invoice. | `Contracts.daml:188` |
| B-d3 | `POST /api/v1/pending-funding/:id/cancel` reopens funding without checking whether the cash moved. The contract comment says cancel is only safe before the transfer. | `server.ts:204`, `tavryn-service.ts:394`, `Contracts.daml:329` |
| B-d4 | Several states have no recovery route: `SETTLEMENT_PENDING`, `SETTLEMENT_REFERENCE_UNAVAILABLE`, `SETTLEMENT_LEDGER_FINALIZATION_FAILED`, or a process crash between the transfer and `Complete`. The tracking ID is never persisted, so the cash cannot be matched to its `PendingFunding`. | `tavryn-service.ts fundOffer` |
| B-d5 | If the ledger write fails after a repayment transfer, a retry sends the money again. | `repayWithSettlement` |
| B-d6 | Receipts carry no amount. Invoice currency is silently treated as 1:1 Canton Coin. | `FundingReceipt`, `RepaymentReceipt`, `canton-coin.ts` |
| B-d7 | Every `LedgerApiError` becomes `INVOICE_UNAVAILABLE`, `DUPLICATE_OR_INVALID_APPROVAL` or `GOVERNANCE_THRESHOLD_NOT_MET`, so auth or network failures pass the rival-rejection test. | `tavryn-service.ts:202,313,348` |
| B-d8 | `InvoiceDetails` is never archived (9 are live), contradicting `ARCHITECTURE.md`. | `FinalizeFunding` |
| B-d9 | Losing offers stay active forever and still show as fundable in B's view. | - |
| B-d10 | `Repay` requires `repaymentDate >= dueDate`, so early repayment is impossible. | `Contracts.daml:371` |
| B-d11 | Wallet history lookup reads only the latest 100 items with 10 × 250 ms retries. | `canton-coin.ts findTransaction` |

### Required design

**B1. One registry per buyer, enforced on the ledger.**
- Registry signatories become `buyer` plus the network `operators`, with `networkId`.
- It is created only by an `OnboardBuyer` governance action (A1), which also appends the
  buyer to `rules.participants`. The action asserts that the buyer is not already onboarded.
- `Approve` asserts `registry.networkId == networkId && registry.operators == rules.operators`.
  A buyer-only registry therefore cannot be used.
- Delete `POST /api/v1/setup/registry`. Replace it with a governance action in the
  bootstrap script.
- **Invoice commitment.** If `DA.Crypto.Text.sha256` is available in SDK 3.5.12 (check it;
  do not assume), compute the commitment on the ledger in `Approve` as
  `sha256(canonical terms <> supplier <> buyer <> salt)`, with `salt` held in `InvoiceDetails`.
  If it is not available, the backend computes it and `FINDINGS.md` records that this is a
  trust assumption. Either way, `invoiceCommitment` stops being free text.
- Keep the list-based registry for the MVP. Note in `ARCHITECTURE.md` that approval cost
  grows linearly with approvals; sharding the registry is Tier 2.

**B2. Funding lock that cannot be reopened unilaterally.**
- `BeginFunding` takes `trackingId : Text` and `settlementAmount : Decimal`, and **consumes**
  the `ApprovedInvoice` along with the slot. `PendingFunding` carries everything needed to
  either finalize or restore it: the details contract ID, commitment, eligible financiers,
  auditor, network ID and operators, `trackingId`, and `settlementAmount`.
- Delete `ApprovedInvoice.ReopenFunding`.
- `PendingFunding.Cancel` is controlled by buyer, supplier **and the locking financier**. It
  recreates `ApprovedInvoice` plus a fresh `FundingSlot`. The financier whose cash is at
  stake has to agree, so supplier and buyer cannot reopen behind it.
- `PendingFunding.Complete` takes `paymentReference`. It archives `InvoiceDetails` (B-d8)
  and creates `FinancedInvoice` plus a `FundingReceipt` holding `settlementAmount`,
  `instrument`, `trackingId` and `paymentReference`.
- Keep `FinancingOffer.Accept` only as an off-ledger-settlement path. It requires a
  `paymentReference : Text` and creates a `FundingReceipt` with `instrument = "OFF_LEDGER"`.

**B3. Reconciliation, driven by the ledger.**
- The backend generates `trackingId` **before** `BeginFunding` and passes it in. The wallet
  transfer uses that same `tracking_id` and a description containing it.
- New route `POST /api/v1/pending-funding/:cid/reconcile`. It reads the `PendingFunding`,
  pages the wallet history (until the item is found or the history is older than the
  pending contract's creation), and decides:
  - **transfer found** → `Complete` with its update ID;
  - **transfer instruction still pending** → `409 SETTLEMENT_PENDING`, no change;
  - **no transfer and `expires_at` has passed** → `Cancel`;
  - **anything else** → `409 RECONCILIATION_REQUIRED`, no change.

  The route is idempotent.
- Delete the public `cancel` route. Cancellation happens only through reconcile.
- On startup, and every 60 s, the server lists active `PendingFunding` and
  `PendingRepayment` contracts (B4) older than 30 s and runs reconcile on each. It logs the
  outcomes without secrets.

**B4. Same pattern for repayment.**
- `FinancedInvoice.BeginRepayment(trackingId, amount)`, controlled by buyer and financier,
  consumes the financed invoice and creates `PendingRepayment`.
- The cash transfer follows, then `PendingRepayment.Complete(paymentReference)` creates a
  `RepaymentReceipt` with the amount.
- A retry goes through reconcile and never through a new transfer.

**B5. Amount and instrument.**
- The Canton Coin path requires `terms.currency == CANTON_COIN_SYMBOL` (already in
  `.env.example`, currently unused). Otherwise it returns
  `400 SETTLEMENT_INSTRUMENT_MISMATCH` and points to the off-ledger path. No implicit FX.
- The amount sent equals `settlementAmount` on the contract. The backend asserts the wallet
  item amount equals it before calling `Complete`.

**B6. Early repayment.** Replace `repaymentDate >= dueDate` with
`repaymentDate >= terms.issuedDate`. Record `early = repaymentDate < terms.dueDate` on the
receipt. Remove the matching backend check.

**B7. Truthful error mapping.**
- Add `assertMsg` tags to every business assertion in Daml, for example
  `"TAVRYN_SLOT_CONSUMED"`, `"TAVRYN_NOT_ELIGIBLE"`, `"TAVRYN_RATE_ABOVE_MAX"`,
  `"TAVRYN_DUPLICATE_INVOICE"`, `"TAVRYN_THRESHOLD_NOT_MET"`,
  `"TAVRYN_PROPOSAL_EXPIRED"`.
- `LedgerApiError` keeps the parsed Canton error `code`, `cause` and `errorCategory` from the
  JSON API body (server-side only). It does not log tokens.
- Map the following, using the real 3.5.19 error identifiers as observed. Capture each one
  from a live failing submission and record it in `FINDINGS.md`; do not guess.
  - **To `INVOICE_UNAVAILABLE`:** contract-not-found or inactive on the slot, offer or
    approved invoice; locked contracts (contention); and `TAVRYN_SLOT_CONSUMED`.
  - **To a specific 4xx:** each `TAVRYN_*` tag.
  - **To `502 LEDGER_REQUEST_FAILED` plus the submission reference:** everything else
    (authorization, unknown package, timeouts, transport).
- The integration tests assert the specific mapping. B's rejection must be proven to be
  contention, not just any 409.

**B8. Close losing offers privately.** When `Complete` (or off-ledger `Accept`) runs, the
backend archives the other active offers for that commitment (`FinancingOffer.Withdraw`,
supplier). For each one it creates `OfferClosed { buyer, supplier, financier,
invoiceCommitment }`, signed by buyer and supplier with the financier as observer. It
carries no winner, amount or terms. B's view then shows "This invoice is no longer
available" from a ledger fact instead of a dangling offer.

**B9. Wallet lookup.** Page `/v0/wallet/transactions` using `begin_after_id` (or whatever
the 0.6.11 API exposes; check the OpenAPI) until a match is found or the history is older
than the pending contract. Match on `tracking_id` if the item exposes it, otherwise on the
description. Total bounded wait: 30 s, then return `SETTLEMENT_REFERENCE_UNAVAILABLE` and
leave the contract for the sweeper.

### Acceptance
- **Daml Script, new tests:**
  - an attacker-created buyer-only registry cannot approve;
  - a second `OnboardBuyer` for the same buyer fails;
  - `Cancel` without the financier fails;
  - no choice anywhere lets buyer and supplier recreate a slot while a `PendingFunding`
    exists;
  - `InvoiceDetails` is archived after funding;
  - early repayment succeeds;
  - `OfferClosed` is visible to B and contains no rival data.
- **`npm run settlement-integration` covers four cases:**
  1. the happy path, with amount assertions;
  2. kill the server after the cash transfer and before `Complete` (an env hook
     `TAVRYN_FAULT_AFTER_TRANSFER=1`, honoured only when `NODE_ENV=test`), restart it, and
     the sweeper completes the funding with the same tracking ID;
  3. a transfer rejected by the wallet → reconcile cancels and the invoice is fundable again;
  4. a repayment retry does not move cash twice (compare wallet balances before and after).
- **Backend unit tests** (`node --test`) for error mapping and the reconcile decision
  function, using recorded real response bodies captured from the VPS as fixtures. These
  test parsing only, never ledger behaviour.

---

## C. Privacy claims, fix the model or fix the words (Tier 1 = words; Tier 2 = model)

### Facts
- A financier who receives an offer sees the full `InvoiceTerms` (amount, currency, dates,
  external number) via `FinancingOffer.terms`. `README.md:34-35` says it cannot. A lender
  must see the terms to price, so this is correct product behaviour and a wrong claim.
- `ApprovedInvoice` and `FundingSlot` list every eligible financier as observers, so each
  eligible financier learns the buyer–supplier pair **and the names of its rivals**. That
  contradicts "no financier ever sees a rival's clients".

### C1 (Tier 1). Correct the copy in `README.md`, `ARCHITECTURE.md`, `SUBMISSION.md` and
`TAVRYN_PROJECT_PROFILE.txt`:
- A financier offered an invoice sees that invoice's terms.
- It never sees another financier's offer, price, or win.
- Eligible financiers can see which other financiers were eligible on the same invoice
  (stated as a current limit, until C2).

Also fix the stale lines saying the P3 gate is open (`TAVRYN_PROJECT_PROFILE.txt:47`,
`SUBMISSION.md:101`).

### C2 (Tier 2). Remove rival names from shared payloads:
- `FundingSlot { buyer, supplier, invoiceCommitment, nonce }` has no observers.
- `ApprovedInvoice` has no financier observers.
- Eligibility is enforced when an offer is created.
- The funding financier submits with the slot (and the approved invoice it needs) as
  **explicitly disclosed contracts** supplied by the supplier's service alongside the offer.
  The slot payload then contains only the commitment.
- Check against the Canton 3.5 explicit-disclosure documentation and prove it with a
  multi-participant test (D2). Until then, C1's wording stands.

---

## D. Platform (Tier 1 items marked; rest Tier 2)

**D1 (Tier 1 if a public link is submitted). Access control.**
- Today any caller picks its role in the request body, and the backend submits as every
  party.
- For the hackathon: all `/api/*` routes, reads included, require a
  `TAVRYN_DEMO_ACCESS_TOKEN` presented as an `HttpOnly` cookie set by `POST /api/v1/session`
  with the passphrase.
- Add a per-IP rate limit on writes (for example 30/min). Keep the server bound to
  `127.0.0.1` behind the host nginx with TLS.
- A public read-only mode may show the static landing page only.
- For the product (Tier 2): OIDC per organization; the session maps user → party; the
  role is never taken from the request.

**D2 (Tier 2, production blocker). One organization, one participant.**
- `Accept`, `BeginFunding`, `Complete` and `Cancel` need `actAs` for buyer, supplier and
  financier in a single submission. That only works because one backend hosts every party.
- Convert to the delegation pattern:
  - `FinancingOffer` is signed by buyer and supplier, which pre-authorizes funding;
  - `BeginFunding` is controlled by the **financier alone** and runs with the offer
    signatories' authority;
  - `Complete` and `Cancel` follow the same one-controller-per-step propose/accept pattern.
- Prove it with three participants (supplier/buyer, financier A, financier B), each
  submitting with its own user.
- This is also the prerequisite for any wallet integration (Grofty, section E).

**D3 (Tier 1). Bootstrap and reset.**
- `npm run bootstrap` is idempotent. It finds or creates the committee, rules, buyer
  onboarding and registry for `TAVRYN_NETWORK_ID`, and prints their IDs.
- Integration scripts reuse it instead of creating new rules and registries each run.
- The UI stops creating rules and registries; "setup" becomes read-only status.

**D4 (Tier 1). UI click-through.**
- With A–C in place, record a real browser run with Playwright or Chrome DevTools: create,
  approve, two offers, A funds, B sees "This invoice is no longer available", repay, the
  auditor trail, then governance below and at threshold.
- Save the screenshots and video under `docs/evidence/`, and promote P5.

**D5 (Tier 1). LocalNet health on the VPS.** The LocalNet `nginx` container is in a restart
loop (`host not found in upstream "splice"` in `app-provider.conf:6`), and
`splice-onboarding` is unhealthy.
- Find out why before the DevNet run. They are probably on different Docker networks after
  a recreate.
- Change only the LocalNet compose project. Never the host nginx.
- Confirm with the owner whether ports 2975, 3901–3903 and 3975 should be published on
  `0.0.0.0`. If they should be loopback-only, bind them to `127.0.0.1` in the compose
  override. UFW does not filter Docker-published ports.

**D6 (Tier 2). Invoice ingestion (gate P6).**
- `POST /api/v1/invoices/extract` takes a PDF or image, extracts the fields that make up
  `InvoiceTerms`, and returns them with a confidence value per field. The extraction engine
  is the owner's choice: PDF text plus rules, or an LLM.
- The supplier corrects the fields in the UI before the draft is created. Each correction
  (field, extracted, corrected) is stored in `fixtures/invoices/<id>/corrections.json`.
- The three fixtures must be owner-provided or clearly labeled synthetic. Their provenance
  goes in `fixtures/invoices/README.md`.

**D7 (Tier 1). Docs sync.**
- Update `PROGRESS.md` gates and `REMAINING.md` for each item landed.
- `ARCHITECTURE.md` gets the new choice graph: bootstrap → rules → approve → offer →
  `BeginFunding` → `Complete`/`Cancel` → `BeginRepayment` → `Complete`.
- `FINDINGS.md` gets the captured error identifiers and the `sha256` availability result.

---

## E. DevNet, Grofty, Mana and the other owner items

**E1. DevNet (gate P7, Tier 1). No validator is run.**

Official endpoints, from the AppsFactory HackCanton S3 dashboard ("Hackathon DevNet
Sandbox"). The dashboard says: sign in with the same email and password as the HackCanton
platform; the node is shared by all teams, so put no sensitive data on it.

| Resource | Endpoint |
|---|---|
| Console (parties, DAR upload, user rights) | `https://console.participant.hackcanton-01.devnet.naas.noders.services` |
| JSON Ledger API | `https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services` |
| gRPC Ledger API | `ledger-api-grpc.participant.hackcanton-01.devnet.naas.noders.services:443` |
| Wallet UI | `https://wallet.validator.hackcanton-01.devnet.naas.noders.services` |
| Validator / Scan API (Canton Coin wallet API) | `https://validator-api-http.validator.hackcanton-01.devnet.naas.noders.services` |
| Logs (Grafana) | `https://grafana.participant.hackcanton-01.devnet.naas.noders.services` |
| OIDC token URL | `https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token` |
| Token audience | `https://hackcanton-01.devnet.naas.noders.services` |

- The OIDC client ID is not on the dashboard. Take it from the linked guide "Canton DevNet
  Quickstart, HackCanton shared node", or from the console's own login request. Record
  it in `FINDINGS.md`; it is not a secret.
- **Credential handling.** The login is the owner's personal HackCanton account.
  - Prefer an offline refresh token over the password: Keycloak `scope=offline_access`,
    obtained once by the owner.
  - If a password grant is unavoidable, the password lives only in
    `/root/tavryn/backend/.env.devnet` (mode 600). It is never logged.
  - The owner rotates the password after the hackathon.
- Validator wallet API paths on DevNet sit under the Validator API host above. Verify the
  exact `/api/validator/v0/wallet/...` prefix against that host's OpenAPI before the
  settlement integration.
- HackCanton S3 provides shared DevNet participant nodes run by NODERS / AppsFactory. Teams
  seen so far used `hackcanton-01` and `hackcanton-devnet-3`. Each team is a guest tenant on
  such a node.
- How other S3 teams did it (Earnout Settlement Ledger, Composition Protocol, Veil,
  QuorumVault):
  - **Login.** A Keycloak account in realm `noders-appsfactory`. Tokens come from
    `https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token`,
    either by OIDC password grant (client ID, username, password) or by refreshing an
    offline token. Some teams copied the token from the node's console or "Console Wallet".
  - **Parties and DAR.** Both are handled out of band through the node console: parties
    are allocated in the team's tenant namespace, and the DAR is uploaded there. The shared
    node may refuse a DAR upload through the API, so treat a refused API upload as
    expected, not as an error.
  - **Ledger API.** The JSON Ledger API endpoint is, for example,
    `https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services`.
    One ledger user holds `actAs` for all the team's parties.
- Treat all of these as leads; the owner's own console and credentials are authoritative.
- **Build item, required for DevNet.** The backend currently takes a static
  `CANTON_LEDGER_API_TOKEN`, and shared-node tokens expire.
  - Add `CANTON_OIDC_TOKEN_URL`, `CANTON_OIDC_CLIENT_ID`, `CANTON_OIDC_USERNAME`,
    `CANTON_OIDC_PASSWORD`, an optional `CANTON_OIDC_REFRESH_TOKEN`, and an optional
    `CANTON_OIDC_AUDIENCE`.
  - Fetch the token, cache it until 60 s before expiry, and refresh it on a 401 once
    before failing.
  - The static token remains the LocalNet fallback.
  - The bootstrap reads parties from the user's rights (`GET /v2/users/{id}/rights`)
    instead of requiring every party ID by hand. It verifies that the configured package
    ID is vetted on the node.
- The owner obtains:
  - JSON Ledger API URL;
  - token endpoint plus client ID/secret (or user credentials);
  - Ledger API user ID;
  - **at least 9 parties with `actAs` on that user:** supplier, buyer, financier A,
    financier B, candidate financier C, auditor, and 3 operators;
  - synchronizer ID;
  - permission to upload and vet `tavryn-0.1.4.dar`;
  - for the Canton Coin path: the validator wallet API URL, wallet tokens for buyer and
    financier A, and DevNet CC in those wallets.
- Known trap from another team: two "operators" resolved to the same Keycloak user. Ask
  explicitly for distinct parties. One user with `actAs` on all of them is fine for the
  MVP backend.
- Handover: the owner writes the values to `/root/tavryn/backend/.env.devnet` on the VPS
  (`chmod 600`). They never go in chat, commits or evidence files.
- The backend gets `TAVRYN_ENV_FILE` support, and the three integrations plus bootstrap run
  with `TAVRYN_ENV_FILE=.env.devnet`.
- Evidence: `docs/evidence/P7_DEVNET_<date>.json` with update IDs only.

**E2. Grofty (gate P8). Feasible for the cash leg only; do it after Tier 1 steps 0–5.**
- The bounty needs users to connect, sign and transact with Grofty in the core flow. The
  HackCanton dashboard lists Grofty with "dApp connection via CIP-0103". CIP-0103 is the
  standard Canton dApp API (`getPrimaryAccount`, `listAccounts`, `prepareExecute`,
  `prepareExecuteAndWait`, `signMessage`). Connect through
  `@canton-network/dapp-sdk`, or PartyLayer (`partylayer.xyz`), which wraps it.
- **Scope that fits.** Tavryn's settlement is already two-step: a cash transfer, then a
  ledger record. Let the financier pay the funding leg, and the buyer the repayment leg,
  **from Grofty**:
  1. The UI connects Grofty.
  2. The UI requests a Canton Coin token-standard transfer to the supplier or financier
     party via `prepareExecuteAndWait`. The transfer must carry Tavryn's `trackingId` in
     its description or metadata.
  3. The backend's reconcile path (B3) finds the transfer by `trackingId` and completes
     `PendingFunding` or `PendingRepayment`.

  This needs no Tavryn DAR on Grofty's participant, because the Amulet / token-standard
  packages exist on every node.
- **Out of scope.** Signing Tavryn's own choices in Grofty. That needs D2 (single-controller
  choices) and the Tavryn DAR vetted on the participant that hosts the Grofty party.
- **Gating check, done first and taking at most 1 hour.**
  1. Install the Grofty extension and confirm it can operate on **DevNet**, against the
     same synchronizer as `hackcanton-01`.
  2. Confirm it exposes the CIP-0103 provider to a page served from the Tavryn origin.
  3. Confirm that a transfer to a `hackcanton-01` party lands, and that its update ID
     appears in the receiver's wallet history.

  If Grofty is MainNet-only, or any step fails, stop. Add the exclusion paragraph to
  `SUBMISSION.md` and do not select the bounty.
- **Wallet mapping.** The Grofty party paying is the financier or buyer, so that party
  must be the one configured for the role. In Grofty mode the configured financier or
  buyer party is read from the connected account, and the backend wallet token for that
  role is not used.
- **Acceptance.** Recorded evidence of one funding and one repayment signed in Grofty,
  with the wallet update IDs and the Tavryn ledger update IDs.

**E2a. Owner's 1-minute Grofty pre-check (do this before Codex spends any time).**
1. Install the Grofty extension from the Chrome Web Store.
2. Open its settings and look for a **network selector**.
3. If **DevNet** is listed, tell Codex "Grofty DevNet: yes" and fund the wallet from the
   DevNet faucet or tap. If only MainNet appears, tell Codex "Grofty DevNet: no". Codex
   then writes the exclusion and does not select the bounty.

**E1a. Owner's DevNet steps (about 10 minutes).**
1. Sign in at the console URL in E1 with the HackCanton platform email and password.
2. Open the dashboard link "Canton DevNet Quickstart, HackCanton shared node" and note
   the OIDC client ID.
3. If the console offers an offline or refresh token, use that. Otherwise put the
   password in `/root/tavryn/backend/.env.devnet` on the VPS (`chmod 600`). Never put it
   in chat or a commit.
4. Tell Codex the file is ready. Codex creates or reads the parties, uploads the DAR
   through the console if the API refuses it, and runs E1.

**E3. Mana (gate P0).** The owner confirms whether the HackCanton "Mana" day-1 activity was
completed. If yes, add the date and artifact. If no, leave P0 unclaimed.

**E4. Interviews, demo video and public link.** These are owner-run (see `REMAINING.md`).
Build-side support:
- `DEMO.md` gets a timed script matching D4;
- nginx server-block and certbot instructions are ready for the hostname, but are not
  applied until the hostname exists.

---

## Tier 1 order of work (fits before submission)

0. VPS setup from section 0 rule 4: toolchain, git checkout, baseline green.
1. Daml 0.1.4: A1–A3, B1, B2, B5–B8 tags and shapes. Full `dpm test` green.
2. Codegen, package-scoped reads, bootstrap (D3).
3. Backend: B3 reconcile and sweeper, B4, B7 mapping, B9, A3 configurable financiers.
4. Deploy to the VPS LocalNet using the section 0 loop (pre-authorized). All three
   integrations green, evidence JSON written.
5. UI governance view (A4), D1 access control, D4 recorded click-through.
6. DevNet (E1) as soon as credentials exist. Run it in parallel with step 5 if they
   arrive early.
7. Docs sync (C1, D7), Grofty decision (E2), then the demo video.

Tier 2 (C2, D2, D6, A5 beyond its time box, registry sharding) goes in `REMAINING.md` as the
production roadmap, worded as roadmap and not as shipped.
