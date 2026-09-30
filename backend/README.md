# Tavryn backend

This service submits each workflow action through Canton’s JSON Ledger API and reads
active contracts through the selected role’s party view. It uses the generated Daml
bindings in `daml.js/`; template and choice identifiers are not hand-written.

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

For the hackathon demo one local process can submit on behalf of the configured parties.
Production deployment must give each organization its own participant or wallet and
authentication boundary.
