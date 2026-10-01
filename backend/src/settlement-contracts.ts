import type { ChoiceBinding, TemplateBinding } from "./ledger-api.js";

// These bindings are intentionally limited to the three declarations added after the
// last generated-binding refresh. Their identifiers and argument shapes come directly
// from daml/Tavryn/Contracts.daml. Once a Java runtime is available on the build host,
// `dpm codegen-js` should regenerate backend/daml.js and this compatibility file can be
// removed.
export const FinancingOfferBeginFunding: ChoiceBinding = {
  choiceName: "BeginFunding",
  argumentEncode: (value: unknown) => value,
};

export const PendingFunding: TemplateBinding = {
  templateId: "#tavryn:Tavryn.Contracts:PendingFunding",
  encode: (value: unknown) => value,
};

export const PendingFundingComplete: ChoiceBinding = {
  choiceName: "Complete",
  argumentEncode: (value: unknown) => value,
};

export const PendingFundingCancel: ChoiceBinding = {
  choiceName: "Cancel",
  argumentEncode: (value: unknown) => value,
};
