# Governance integration boundary

Tavryn's governed membership path is implemented in
[`daml/Tavryn/Governance.daml`](../daml/Tavryn/Governance.daml) and exposed through the
backend routes under `/api/v1/governance`. A committee with threshold `2` rejects an
execution with one vote and admits a candidate after the second vote; the proof is in
[`docs/evidence/P4_GOVERNANCE_2026-10-03.json`](../docs/evidence/P4_GOVERNANCE_2026-10-03.json).

The Decentralization Manager example is not claimed as a completed external integration.
The workspace does not contain its exact pinned example or DevNet credentials, so this
directory records the safe integration boundary rather than guessing its API:

1. Distribute the vetted Tavryn DAR to every participating Canton participant.
2. Configure the governance party and operator parties in each participant's Ledger API
   user rights.
3. Point the Decentralization Manager's governed choice at the Tavryn committee and
   preserve the below-threshold rejection plus at-threshold update IDs as evidence.

The equivalent committee contract remains useful on LocalNet and on the selected VPS
until the external manager example and DevNet access are supplied.
