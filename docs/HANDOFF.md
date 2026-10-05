# Tavryn handoff — Claude continuation

Last updated: 2026-10-05 (Africa/Lagos)

This file is the operational handoff for the next agent. It is deliberately strict:
technical recovery is not the same as submission completion. Do not promote a pending
item to complete without the artifact named below, and do not invent credentials,
interviews, Mana activity, customer metrics, or video evidence.

## Current truth

The selected VPS LocalNet and the Tavryn backend are operational. The core Daml lifecycle,
role-scoped backend, governance threshold, and two-step Canton Coin settlement have passed
on LocalNet/VPS. The owner-gated DevNet, Grofty, Mana, invoice-fixture, interview, browser
click-through, public-hostname, and demo-video items are not complete.

The planned full Daml 0.1.4 redesign is also not complete. The deployed DAR remains 0.1.3.
Do not describe the repository as fully finished until the 0.1.4 work in `docs/FIX_SPEC.md`
has been implemented, tested, deployed, and evidenced—or the submission scope is formally
changed and documented.

## Repository and deployment

- Repository: `https://github.com/Jennycruzy/tavryn.git`
- Branch: `main`
- The handoff commit is the current `HEAD`; verify it with `git rev-parse --short HEAD`.
- Selected VPS: `38.49.216.59`, deployment directory `/root/tavryn`.
- The VPS GitHub identity cannot fetch the private repository. Source synchronization is
  bridged through the authenticated local checkout. Never copy `.env`, wallet tokens,
  private keys, or `.env.devnet` into Git or chat.
- The VPS runtime keeps ignored files such as `backend/.env`, `backend/.env.devnet`,
  `backend/node_modules`, `backend/dist`, and `.daml/dist` outside the tracked source.

## Verified gates

| Gate | State | Evidence or next action |
|---|---|---|
| P0 Mana | Pending | Owner must confirm completion date and artifact, or leave unclaimed. |
| P1 Daml lifecycle | Passed | `dpm test`: `testCoreLifecycle` passed with 6 active contracts and 11 transactions. |
| P2 backend/privacy | Passed | LocalNet integration proves funding, rival rejection, party-scoped privacy, and duplicate-approval rejection. |
| P3 settlement | Passed | `docs/evidence/P3_SETTLEMENT_2026-10-05-VPS.json`; live AMT funding and repayment, rival `409 INVOICE_UNAVAILABLE`, zero active `PendingFunding`. |
| P4 governance | Passed | `docs/evidence/P4_GOVERNANCE_2026-10-03.json`; below-threshold rejection and threshold admission. |
| P5 browser lifecycle | Pending | UI smoke/browser routes passed, but the complete create/approve/offer/fund/reject/repay click-through still needs capture. |
| P6 invoice fixtures | Pending | Needs three owner-approved or explicitly synthetic fixtures with provenance notes. |
| P7 DevNet | Pending | Needs complete DevNet credentials, party IDs, synchronizer/package details, deployment permission, and update-ID evidence. |
| P8 Grofty | Pending/conditional | Either prove the Grofty DevNet flow, or document the deliberate bounty exclusion. |
| P9 validation | Pending | Needs two buyer-operator, two SME-supplier, and one financier interviews with dates and anonymized notes. |
| P10 demo | Pending | Owner must record the timed flow and provide a link or file plus checksum. |
| P11 public submission | Pending | Needs a hostname, private-window link check, project page, and Mana decision. |

## VPS state verified on 2026-10-05

- `tavryn-backend.service`: active.
- LocalNet containers: `postgres`, `canton`, `splice`, and `nginx` running; final check
  showed Canton, Splice, and Postgres healthy and nginx running.
- LocalNet nginx is attached to the `localnet` Docker network.
- Requested API ports `2975`, `3901`, `3902`, `3903`, and `3975` bind only to
  `127.0.0.1`. LocalNet UI ports `2000`, `3000`, and `4000` are also loopback-only.
- Host UFW exposes only SSH/HTTP/HTTPS (`22`, `80`, `443`).
- The generated Builder compose file was backed up at:
  `/root/.canton-builder/modules/localnet/compose.yaml.pre-tavryn-loopback.20261005183450`.
  If a Builder upgrade regenerates the compose file, reapply and verify the loopback bind
  before restarting LocalNet.
- The VPS backend runtime `.env` and wallet tokens are present only on the VPS and must not
  be printed or committed.

## Changes already landed

- `650e160`: closed financing offers map to `INVOICE_UNAVAILABLE` without a fabricated
  submission reference.
- `2b28f41`: live Canton assertion failures map to business conflicts while auth/network
  failures remain server errors.
- `c45d4c2`: settlement uses configured `CANTON_COIN_SYMBOL`.
- `ef454a6`: signed negative wallet debits are matched correctly.
- `9513bdd`: VPS settlement evidence and truthful progress/submission updates.
- `5cc06cb`: LocalNet nginx/network and loopback-bind repair documentation.

## Owner inputs still required

### DevNet

On the last audit, `/root/tavryn/backend/.env.devnet` existed with mode `600`, but it was
not a complete Tavryn runtime configuration. It contained endpoint/OIDC assignments but was
missing the complete party, synchronizer, package/deployment, and runtime authorization
information needed by the backend.

The owner must write the complete file securely on the VPS. Do not send passwords, refresh
tokens, wallet tokens, or OIDC secrets in chat. After it exists, validate only key names,
permissions, connectivity, and redacted status; then run the DevNet build/deploy/integration
evidence flow.

### Grofty

The owner must explicitly choose one:

- `Grofty DevNet: yes` — confirm the extension operates on HackCanton DevNet and has DevNet
  funds, then prove one funding and one repayment flow.
- `Grofty DevNet: no` — document the bounty exclusion in the submission; do not claim Grofty.

### Mana

The owner must provide the completion date and artifact/screenshot location, or explicitly
leave P0 unclaimed.

### Public hostname

No Tavryn hostname has been provided. Do not alter other projects' nginx virtual hosts.
Once a domain is supplied and its DNS points to `38.49.216.59`, apply the prepared Tavryn
server block/TLS instructions and verify from a private browser window.

### Invoice fixtures

The owner must either provide three cleared invoice files with provenance notes or explicitly
approve synthetic fixtures. Synthetic files must be clearly labelled synthetic and contain
no real customer data.

### Interviews

The owner must provide real dates and anonymized notes for two buyer operators, two SME
suppliers, and one financier. Never create quotes or metrics to fill the tables.

### Demo

The owner must record the timed flow in `docs/DEMO.md` and provide the final video link or
file. The next agent can check the timing, checksum, and evidence placement but cannot claim
an owner-run recording that does not exist.

## Safe continuation order

1. Verify `git status`, `git rev-parse --short HEAD`, and the VPS deployment source.
2. Preserve VPS ignored runtime files while synchronizing tracked source from `main`.
3. Finish the 0.1.4 Daml redesign and generated bindings from `docs/FIX_SPEC.md`, or obtain
   an explicit scope decision before changing the submission claim.
4. Build/test/deploy on LocalNet, restart only `tavryn-backend.service`, and run the
   integration evidence checks. Never restart host nginx or unrelated services.
5. Use the owner’s DevNet file only after it is complete; never print its values.
6. Resolve Grofty, Mana, fixture, hostname, interview, and demo decisions with artifacts.
7. Update `docs/PROGRESS.md`, `docs/REMAINING.md`, `docs/SUBMISSION.md`, and this handoff
   as evidence lands. Keep pending gates visibly pending.

Useful non-secret checks on the VPS:

```sh
cd /root/tavryn
git status --short
git rev-parse --short HEAD
systemctl is-active tavryn-backend
curl -fsS http://127.0.0.1:18787/health
ss -lnt | grep -E ':(2975|3901|3902|3903|3975)\b'
```

Do not run `git reset --hard` against the VPS until the ignored runtime files have been
confirmed safe and a source backup exists.
