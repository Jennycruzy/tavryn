// Generated from ../../Tavryn/Rules/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@tavryn.js/ghc-stdlib-DA-Internal-Template-1.0.0';

export declare type BuyerApprovalRegistry = {
  networkId: string,
  operators: damlTypes.Party[],
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
  damlTypes.Template<BuyerApprovalRegistry, undefined, '#tavryn-network:Tavryn.Rules:BuyerApprovalRegistry'> &
  damlTypes.ToInterface<BuyerApprovalRegistry, never> &
  BuyerApprovalRegistryInterface

export declare type NetworkRules = {
  networkId: string,
  operators: damlTypes.Party[],
  threshold: damlTypes.Int,
  financiers: damlTypes.Party[],
  buyers: damlTypes.Party[],
  participants: damlTypes.Party[],
  maxAdvanceRate: damlTypes.Numeric,
  version: damlTypes.Int,
}

export declare interface NetworkRulesInterface {
  Archive: 
    damlTypes.Choice<NetworkRules, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<NetworkRules, undefined>>;
}
export declare const NetworkRules:
  damlTypes.Template<NetworkRules, undefined, '#tavryn-network:Tavryn.Rules:NetworkRules'> &
  damlTypes.ToInterface<NetworkRules, never> &
  NetworkRulesInterface

export declare type RecordApproval = {
  externalInvoiceNumber: string,
}

export declare const RecordApproval:
  damlTypes.Serializable<RecordApproval>
