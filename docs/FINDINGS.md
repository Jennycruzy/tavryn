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
| A full CN Quickstart LocalNet has materially higher operational requirements than a DPM sandbox; the official quickstart documents 8 GB minimum total Docker memory. | [Canton Network quickstart](https://github.com/digital-asset/cn-quickstart) | Docker daemon currently unavailable; capacity decision pending |

## Canton Coin / settlement

| Finding | Source | Local status |
|---|---|---|
| Canton Coin workflows require receiver transfer preapproval for one-step transfers in the documented integration workflow. | [Digital Asset integration workflows](https://archived.docs.digitalasset.com/integrate/devnet/exchange-integration/workflows.html) | Must be proven against installed Splice/token-standard version |
| Allocation/disclosed-contract fields must be taken from the installed Splice/token-standard source, not inferred from this specification. | [Splice repository](https://github.com/canton-network/splice) | Not yet pinned or executed |

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
3. The specification names CIP-0056 and Canton Coin allocation behavior. The exact
   versioned token-standard API and package IDs are not yet locally verified; no funding
   choice will claim atomic settlement until that spike succeeds.
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
