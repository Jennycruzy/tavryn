// Generated from ../../Tavryn/Contracts/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@tavryn.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as Tavryn_Rules from '../../Tavryn/Rules/module';
import * as Tavryn_Types from '../../Tavryn/Types/module';

export declare type Accept = {
  approvedInvoiceCid: damlTypes.ContractId<ApprovedInvoice>,
  rulesCid: damlTypes.ContractId<Tavryn_Rules.NetworkRules>,
  paymentReference: string,
}

export declare const Accept:
  damlTypes.Serializable<Accept>

export declare type Approve = {
  rulesCid: damlTypes.ContractId<Tavryn_Rules.NetworkRules>,
  registryCid: damlTypes.ContractId<Tavryn_Rules.BuyerApprovalRegistry>,
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
  fundingSlot: damlTypes.ContractId<FundingSlot>,
  eligibleFinanciers: damlTypes.Party[],
  auditor: damlTypes.Party,
  networkId: string,
  operators: damlTypes.Party[],
}

export declare interface ApprovedInvoiceInterface {
  Archive: 
    damlTypes.Choice<ApprovedInvoice, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ApprovedInvoice, undefined>>;
  CreateOffer: 
    damlTypes.Choice<ApprovedInvoice, CreateOffer, damlTypes.ContractId<FinancingOffer>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<ApprovedInvoice, undefined>>;
}
export declare const ApprovedInvoice:
  damlTypes.Template<ApprovedInvoice, undefined, '#tavryn-network:Tavryn.Contracts:ApprovedInvoice'> &
  damlTypes.ToInterface<ApprovedInvoice, never> &
  ApprovedInvoiceInterface

export declare type BeginFunding = {
  approvedInvoiceCid: damlTypes.ContractId<ApprovedInvoice>,
  rulesCid: damlTypes.ContractId<Tavryn_Rules.NetworkRules>,
  trackingId: string,
  settlementAmount: damlTypes.Numeric,
  instrument: string,
}

export declare const BeginFunding:
  damlTypes.Serializable<BeginFunding>

export declare type BeginRepayment = {
  repaymentDate: damlTypes.Date,
  trackingId: string,
  settlementAmount: damlTypes.Numeric,
  instrument: string,
}

export declare const BeginRepayment:
  damlTypes.Serializable<BeginRepayment>

export declare type Cancel = {
}

export declare const Cancel:
  damlTypes.Serializable<Cancel>

export declare type CancelRepayment = {
}

export declare const CancelRepayment:
  damlTypes.Serializable<CancelRepayment>

export declare type Claim = {
  claimant: damlTypes.Party,
}

export declare const Claim:
  damlTypes.Serializable<Claim>

export declare type Complete = {
  paymentReference: string,
}

export declare const Complete:
  damlTypes.Serializable<Complete>

export declare type CompleteRepayment = {
  paymentReference: string,
}

export declare const CompleteRepayment:
  damlTypes.Serializable<CompleteRepayment>

export declare type CreateOffer = {
  rulesCid: damlTypes.ContractId<Tavryn_Rules.NetworkRules>,
  financier: damlTypes.Party,
  advance: damlTypes.Numeric,
  advanceRate: damlTypes.Numeric,
}

export declare const CreateOffer:
  damlTypes.Serializable<CreateOffer>

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
  BeginRepayment: 
    damlTypes.Choice<FinancedInvoice, BeginRepayment, damlTypes.ContractId<PendingRepayment>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FinancedInvoice, undefined>>;
  Repay: 
    damlTypes.Choice<FinancedInvoice, Repay, damlTypes.ContractId<RepaymentReceipt>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FinancedInvoice, undefined>>;
}
export declare const FinancedInvoice:
  damlTypes.Template<FinancedInvoice, undefined, '#tavryn-network:Tavryn.Contracts:FinancedInvoice'> &
  damlTypes.ToInterface<FinancedInvoice, never> &
  FinancedInvoiceInterface

export declare type FinancingOffer = {
  supplier: damlTypes.Party,
  buyer: damlTypes.Party,
  financier: damlTypes.Party,
  invoiceCommitment: string,
  terms: Tavryn_Types.InvoiceTerms,
  networkId: string,
  operators: damlTypes.Party[],
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
  BeginFunding: 
    damlTypes.Choice<FinancingOffer, BeginFunding, damlTypes.ContractId<PendingFunding>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FinancingOffer, undefined>>;
  Withdraw: 
    damlTypes.Choice<FinancingOffer, Withdraw, damlTypes.ContractId<OfferClosed>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FinancingOffer, undefined>>;
}
export declare const FinancingOffer:
  damlTypes.Template<FinancingOffer, undefined, '#tavryn-network:Tavryn.Contracts:FinancingOffer'> &
  damlTypes.ToInterface<FinancingOffer, never> &
  FinancingOfferInterface

export declare type FundingReceipt = {
  buyer: damlTypes.Party,
  supplier: damlTypes.Party,
  financier: damlTypes.Party,
  auditor: damlTypes.Party,
  financedInvoice: damlTypes.ContractId<FinancedInvoice>,
  invoiceCommitment: string,
  settlementAmount: damlTypes.Numeric,
  instrument: string,
  trackingId: string,
  paymentReference: string,
}

export declare interface FundingReceiptInterface {
  Archive: 
    damlTypes.Choice<FundingReceipt, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<FundingReceipt, undefined>>;
}
export declare const FundingReceipt:
  damlTypes.Template<FundingReceipt, undefined, '#tavryn-network:Tavryn.Contracts:FundingReceipt'> &
  damlTypes.ToInterface<FundingReceipt, never> &
  FundingReceiptInterface

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
  damlTypes.Template<FundingSlot, undefined, '#tavryn-network:Tavryn.Contracts:FundingSlot'> &
  damlTypes.ToInterface<FundingSlot, never> &
  FundingSlotInterface

export declare type InvoiceDetails = {
  buyer: damlTypes.Party,
  supplier: damlTypes.Party,
  auditor: damlTypes.Party,
  invoiceCommitment: string,
  terms: Tavryn_Types.InvoiceTerms,
  salt: string,
}

export declare interface InvoiceDetailsInterface {
  Archive: 
    damlTypes.Choice<InvoiceDetails, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<InvoiceDetails, undefined>>;
}
export declare const InvoiceDetails:
  damlTypes.Template<InvoiceDetails, undefined, '#tavryn-network:Tavryn.Contracts:InvoiceDetails'> &
  damlTypes.ToInterface<InvoiceDetails, never> &
  InvoiceDetailsInterface

export declare type InvoiceDraft = {
  supplier: damlTypes.Party,
  buyer: damlTypes.Party,
  terms: Tavryn_Types.InvoiceTerms,
  salt: string,
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
  damlTypes.Template<InvoiceDraft, undefined, '#tavryn-network:Tavryn.Contracts:InvoiceDraft'> &
  damlTypes.ToInterface<InvoiceDraft, never> &
  InvoiceDraftInterface

export declare type OfferClosed = {
  buyer: damlTypes.Party,
  supplier: damlTypes.Party,
  financier: damlTypes.Party,
  invoiceCommitment: string,
}

export declare interface OfferClosedInterface {
  Archive: 
    damlTypes.Choice<OfferClosed, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<OfferClosed, undefined>>;
}
export declare const OfferClosed:
  damlTypes.Template<OfferClosed, undefined, '#tavryn-network:Tavryn.Contracts:OfferClosed'> &
  damlTypes.ToInterface<OfferClosed, never> &
  OfferClosedInterface

export declare type PendingFunding = {
  buyer: damlTypes.Party,
  supplier: damlTypes.Party,
  financier: damlTypes.Party,
  auditor: damlTypes.Party,
  invoiceCommitment: string,
  invoiceDetails: damlTypes.ContractId<InvoiceDetails>,
  eligibleFinanciers: damlTypes.Party[],
  networkId: string,
  operators: damlTypes.Party[],
  terms: Tavryn_Types.InvoiceTerms,
  advance: damlTypes.Numeric,
  advanceRate: damlTypes.Numeric,
  trackingId: string,
  settlementAmount: damlTypes.Numeric,
  instrument: string,
  lockedAt: damlTypes.Time,
}

export declare interface PendingFundingInterface {
  Archive: 
    damlTypes.Choice<PendingFunding, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<PendingFunding, undefined>>;
  Cancel: 
    damlTypes.Choice<PendingFunding, Cancel, damlTypes.ContractId<ApprovedInvoice>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<PendingFunding, undefined>>;
  Complete: 
    damlTypes.Choice<PendingFunding, Complete, damlTypes.ContractId<FinancedInvoice>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<PendingFunding, undefined>>;
}
export declare const PendingFunding:
  damlTypes.Template<PendingFunding, undefined, '#tavryn-network:Tavryn.Contracts:PendingFunding'> &
  damlTypes.ToInterface<PendingFunding, never> &
  PendingFundingInterface

export declare type PendingRepayment = {
  buyer: damlTypes.Party,
  supplier: damlTypes.Party,
  financier: damlTypes.Party,
  auditor: damlTypes.Party,
  invoiceCommitment: string,
  terms: Tavryn_Types.InvoiceTerms,
  advance: damlTypes.Numeric,
  advanceRate: damlTypes.Numeric,
  repaymentDate: damlTypes.Date,
  trackingId: string,
  settlementAmount: damlTypes.Numeric,
  instrument: string,
  lockedAt: damlTypes.Time,
}

export declare interface PendingRepaymentInterface {
  Archive: 
    damlTypes.Choice<PendingRepayment, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<PendingRepayment, undefined>>;
  CancelRepayment: 
    damlTypes.Choice<PendingRepayment, CancelRepayment, damlTypes.ContractId<FinancedInvoice>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<PendingRepayment, undefined>>;
  CompleteRepayment: 
    damlTypes.Choice<PendingRepayment, CompleteRepayment, damlTypes.ContractId<RepaymentReceipt>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<PendingRepayment, undefined>>;
}
export declare const PendingRepayment:
  damlTypes.Template<PendingRepayment, undefined, '#tavryn-network:Tavryn.Contracts:PendingRepayment'> &
  damlTypes.ToInterface<PendingRepayment, never> &
  PendingRepaymentInterface

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
  early: boolean,
  amount: damlTypes.Numeric,
  instrument: string,
  trackingId: string,
  paymentReference: string,
}

export declare interface RepaymentReceiptInterface {
  Archive: 
    damlTypes.Choice<RepaymentReceipt, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<RepaymentReceipt, undefined>>;
}
export declare const RepaymentReceipt:
  damlTypes.Template<RepaymentReceipt, undefined, '#tavryn-network:Tavryn.Contracts:RepaymentReceipt'> &
  damlTypes.ToInterface<RepaymentReceipt, never> &
  RepaymentReceiptInterface

export declare type Withdraw = {
}

export declare const Withdraw:
  damlTypes.Serializable<Withdraw>
