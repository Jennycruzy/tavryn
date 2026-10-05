# Remaining Tavryn work

The core build is complete and reproducible on the selected VPS. The remaining items
need an external owner, an external credential, or a real human interaction; none should
be represented as completed without its artifact.

## Completed and stable

- Core Daml lifecycle and threshold governance tests pass with the full DPM suite.
- The 0.1.3 DAR is deployed on the selected Canton Builder LocalNet.
- The backend is supervised by `deploy/tavryn-backend.service` and the health endpoint is
  live.
- Core backend, two-step Canton Coin settlement, and governance integration clients have
  passed against the VPS.
- The role-switching UI renders in headless Chrome; all six role-scoped routes return 200.

## First fixes now landed

- Early repayment is allowed after the invoice issue date; the Daml lifecycle test covers
  an early repayment date.
- Participant failures are no longer shown as if a rival financier won; real funding
  conflicts remain a clear 409 and other ledger failures keep their submission reference.
- A public demo can be protected with a simple passphrase session using
  `TAVRYN_DEMO_ACCESS_TOKEN`; local runs remain open when it is unset.
- The unsafe public pending-funding cancel route is disabled until reconciliation exists.
- Canton Coin settlement now checks the configured invoice currency before sending cash,
  and public API writes are limited per client to reduce accidental or abusive retries.
- The UI and README explain the workflow in plain language and no longer say that offer
  terms are hidden from the financier receiving them.

## Owner-required handoff

| Item | Needed from the owner | Finish action |
|---|---|---|
| Mana day-1 proof | Confirmation that Mana activity was completed, or permission to leave it unclaimed | Add the date and permitted artifact to `docs/PROGRESS.md` |
| Browser lifecycle capture | A manual or automated browser run through create, approve, offer, fund, rival rejection, and repay | Save screenshots/video and promote P5 from Pending |
| Invoice fixtures | Three real or permissioned invoice layouts, plus the corrections that may be recorded | Put source files under `fixtures/invoices/`, record provenance, then complete P6 |
| DevNet | Participant URL, Ledger API user/token, party IDs, synchronizer ID, and DAR deployment permission | Run the three backend integrations and record update IDs for P7 |
| Grofty | Confirmation that the bounty is in scope and a working signing/connectivity path | Integrate and prove the flow, or document the deliberate exclusion in the submission |
| Interviews | Five consented conversations: two buyer operators, two SME suppliers, one financier | Record dates and anonymized findings in `docs/INTERVIEWS.md` and `docs/VALIDATION.md` |
| Demo video | A recorder and a public/private-window destination | Follow `docs/DEMO.md`, keep it under five minutes, and add checksum/link evidence |
| Public submission link | A domain or hosting destination assigned to Tavryn | Configure a dedicated proxy/server name and verify it in a private browser |

The VPS public IP currently belongs to other Nginx virtual hosts and returns a default 404
for Tavryn; no existing project was overwritten to manufacture a link. The Tavryn backend
remains bound to loopback behind its systemd unit until a dedicated public hostname is
provided.
