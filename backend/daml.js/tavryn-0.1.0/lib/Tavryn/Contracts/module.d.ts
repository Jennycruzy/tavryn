// Generated from ../../Tavryn/Contracts/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@tavryn.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as Tavryn_Types from '../../Tavryn/Types/module';

export declare type Accept = {
}

export declare const Accept:
  damlTypes.Serializable<Accept>

export declare type Approve = {
  networkRules: damlTypes.ContractId<NetworkRules>,
  approvalRegistry: damlTypes.ContractId<BuyerApprovalRegistry>,
  eligibleFinanciers: damlTypes.Party[],
  auditor: damlTypes.Party,
}

export declare const Approve:
  damlTypes.Serializable<Approve>

export declare type ApprovedInvoice = {
  supplier: damlTypes.Party,
  buyer: damlTypes.Party,
  invoiceCommitment: string,
  invoiceDetails: damlTypes.ContractId<InvoiceDetails>,
  networkRules: damlTypes.ContractId<NetworkRules>,
  fundingSlot: damlTypes.ContractId<FundingSlot>,
  eligibleFinanciers: damlTypes.Party[],
  auditor: damlTypes.Party,
}

export declare interface ApprovedInvoiceInterface {
  Archive: 
    damlTypes.Choice<ApprovedInvoice, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ApprovedInvoice, undefined>>;
  CreateOffer: 
    damlTypes.Choice<ApprovedInvoice, CreateOffer, damlTypes.ContractId<FinancingOffer>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ApprovedInvoice, undefined>>;
  FinalizeFunding: 
    damlTypes.Choice<ApprovedInvoice, FinalizeFunding, damlTypes.ContractId<FinancedInvoice>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ApprovedInvoice, undefined>>;
}
export declare const ApprovedInvoice:
  damlTypes.Template<ApprovedInvoice, undefined, '#tavryn:Tavryn.Contracts:ApprovedInvoice'> &
  damlTypes.ToInterface<ApprovedInvoice, never> &
  ApprovedInvoiceInterface

export declare type BuyerApprovalRegistry = {
  buyer: damlTypes.Party,
  approvedInvoiceNumbers: string[],
}

export declare interface BuyerApprovalRegistryInterface {
  Archive: 
    damlTypes.Choice<BuyerApprovalRegistry, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BuyerApprovalRegistry, undefined>>;
  RecordApproval: 
    damlTypes.Choice<BuyerApprovalRegistry, RecordApproval, damlTypes.ContractId<BuyerApprovalRegistry>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<BuyerApprovalRegistry, undefined>>;
}
export declare const BuyerApprovalRegistry:
  damlTypes.Template<BuyerApprovalRegistry, undefined, '#tavryn:Tavryn.Contracts:BuyerApprovalRegistry'> &
  damlTypes.ToInterface<BuyerApprovalRegistry, never> &
  BuyerApprovalRegistryInterface

export declare type Claim = {
  claimant: damlTypes.Party,
}

export declare const Claim:
  damlTypes.Serializable<Claim>

export declare type CreateOffer = {
  approvedInvoice: damlTypes.ContractId<ApprovedInvoice>,
  financier: damlTypes.Party,
  advance: damlTypes.Numeric,
  advanceRate: damlTypes.Numeric,
}

export declare const CreateOffer:
  damlTypes.Serializable<CreateOffer>

export declare type FinalizeFunding = {
  financier: damlTypes.Party,
  advance: damlTypes.Numeric,
  advanceRate: damlTypes.Numeric,
}

export declare const FinalizeFunding:
  damlTypes.Serializable<FinalizeFunding>

export declare type FinancedInvoice = {
  buyer: damlTypes.Party,
  supplier: damlTypes.Party,
  financier: damlTypes.Party,
  auditor: damlTypes.Party,
  invoiceCommitment: string,
  terms: Tavryn_Types.InvoiceTerms,
  advance: damlTypes.Numeric,
  advanceRate: damlTypes.Numeric,
}

export declare interface FinancedInvoiceInterface {
  Archive: 
    damlTypes.Choice<FinancedInvoice, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FinancedInvoice, undefined>>;
  Repay: 
    damlTypes.Choice<FinancedInvoice, Repay, damlTypes.ContractId<RepaymentReceipt>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FinancedInvoice, undefined>>;
}
export declare const FinancedInvoice:
  damlTypes.Template<FinancedInvoice, undefined, '#tavryn:Tavryn.Contracts:FinancedInvoice'> &
  damlTypes.ToInterface<FinancedInvoice, never> &
  FinancedInvoiceInterface

export declare type FinancingOffer = {
  supplier: damlTypes.Party,
  buyer: damlTypes.Party,
  financier: damlTypes.Party,
  approvedInvoice: damlTypes.ContractId<ApprovedInvoice>,
  fundingSlot: damlTypes.ContractId<FundingSlot>,
  invoiceCommitment: string,
  terms: Tavryn_Types.InvoiceTerms,
  networkRules: damlTypes.ContractId<NetworkRules>,
  advance: damlTypes.Numeric,
  advanceRate: damlTypes.Numeric,
}

export declare interface FinancingOfferInterface {
  Accept: 
    damlTypes.Choice<FinancingOffer, Accept, damlTypes.ContractId<FinancedInvoice>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FinancingOffer, undefined>>;
  Archive: 
    damlTypes.Choice<FinancingOffer, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FinancingOffer, undefined>>;
  Withdraw: 
    damlTypes.Choice<FinancingOffer, Withdraw, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FinancingOffer, undefined>>;
}
export declare const FinancingOffer:
  damlTypes.Template<FinancingOffer, undefined, '#tavryn:Tavryn.Contracts:FinancingOffer'> &
  damlTypes.ToInterface<FinancingOffer, never> &
  FinancingOfferInterface

export declare type FundingSlot = {
  supplier: damlTypes.Party,
  buyer: damlTypes.Party,
  invoiceCommitment: string,
  eligibleFinanciers: damlTypes.Party[],
}

export declare interface FundingSlotInterface {
  Archive: 
    damlTypes.Choice<FundingSlot, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FundingSlot, undefined>>;
  Claim: 
    damlTypes.Choice<FundingSlot, Claim, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FundingSlot, undefined>>;
}
export declare const FundingSlot:
  damlTypes.Template<FundingSlot, undefined, '#tavryn:Tavryn.Contracts:FundingSlot'> &
  damlTypes.ToInterface<FundingSlot, never> &
  FundingSlotInterface

export declare type InvoiceDetails = {
  buyer: damlTypes.Party,
  supplier: damlTypes.Party,
  auditor: damlTypes.Party,
  invoiceCommitment: string,
  terms: Tavryn_Types.InvoiceTerms,
}

export declare interface InvoiceDetailsInterface {
  Archive: 
    damlTypes.Choice<InvoiceDetails, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<InvoiceDetails, undefined>>;
}
export declare const InvoiceDetails:
  damlTypes.Template<InvoiceDetails, undefined, '#tavryn:Tavryn.Contracts:InvoiceDetails'> &
  damlTypes.ToInterface<InvoiceDetails, never> &
  InvoiceDetailsInterface

export declare type InvoiceDraft = {
  supplier: damlTypes.Party,
  buyer: damlTypes.Party,
  invoiceCommitment: string,
  terms: Tavryn_Types.InvoiceTerms,
}

export declare interface InvoiceDraftInterface {
  Approve: 
    damlTypes.Choice<InvoiceDraft, Approve, damlTypes.ContractId<ApprovedInvoice>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<InvoiceDraft, undefined>>;
  Archive: 
    damlTypes.Choice<InvoiceDraft, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<InvoiceDraft, undefined>>;
}
export declare const InvoiceDraft:
  damlTypes.Template<InvoiceDraft, undefined, '#tavryn:Tavryn.Contracts:InvoiceDraft'> &
  damlTypes.ToInterface<InvoiceDraft, never> &
  InvoiceDraftInterface

export declare type NetworkRules = {
  governanceParty: damlTypes.Party,
  members: damlTypes.Party[],
  maxAdvanceRate: damlTypes.Numeric,
}

export declare interface NetworkRulesInterface {
  Archive: 
    damlTypes.Choice<NetworkRules, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<NetworkRules, undefined>>;
  SetMaxAdvanceRate: 
    damlTypes.Choice<NetworkRules, SetMaxAdvanceRate, damlTypes.ContractId<NetworkRules>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<NetworkRules, undefined>>;
}
export declare const NetworkRules:
  damlTypes.Template<NetworkRules, undefined, '#tavryn:Tavryn.Contracts:NetworkRules'> &
  damlTypes.ToInterface<NetworkRules, never> &
  NetworkRulesInterface

export declare type RecordApproval = {
  externalInvoiceNumber: string,
}

export declare const RecordApproval:
  damlTypes.Serializable<RecordApproval>

export declare type Repay = {
  repaymentDate: damlTypes.Date,
  paymentReference: string,
}

export declare const Repay:
  damlTypes.Serializable<Repay>

export declare type RepaymentReceipt = {
  buyer: damlTypes.Party,
  financier: damlTypes.Party,
  auditor: damlTypes.Party,
  invoiceCommitment: string,
  repaymentDate: damlTypes.Date,
  paymentReference: string,
}

export declare interface RepaymentReceiptInterface {
  Archive: 
    damlTypes.Choice<RepaymentReceipt, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RepaymentReceipt, undefined>>;
}
export declare const RepaymentReceipt:
  damlTypes.Template<RepaymentReceipt, undefined, '#tavryn:Tavryn.Contracts:RepaymentReceipt'> &
  damlTypes.ToInterface<RepaymentReceipt, never> &
  RepaymentReceiptInterface

export declare type SetMaxAdvanceRate = {
  newRate: damlTypes.Numeric,
}

export declare const SetMaxAdvanceRate:
  damlTypes.Serializable<SetMaxAdvanceRate>

export declare type Withdraw = {
}

export declare const Withdraw:
  damlTypes.Serializable<Withdraw>
