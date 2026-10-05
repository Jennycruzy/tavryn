# Remaining Tavryn work

The `tavryn-network` 0.1.4 model is built, tested and deployed on the selected VPS
LocalNet (see `PROGRESS.md`, gates P1–P5). What remains needs an external credential, an
owner decision, or a real human interaction; none of it is claimed without its artifact.

## Landed in 0.1.4

- Rules change only with a threshold of distinct operator votes; no party can change them
  alone, and a governance change no longer breaks invoices already in flight.
- Membership and the maximum advance rate gate approval, offers and funding.
- One operator-signed approval registry per buyer, created only by governance.
- The invoice commitment is computed on the ledger.
- Funding consumes the approved invoice with the slot; cancelling needs the locking
  financier; settlement amounts and instruments are checked on the ledger and recorded on
  the receipts; early repayment is allowed.
- Reconciliation by tracking ID with a background sweeper; a retried repayment cannot pay
  twice.
- Losing financiers get an `OfferClosed` fact with no winner, amount or terms.
- Canton errors are mapped by identifier; auth, package and transport failures stay 502.
- OIDC token support and `TAVRYN_ENV_FILE` for DevNet; idempotent `npm run bootstrap`.
- UI governance view and a recorded browser click-through.

## Owner-required handoff

| Item | Needed from the owner | Finish action |
|---|---|---|
| Invoice fixtures (P6) | Three permissioned invoices, or approval to use clearly labelled synthetic ones | `fixtures/invoices/` with provenance |
| Interviews (P9) | Five real, consented conversations | Dates and anonymized notes in `INTERVIEWS.md` and `VALIDATION.md` |
| Demo video (P10) | A recording of `DEMO.md` under five minutes | Link and checksum |
| Public link (P11) | A hostname with DNS pointing at the VPS | Dedicated nginx server block and TLS, checked in a private window |

## Production roadmap (not shipped)

- One participant or wallet per organization, with single-controller choices so each
  party signs its own step; OIDC sessions that map a user to a party.
- Remove rival financier names from shared payloads with explicit disclosure, proven
  across participants.
- Shard the approval registry; page large role views past the JSON API list limit.
- Invoice ingestion with extraction and supplier corrections.
- Decentralization Manager integration for the governance committee.
