# Tavryn server: developer guide

The server serves the web app and talks to a Canton participant through its JSON Ledger
API. It also moves Canton Coin through a validator's wallet API.

## Setup

Requirements: Node.js 20+, the Daml package manager `dpm` (SDK 3.5.12) with Java 17, and a
Canton participant: a local network or the HackCanton DevNet node.

```sh
# from the repository root
dpm build                    # .daml/dist/tavryn-network-0.1.4.dar
dpm test                     # contract tests
dpm codegen-js .daml/dist/tavryn-network-0.1.4.dar -o backend/daml.js -s tavryn.js

cd backend
npm ci
npm run build
npm test                     # unit tests
cp ../.env.example .env      # then fill it in (see below)
npm run bootstrap            # create or find the network; safe to run again
npm start
```

Upload the DAR to the participant first (on the HackCanton node: Console → Collections →
Upload DAR) and put its package ID in `CANTON_PACKAGE_ID`.

## Settings

All settings are listed in [`.env.example`](../.env.example). The main ones:

| Setting | What it is |
|---|---|
| `CANTON_LEDGER_API_URL` | The participant's JSON Ledger API |
| `CANTON_LEDGER_API_TOKEN` or `CANTON_OIDC_*` | A fixed token (local network) or a login that refreshes itself (shared nodes) |
| `CANTON_USER_ID`, `CANTON_PACKAGE_ID` | Your ledger user and the uploaded package |
| `SUPPLIER_PARTY_ID`, `BUYER_PARTY_ID`, `AUDITOR_PARTY_ID` | One party per company |
| `TAVRYN_FINANCIERS` | Lenders as `financierA:<party>,financierB:<party>,…` |
| `GOVERNANCE_OPERATOR_*_PARTY_ID`, `GOVERNANCE_THRESHOLD` | The network admins, and how many must agree |
| `CANTON_COIN_SYMBOL`, `CANTON_VALIDATOR_API_URL`, `CANTON_WALLET_TOKEN_*` | Canton Coin payments |
| `TAVRYN_DEMO_ACCESS_TOKEN`, `TAVRYN_DEMO_PASSPHRASE` | Optional passphrase for a public demo |

Use another settings file with `TAVRYN_ENV_FILE`, for example
`TAVRYN_ENV_FILE=.env.devnet npm start`. Never commit either file.

## Upgrading the contract package

After uploading a new version of `tavryn-network`, set `CANTON_PACKAGE_ID` to the new
package ID and list the earlier IDs in `CANTON_PREVIOUS_PACKAGE_IDS` (comma-separated).
Commands use the new version; reads keep showing contracts created under the earlier ones.

## Company accounts and invoice files

Set `TAVRYN_ACCOUNTS_FILE` to an accounts file made by
`npx tsx scripts/create-accounts.ts <path> [--demo]` (keep it outside the repository).
Each account belongs to one company; `--demo` publishes fictional demo passwords on the
sign-in page. Without the setting the server runs open, as the tests expect.

Set `TAVRYN_DOCUMENTS_DIR` to let suppliers attach the invoice PDF or photo (under 1 MB).
The buyer, the auditor and the lenders offered that invoice can open it. A file already
attached to one invoice number is refused for another.

## Starting a demo from a clean page

Set `TAVRYN_VIEW_FROM_OFFSET` to the current ledger end (shown by `GET /health`, plus one)
and restart. Each company's page then shows only invoice activity from that point on.
Nothing is archived: removing the setting shows the full history again. The network rules
are always shown.

## Automated checks

Each runs against a real network, not a mock:

```sh
npm run integration              # two lenders fund at once; one wins, one is refused
npm run governance-integration   # rule changes refused with one approval, applied with two
npm run settlement-integration   # Canton Coin payments, including interrupted ones
node ../scripts/ui-clickthrough.mjs <folder>   # browser walkthrough with video
```

Helpers for the shared DevNet node are in `scripts/`: `devnet-check.ts` (login and
permissions), `devnet-configure.ts` (fills in parties and package) and
`devnet-upload.ts`. `devnet-settlement.ts` funds one invoice with real Canton Coin from
a DevNet wallet (prerequisites at the top of the file). `naira-offledger.ts` runs the
synthetic Lagos invoice through the bank-reference path.

## How payments work

Paying for an invoice takes two steps: the invoice is reserved, then the Canton Coin is
sent with a tracking ID, then the record is completed. If anything stops in between, the
server's background check (every minute) finds the payment by its tracking ID and finishes
it, or releases the invoice if no payment was made. A repayment can never be sent twice.

## API

| Method and path | Who | Does |
|---|---|---|
| `GET /api/v1/network` | anyone | Rules, lenders, admins and open proposals |
| `GET /api/v1/roles/:role/contracts` | anyone | What that company can see |
| `POST /api/v1/invoices/drafts` | supplier | Create an invoice |
| `POST /api/v1/invoices/drafts/:id/approve` | buyer | Approve it, naming eligible lenders |
| `POST /api/v1/invoices/approved/:id/offers` | supplier | Offer it to a lender |
| `POST /api/v1/offers/:id/fund` | lender | Pay in Canton Coin |
| `POST /api/v1/offers/:id/accept` | lender | Record a payment made outside the network |
| `POST /api/v1/financed/:id/settle-repay` | buyer | Repay in Canton Coin |
| `POST /api/v1/financed/:id/repay` | buyer | Record a repayment made outside the network |
| `POST /api/v1/pending-funding/:id/reconcile` | any | Finish or release an interrupted payment |
| `POST /api/v1/pending-repayment/:id/reconcile` | any | Same for a repayment |
| `POST /api/v1/governance/proposals` | admin | Propose a rule change |
| `POST /api/v1/governance/proposals/:id/votes` | admin | Approve it |
| `POST /api/v1/governance/proposals/:id/execute` | admin | Apply it, if enough admins approved |

With company accounts on, each company signs in and the server lets it act only as itself:
the role comes from the session, never from the request body. One ledger connection still
submits every company's steps; in real use each company would run its own connection to
the network and sign its own steps.
