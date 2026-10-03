import type { ChoiceBinding, TemplateBinding } from "./ledger-api.js";

// Compatibility bindings for the shared-control templates added after the original
// generated binding refresh. The identifiers and argument shapes are sourced directly
// from daml/Tavryn/Governance.daml.
export const GovernanceCommittee: TemplateBinding = {
  templateId: "#tavryn:Tavryn.Governance:GovernanceCommittee",
  encode: (value: unknown) => value,
};

export const GovernanceCommitteeProposeFinancierAdmission: ChoiceBinding = {
  choiceName: "ProposeFinancierAdmission",
  argumentEncode: (value: unknown) => value,
};

export const FinancierAdmissionProposal: TemplateBinding = {
  templateId: "#tavryn:Tavryn.Governance:FinancierAdmissionProposal",
  encode: (value: unknown) => value,
};

export const FinancierAdmissionProposalConfirm: ChoiceBinding = {
  choiceName: "Confirm",
  argumentEncode: (value: unknown) => value,
};

export const FinancierAdmissionProposalExecute: ChoiceBinding = {
  choiceName: "Execute",
  argumentEncode: (value: unknown) => value,
};

export const NetworkRulesAddFinancier: ChoiceBinding = {
  choiceName: "AddFinancier",
  argumentEncode: (value: unknown) => value,
};
