# Tavryn

Every invoice can be pledged once. Prove it without revealing it.

## In simple terms

Tavryn is a shared invoice-finance workspace:

1. A supplier submits an invoice.
2. The buyer approves it once.
3. Financiers make private offers.
4. The first financier to fund wins; a second attempt is rejected.
5. The buyer repays the winning financier.

The core workflow works on the local Canton network. The cash transfer and the ledger
record are currently two separate steps, so a real deployment still needs payment
reconciliation. Browser proof, DevNet proof, interviews, and a public demo link are still
open; the short checklist is in [`docs/REMAINING.md`](docs/REMAINING.md).

For a public demo, set `TAVRYN_DEMO_ACCESS_TOKEN` in the server environment. Tavryn then
asks for the demo passphrase before allowing API actions; leave it empty for a local,
private run.

Tavryn is a Canton/Daml supply-chain-finance workflow for reverse factoring. A buyer
approves a supplier invoice, the supplier offers it separately to financiers, and the
first financier to accept consumes the one-use funding state. A rival sees only its own
offer and an opaque approval seal; it cannot read the winning financier's deal.

## Status

This repository is a new build. The project name Tavryn was selected on 2026-09-29.
The core lifecycle, party-scoped backend flow, real two-step Canton Coin settlement, and
threshold governance flow have passed on LocalNet/the selected VPS. DevNet, MainNet, and
interview results remain open until each has a recorded artifact in `docs/PROGRESS.md`.

## What will be demonstrated

- Create: supplier submits an `InvoiceDraft`.
- Update status: buyer approves it once through its approval service.
- Transfer: one financier accepts its own `FinancingOffer`; the one-use `FundingSlot` and
  terms-free approval seal are consumed and replaced by a `FinancedInvoice`.
- Fulfill: buyer repays the financier and creates a `RepaymentReceipt`.
- Audit: an auditor is made an observer of the complete lifecycle.
- Rejection proof: a second financier's acceptance references an archived invoice and is
  rejected, while its party view contains no rival contract data.

The model deliberately does not depend on Canton contract-key uniqueness. The buyer's
approval service is the single maintainer of external invoice numbers; the ledger's
single-consumption rule enforces the single financing attempt after approval.

Because a non-stakeholder cannot exercise a hidden contract without disclosure, the
implementation separates private `InvoiceDetails` from a terms-free `ApprovedInvoice`
seal. A financier offered an invoice sees that invoice's terms so it can price the deal,
but never sees another financier's offer, price, or win. In the current model, every
eligible financier can see which other financiers were eligible for the same invoice;
removing those rival names requires the explicit-disclosure design tracked in
[`docs/REMAINING.md`](docs/REMAINING.md). The winning financier joins the consuming choice
and receives the resulting receivable.

## Current verification boundary

The official DPM installer selected and installed SDK 3.5.12 on 2026-09-29. The project
builds, the complete core and governance Daml tests pass, and the backend has passed its
LocalNet lifecycle and settlement integrations. No DevNet, MainNet, or interview result is
implied. Source-backed decisions and open discrepancies live in
[`docs/FINDINGS.md`](docs/FINDINGS.md). Phase gates and evidence live in
[`docs/PROGRESS.md`](docs/PROGRESS.md).

Settlement now has a real two-step implementation against the Splice token-standard
wallet API. `FinancingOffer.BeginFunding` consumes the one-use slot, the backend moves
Canton Coin, and `PendingFunding.Complete` records the wallet update reference in an
auditor-visible `FundingReceipt`. Repayment follows the same pattern. This is not atomic;
the cash transfer and Tavryn ledger update are separate transactions. The successful
end-to-end LocalNet evidence is recorded in
[`docs/PROGRESS.md`](docs/PROGRESS.md).

## Repository layout

```text
daml/        contracts and Daml Script tests
backend/     role-scoped submission and reads
ui/           role-switching demonstration UI
governance/  Decentralization Manager integration or documented contribution
docs/        evidence, findings, architecture, brief, pilot and validation
spikes/      throwaway proofs for risky paths; not product code
```

## Clean-machine setup

Install the official DPM release and Java runtime required by that release, then run the
following from a clean checkout. The exact party IDs, participant URL, user ID,
synchronizer ID, token-admin ID, symbol and fees must come from the participant/network
setup; none are repository defaults.

```sh
export PATH="$DPM_BIN:$PATH"
export JAVA_HOME="$JAVA_RUNTIME"
dpm build
dpm test
dpm codegen-js .daml/dist/tavryn-network-0.1.4.dar -o backend/daml.js -s tavryn.js
cp .env.example backend/.env
# Fill backend/.env with values returned by the running participant.
cd backend
npm install
npm run build
npm test
npm run bootstrap          # idempotent: committee, rules and buyer registry
npm run integration
npm run governance-integration
npm run settlement-integration
```

For a shared DevNet node, put the OIDC settings in `backend/.env.devnet` and prefix each
command with `TAVRYN_ENV_FILE=.env.devnet`.

`DPM_BIN` and `JAVA_RUNTIME` above are placeholders for paths installed on the machine;
they are not values to copy into the repository. `backend/.env` is ignored from the first
commit. The backend integration drives the real JSON Ledger API and records Canton update
IDs; it does not replace the ledger with a mock.

When the backend is running, open its root URL in a browser to use the Tavryn UI. The page
switches between the configured party views, reads contracts through the matching role
route, and submits the same create, approve, offer, fund, rejection, and repayment
operations as the integration client. The UI intentionally shows safe operation and
submission references instead of raw ledger errors. A browser recording is still required
before the P5 gate is claimed complete.

## Honest limits

- Within the participating network, an invoice can be financed once. Financing by a lender
  outside the network cannot be detected.
- Each buyer's approval registry is created by governance and refuses a second approval
  of the same external invoice number; the operators can read those numbers.
- An eligible financier can see which other financiers were eligible for that invoice,
  though never their offers, prices or wins.
- Settlement is two-step and not atomic; reconciliation by tracking ID completes or
  cancels any lock left between the cash transfer and the ledger record.
- The demo backend submits for every party through one ledger user; production requires
  each organization to operate its own participant or wallet.

## Business materials

- [`docs/BRIEF.md`](docs/BRIEF.md) — one-page business brief
- [`docs/PILOT.md`](docs/PILOT.md) — pilot plan and required integrations
- [`docs/VALIDATION.md`](docs/VALIDATION.md) — interview log; no interviews are invented

## Demo and deployment

LocalNet lifecycle and settlement update IDs are recorded in `docs/PROGRESS.md`. Demo
video, DevNet update IDs, and project-profile links remain pending and will be added before
submission. A link is not considered delivered until it opens in a private browser window.
The exact owner inputs for those remaining items are listed in
[`docs/REMAINING.md`](docs/REMAINING.md).

## Pre-existing code and AI assistance

There is no pre-existing Tavryn code in this repository. AI-assisted tools contributed to
development; the team reviewed the work and is responsible for all code and claims.
