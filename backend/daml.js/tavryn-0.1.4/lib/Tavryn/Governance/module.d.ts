// Generated from ../../Tavryn/Governance/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 from '@tavryn.js/daml-prim-DA-Types-1.0.0';
import * as pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 from '@tavryn.js/ghc-stdlib-DA-Internal-Template-1.0.0';

import * as Tavryn_Rules from '../../Tavryn/Rules/module';
import * as Tavryn_Types from '../../Tavryn/Types/module';

export declare type CommitteeBootstrap = {
  networkId: string,
  operators: damlTypes.Party[],
  threshold: damlTypes.Int,
  accepted: damlTypes.Party[],
  financiers: damlTypes.Party[],
  participants: damlTypes.Party[],
  maxAdvanceRate: damlTypes.Numeric,
}

export declare interface CommitteeBootstrapInterface {
  Archive: 
    damlTypes.Choice<CommitteeBootstrap, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CommitteeBootstrap, undefined>>;
  Finalize: 
    damlTypes.Choice<CommitteeBootstrap, Finalize, pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2<damlTypes.ContractId<GovernanceCommittee>, damlTypes.ContractId<Tavryn_Rules.NetworkRules>>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CommitteeBootstrap, undefined>>;
  Join: 
    damlTypes.Choice<CommitteeBootstrap, Join, damlTypes.ContractId<CommitteeBootstrap>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<CommitteeBootstrap, undefined>>;
}
export declare const CommitteeBootstrap:
  damlTypes.Template<CommitteeBootstrap, undefined, '#tavryn:Tavryn.Governance:CommitteeBootstrap'> &
  damlTypes.ToInterface<CommitteeBootstrap, never> &
  CommitteeBootstrapInterface

export declare type Execute = {
  executor: damlTypes.Party,
  proposalCid: damlTypes.ContractId<GovernanceProposal>,
  voteCids: damlTypes.ContractId<GovernanceVote>[],
  rulesCid: damlTypes.ContractId<Tavryn_Rules.NetworkRules>,
}

export declare const Execute:
  damlTypes.Serializable<Execute>

export declare type Finalize = {
  operator: damlTypes.Party,
}

export declare const Finalize:
  damlTypes.Serializable<Finalize>

export declare type GovernanceCommittee = {
  networkId: string,
  operators: damlTypes.Party[],
  threshold: damlTypes.Int,
}

export declare interface GovernanceCommitteeInterface {
  Archive: 
    damlTypes.Choice<GovernanceCommittee, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GovernanceCommittee, undefined>>;
  Execute: 
    damlTypes.Choice<GovernanceCommittee, Execute, damlTypes.ContractId<Tavryn_Rules.NetworkRules>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GovernanceCommittee, undefined>>;
  Propose: 
    damlTypes.Choice<GovernanceCommittee, Propose, damlTypes.ContractId<GovernanceProposal>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GovernanceCommittee, undefined>>;
}
export declare const GovernanceCommittee:
  damlTypes.Template<GovernanceCommittee, undefined, '#tavryn:Tavryn.Governance:GovernanceCommittee'> &
  damlTypes.ToInterface<GovernanceCommittee, never> &
  GovernanceCommitteeInterface

export declare type GovernanceProposal = {
  networkId: string,
  operators: damlTypes.Party[],
  proposer: damlTypes.Party,
  action: Tavryn_Types.GovernanceAction,
  rulesVersion: damlTypes.Int,
  expiresAt: damlTypes.Time,
}

export declare interface GovernanceProposalInterface {
  Archive: 
    damlTypes.Choice<GovernanceProposal, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GovernanceProposal, undefined>>;
  Vote: 
    damlTypes.Choice<GovernanceProposal, Vote, damlTypes.ContractId<GovernanceVote>, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GovernanceProposal, undefined>>;
}
export declare const GovernanceProposal:
  damlTypes.Template<GovernanceProposal, undefined, '#tavryn:Tavryn.Governance:GovernanceProposal'> &
  damlTypes.ToInterface<GovernanceProposal, never> &
  GovernanceProposalInterface

export declare type GovernanceVote = {
  networkId: string,
  operators: damlTypes.Party[],
  proposal: damlTypes.ContractId<GovernanceProposal>,
  rulesVersion: damlTypes.Int,
  operator: damlTypes.Party,
}

export declare interface GovernanceVoteInterface {
  Archive: 
    damlTypes.Choice<GovernanceVote, pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive, {}, undefined> &
    damlTypes.ChoiceFrom<damlTypes.Template<GovernanceVote, undefined>>;
}
export declare const GovernanceVote:
  damlTypes.Template<GovernanceVote, undefined, '#tavryn:Tavryn.Governance:GovernanceVote'> &
  damlTypes.ToInterface<GovernanceVote, never> &
  GovernanceVoteInterface

export declare type Join = {
  operator: damlTypes.Party,
}

export declare const Join:
  damlTypes.Serializable<Join>

export declare type Propose = {
  proposer: damlTypes.Party,
  action: Tavryn_Types.GovernanceAction,
  rulesCid: damlTypes.ContractId<Tavryn_Rules.NetworkRules>,
  expiresAt: damlTypes.Time,
}

export declare const Propose:
  damlTypes.Serializable<Propose>

export declare type Vote = {
  operator: damlTypes.Party,
}

export declare const Vote:
  damlTypes.Serializable<Vote>
