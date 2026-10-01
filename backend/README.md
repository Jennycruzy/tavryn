# Tavryn backend

This service submits each workflow action through Canton’s JSON Ledger API and reads
active contracts through the selected role’s party view. Existing workflow declarations
use the generated Daml bindings in `daml.js/`. The P3 settlement choices have a narrow
source-matched compatibility binding in `src/settlement-contracts.ts` because the host
Java runtime is currently unavailable for `dpm codegen-js`; final clean-machine setup
must regenerate bindings from the DAR before reproducibility is claimed.

## Local run

1. Build the DAR from the repository root with the pinned DPM SDK.
2. Generate bindings from that DAR into `backend/daml.js`.
3. Copy the participant-provided values into `backend/.env`. The file is ignored and
   must never contain committed credentials.
4. Install and run:

```sh
npm install
npm run build
npm start
```

Required values are listed in the root `.env.example`: the JSON Ledger API URL, the
participant user ID when the participant requires one, all six party IDs, and the local
HTTP port. Party IDs are allocated by the actual participant setup; this repository does
not provide defaults.

The integration test is an actual HTTP-to-ledger run, not a Daml Script substitute:

```sh
npm run integration
```

It creates an invoice, approves it, creates offers for both financiers, funds it with A,
proves B’s ledger rejection and party-scoped view, repays it, and attempts a duplicate
buyer approval. Successful actions print real Canton update IDs.

When a Splice-backed validator is configured, settlement uses the real token-standard
wallet API rather than the ledger-only proof path:

```text
POST /api/v1/offers/:offerCid/fund
POST /api/v1/financed/:financedCid/settle-repay
```

Funding first consumes the ledger `FundingSlot`, transfers Canton Coin, then completes
`PendingFunding` with the wallet update reference. This is deliberately two-step and
non-atomic; a failed follow-up remains visible for reconciliation.

For the hackathon demo one local process can submit on behalf of the configured parties.
Production deployment must give each organization its own participant or wallet and
authentication boundary.
