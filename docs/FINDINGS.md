# Verified findings

This file records source-backed facts and anything where the build specification is more
specific than the currently verified implementation. URLs are kept so a reviewer can
check the source; the installed version and local command output must be added alongside
each fact before it is treated as a local capability.

## Canton/Daml

| Finding | Source | Local status |
|---|---|---|
| Contract keys are not supported in the documented Canton 3.x release; non-unique keys are future work and unique keys are not planned. | [Digital Asset Canton 3.5 contract-key reference](https://archived.docs.digitalasset.com/build/3.5/reference/daml/contract-keys.html) | Design constraint adopted; local compiler check pending |
| Canton privacy is participant/party scoped rather than a shared cleartext database. | [Canton repository overview](https://github.com/digital-asset/canton) | Local privacy test pending |
| A choice controller must be a signatory or observer of the contract it exercises. A non-stakeholder cannot directly exercise a hidden approved-invoice choice. | [Daml template/choice structure](https://docs.digitalasset.com/build/3.5/reference/daml/structure.html), [Canton privacy model](https://docs.digitalasset.com/overview/3.5/explanations/ledger-model/ledger-privacy.html) | Architecture changed to avoid direct hidden-contract exercise |
| Explicitly disclosing a hidden contract supplies its full created-event payload to the submitter; it is therefore not an acceptable way to preserve invoice-price privacy. | [Explicit contract disclosure](https://docs.digitalasset.com/build/3.4/sdlc-howtos/applications/develop/explicit-contract-disclosure.html), [delegation pattern](https://docs.digitalasset.com/build/3.5/sdlc-howtos/smart-contracts/develop/patterns/delegation.html) | Architecture changed to use an opaque one-use funding slot |
| DPM is the current builder path described by the Canton Developer Hub: scaffold, build, test, then deploy to a LocalNet. | [Canton Developer Hub](https://github.com/canton-network-devs/Canton-Developer-Hub) | Official SDK 3.5.12 installed; `dpm build` and `dpm test` pass |
| The Canton 3.5 JSON Ledger API exposes JSON command submission and active-contract queries; the local OpenAPI served by Canton 3.5.19 exposes `POST /v2/commands/submit-and-wait-for-transaction`, `POST /v2/state/active-contracts`, and `GET /v2/state/ledger-end`. | [Canton Ledger API overview](https://docs.digitalasset.com/build/3.5/explanations/ledger-api.html), [Canton JSON Ledger API OpenAPI](https://docs.digitalasset.com/build/3.5/reference/json-api/openapi.html) | Verified against local OpenAPI 3.5.19; backend uses these exact routes |
| The official DPM codegen component installed here is 3.5.3, and the published npm registry provides `@daml/types` 3.5.3 but not 3.5.12. The generated binding package metadata says 3.5.12, so the backend pins the published 3.5.3 runtime and records the discrepancy rather than requesting an unavailable package. | [DPM codegen-js command](https://docs.digitalasset.com/build/3.4/component-howtos/application-development/daml-codegen-javascript.html), [Daml JavaScript bindings tutorial](https://docs.digitalasset.com/build/3.5/tutorials/json-api/canton_and_the_json_ledger_api_ts_websocket.html) | Verified with DPM `codegen-js 3.5.3`, npm registry lookup, and successful TypeScript build |
| The local sandbox requires a Ledger API user ID for command submission; `GET /v2/users` returned the participant-provided `participant_admin` user. The value is kept only in the ignored local environment. | [Canton JSON Ledger API OpenAPI](https://docs.digitalasset.com/build/3.5/reference/json-api/openapi.html) | Used by the LocalNet integration; no user ID is committed |
| The DPM sandbox participant currently running Tavryn exposes 33 package IDs, but a read-only scan of the package binaries found no Splice, Amulet, Canton Coin, token-standard, or allocation package. A Tavryn-only sandbox cannot prove real Canton Coin settlement. | [Canton Network Token Standard / CIP-0056](https://github.com/canton-foundation/cips/blob/main/cip-0056/cip-0056.md), [Splice token-standard source](https://github.com/canton-network/splice/tree/main/token-standard) | P3 requires a real Splice-backed DevNet/LocalNet participant; no fake token path will be added |
| A full CN Quickstart LocalNet has materially higher operational requirements than a DPM sandbox; the official quickstart documents 8 GB minimum total Docker memory. | [Canton Network quickstart](https://github.com/digital-asset/cn-quickstart) | Local Canton, Splice and Postgres containers are running; moving persistent deployment to a VPS remains an operational option, not a correctness dependency |

## Canton Coin / settlement

| Finding | Source | Local status |
|---|---|---|
| Canton Coin token-standard transfers use `POST /v0/wallet/token-standard/transfers` with `receiver_party_id`, `amount`, `description`, `expires_at` in microseconds, and `tracking_id`; completed output contains `receiver_holding_cids`, while pending output contains a transfer-instruction CID. | [Splice wallet API source](https://raw.githubusercontent.com/canton-network/splice/refs/heads/main/apps/wallet/src/main/openapi/wallet-internal.yaml) | Verified against the installed Splice 0.6.11 validator; Tavryn now calls this endpoint from `backend/src/canton-coin.ts` |
| Canton Coin transfers require receiver preapproval when the receiver is to accept incoming funds automatically. | [Splice wallet API source](https://raw.githubusercontent.com/canton-network/splice/refs/heads/main/apps/wallet/src/main/openapi/wallet-internal.yaml) | Preapprovals were created for the local supplier, buyer, and Financier A wallets; the backend assumes this is configured and does not fake acceptance |
| Wallet transaction history is `POST /v0/wallet/transactions` with `page_size`; completed transfer items expose `event_id`, `sender`, `receivers`, and `description`. | [Splice wallet API source](https://raw.githubusercontent.com/canton-network/splice/refs/heads/main/apps/wallet/src/main/openapi/wallet-internal.yaml) | The backend correlates the transfer description to the real event ID and stores the derived update ID on the ledger receipt |
| The installed Splice-backed local network is version 0.6.11. Its local amulet-rules response reports wallet 0.1.22, amulet 0.1.21, token allocation/transfer v2 DARs, and zero transfer fee in this local configuration. | Installed validator package list and `/api/validator/v0/scan-proxy/amulet-rules` response (2026-10-01) | Local evidence only; fees and package IDs remain environment values, not repository constants |
| A real role-mapped Tavryn settlement completed on the local Splice network: Financier A → supplier for funding and buyer → Financier A for repayment, with each cash reference recorded by the ledger workflow. | `docs/evidence/P3_SETTLEMENT_2026-10-01.json`: funding cash event `#12208f304c109bc8b1c4dbc6c46e0c65e483c349c0f87e82868818277f7203bca8ea:0`; repayment cash event `#1220e2c317ea32580cbb7f03dda103d692d96d46315dd5efcbcc6b55db73a4c1adfa:0` | P3 passed through Tavryn's `PendingFunding.Complete` and repayment flow; settlement is real and explicitly non-atomic |
| A V2 allocation request was accepted by the local validator with a 0.10 Amulet transfer leg and then expired without a captured settlement choice. | Local validator `POST /api/validator/v2/allocations` response and subsequent empty allocation list, 2026-10-01 | Atomic path not claimed; the MVP uses the real two-step alternative |

## Decentralization Manager

| Finding | Source | Local status |
|---|---|---|
| The public Decentralization Manager repository is `DLC-link/decentralization-manager`; its README describes a coordinator/peer application and a three-participant development compose setup. | [DLC-link/decentralization-manager](https://github.com/DLC-link/decentralization-manager) | Repository/example not cloned or run yet |
| Its custom Daml integration documents distributing a DAR to every participant and disclosing contracts when the governed choice requires them. | [Custom Daml templates guide](https://github.com/DLC-link/decentralization-manager/blob/main/docs/CUSTOM_DAML_TEMPLATES.md) | Applicable only after the example run and exact API are verified |

## Explicit discrepancies / unknowns

1. The supplied build specification calls for HackCanton S3 starter materials, but no
   starter bundle was present in the workspace and no S3-specific repository URL has been
   supplied. The build must not guess that material; it currently uses the official DPM
   path only as a provisional toolchain until the hackathon source is provided or found.
2. The specification states an exact Grofty SDK behavior, but no Grofty SDK or access
   response is present locally. It remains an optional last phase and cannot shape the
   core model.
3. The specification names CIP-0056 and Canton Coin allocation behavior. The installed
   Splice 0.6.11 token-standard transfer API is now verified, but the full atomic
   allocation settlement choice was not completed. Tavryn therefore claims the real
   two-step path only and does not call it atomic.
4. The specification's direct `FinancingOffer.Accept -> ApprovedInvoice` shape conflicts
   with the current Daml visibility rule if the financier is not an `ApprovedInvoice`
   stakeholder. Making the invoice disclosed would reveal its full payload. Tavryn
   therefore uses a privacy-preserving split: private `InvoiceDetails` holds the full
   terms; a terms-free `ApprovedInvoice` seal and `FundingSlot` are visible to eligible
   financiers; each offer carries only its own proposed terms; and the winning
   buyer/supplier/financier choice consumes the one-use slot and the approval seal before
   creating `FinancedInvoice`. There is no `FundingAuthorization` template in the current
   model. This is a material source-over-spec deviation and is called out in the
   README/demo.
5. A project-local Temurin Java 17 runtime was selected explicitly to run `dpm build` and
   `dpm codegen-js`. The service now imports generated Tavryn 0.1.1 bindings; its narrow
   settlement-choice adapter remains explicit and matches those generated template and
   choice names. A same-day `dpm test` rerun reached the Script service but timed out while
   creating its script context; the participant-backed P3 integration passed independently
   and is the P3 evidence.
6. The local participant retained an older Tavryn DAR after the settlement DAR was
   deployed. Unqualified `#tavryn:...` commands continued to resolve to the older
   package, so the backend now qualifies command template IDs with the configured
   `CANTON_PACKAGE_ID`. The package ID is intentionally an environment value and must
   be read from the deployed DAR/participant for each environment.
7. Canton rejected the changed DAR when it reused `tavryn` version `0.1.0`, reporting
   `KNOWN_PACKAGE_VERSION` because a different package ID with that name/version was
   already vetted. The project version was incremented to `0.1.1`; package
   `ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05` was then
   uploaded with `vetAllPackages=true` and verified in the package-vetting topology state.
