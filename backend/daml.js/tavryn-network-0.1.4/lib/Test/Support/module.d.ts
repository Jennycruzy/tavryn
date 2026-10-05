// Generated from ../../Test/Support/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

import * as Tavryn_Governance from '../../Tavryn/Governance/module';

export declare type Network = {
  parties: Parties,
  committee: damlTypes.ContractId<Tavryn_Governance.GovernanceCommittee>,
}

export declare const Network:
  damlTypes.Serializable<Network>

export declare type Parties = {
  supplier: damlTypes.Party,
  buyer: damlTypes.Party,
  financierA: damlTypes.Party,
  financierB: damlTypes.Party,
  financierC: damlTypes.Party,
  auditor: damlTypes.Party,
  operatorOne: damlTypes.Party,
  operatorTwo: damlTypes.Party,
  operatorThree: damlTypes.Party,
}

export declare const Parties:
  damlTypes.Serializable<Parties>
