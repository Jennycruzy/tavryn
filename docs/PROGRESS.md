# Tavryn progress

Evidence rule: a gate is complete only when the artifact named in the Evidence column
exists and can be reproduced. `Pending` is not a pass.

| Phase | Gate | Status | Evidence | Open dependency |
|---|---|---|---|---|
| P0 | One contract visible on LocalNet; Mana day 1 logged | Pending | No LocalNet or Mana evidence yet | DPM install, LocalNet starter, user Mana confirmation |
| P1 | A funds; B fails; B cannot see A; duplicate approval refused | Passed | `dpm test` on SDK 3.5.12: `testCoreLifecycle: ok, 6 active contracts, 11 transactions` (2026-09-29) | Backend service test still required in P2 |
| P2 | Backend drives P1 with party-scoped reads | Pending | Test output and update IDs | Participant endpoints and party IDs |
| P3 | Real Canton Coin funding and repayment | Pending | Spike output, update IDs, path decision | Token-standard source, token admin, CC buffer |
| P4 | Governance threshold fails below and succeeds at threshold | Pending | Clean-environment run and update IDs | Decentralization Manager example, machine capacity |
| P5 | Full lifecycle plus rejection from UI | Pending | Screenshot/video path | P2 backend and P3 settlement |
| P6 | Three real-looking invoice layouts extracted and corrected | Pending | Fixture paths and correction records | User-provided or legally usable invoice fixtures |
| P7 | Full lifecycle on DevNet | Pending | DevNet update IDs | Hackathon DevNet access details |
| P8 | Grofty flow, only if DAR/MainNet question resolves | Pending | MainNet evidence or documented exclusion | Grofty access and approved DAR path |
| P9 | Brief, pilot, validation, pitch materials | Pending | Document paths and genuine interviews | Five interview conversations |
| P10 | Reproducible sub-five-minute demo | Pending | Video path and checksum | DevNet lifecycle |
| P11 | Private-window link check and submission | Pending | Checklist and screenshots | Public repo, project profile, Mana requirement |

## Day 1 log

- Date: 2026-09-29 (Africa/Lagos; deadline facts remain UTC).
- Project name: Tavryn, selected and applied across the repository.
- DPM installer: official installer selected SDK 3.5.12; download/install in progress.
- Mana activity: **user confirmation required; not claimed**.
- Git identity: local global identity currently reports `jennycruzy` and
  `jennycruzy@users.noreply.github.com`; confirm the intended commit email before the
  first Tavryn commit.
- GitHub repository URL: `https://github.com/Jennycruzy/tavryn.git` (provided 2026-09-29;
  configured as the local `origin`; remote access not yet verified).
- Grofty DAR question: user must confirm whether access was requested and whether a Grofty
  user can sign a Tavryn DAR on MainNet after participant package vetting.
- Interviews: not conducted; no numbers or quotes invented.
