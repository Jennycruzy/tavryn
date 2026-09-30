# Tavryn

Every invoice can be pledged once. Prove it without revealing it.

Tavryn is a Canton/Daml supply-chain-finance workflow for reverse factoring. A buyer
approves a supplier invoice, the supplier offers it separately to financiers, and the
first financier to accept consumes the one-use funding state. A rival sees only its own
offer and an opaque approval seal; it cannot read the winning financier's deal.

## Status

This repository is a new build. The project name Tavryn was selected on 2026-09-29. No
LocalNet, DevNet, MainNet, settlement, interview, or governance result is claimed until
it has a recorded artifact in `docs/PROGRESS.md`.

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
seal. Eligible financiers can see the seal and compete for one `FundingSlot`, but they
cannot see the amount, currency, dates, or another financier's offer. The winning
financier joins the consuming choice and receives the resulting receivable. This is a
source-driven deviation from the literal template shape in the build specification; the
reason and evidence are recorded in [`docs/FINDINGS.md`](docs/FINDINGS.md).

## Current verification boundary

The official DPM installer selected and installed SDK 3.5.12 on 2026-09-29. The project
build and core Daml lifecycle test pass locally; no LocalNet, DevNet, MainNet, settlement,
or governance result is implied. Source-backed decisions and open discrepancies live in
[`docs/FINDINGS.md`](docs/FINDINGS.md). Phase gates and evidence live in
[`docs/PROGRESS.md`](docs/PROGRESS.md).

Settlement is not yet claimed. The implementation will first prove plain Canton Coin
transfer and then test allocation inside the funding choice. The README will be updated
with the actual atomic or two-step path only after a real update ID is captured.

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
dpm codegen-js .daml/dist/tavryn-0.1.0.dar -o backend/daml.js -s tavryn.js
cp .env.example backend/.env
# Fill backend/.env with values returned by the running participant.
cd backend
npm install
npm run build
npm run integration
```

`DPM_BIN` and `JAVA_RUNTIME` above are placeholders for paths installed on the machine;
they are not values to copy into the repository. `backend/.env` is ignored from the first
commit. The backend integration drives the real JSON Ledger API and records Canton update
IDs; it does not replace the ledger with a mock.

## Honest limits

- Duplicate creation is prevented by the buyer approval service checking each external
  invoice number once; this is an explicit trust assumption.
- An invoice financed with a lender outside this network cannot be detected.
- The MVP backend may submit demo roles centrally; production requires each organization
  to operate its own participant or wallet.
- Settlement will be described as atomic or two-step according to the evidence, never by
  aspiration.

## Business materials

- [`docs/BRIEF.md`](docs/BRIEF.md) — one-page business brief
- [`docs/PILOT.md`](docs/PILOT.md) — pilot plan and required integrations
- [`docs/VALIDATION.md`](docs/VALIDATION.md) — interview log; no interviews are invented

## Demo and deployment

Demo video, DevNet update IDs, repository URL, and project-profile links are pending real
execution and will be added here before submission. A link is not considered delivered
until it opens in a private browser window.

## Pre-existing code and AI assistance

There is no pre-existing Tavryn code in this repository. AI-assisted tools contributed to
development; the team reviewed the work and is responsible for all code and claims.
