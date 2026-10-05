"use strict";
/* eslint-disable-next-line no-unused-vars */
function __export(m) {
/* eslint-disable-next-line no-prototype-builtins */
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });

/* eslint-disable-next-line no-unused-vars */
var jtv = require('@mojotech/json-type-validation');
/* eslint-disable-next-line no-unused-vars */
var damlTypes = require('@daml/types');

var Tavryn_Governance = require('../../Tavryn/Governance/module');

exports.Network = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      parties: exports.Parties.decoder,
      committee: damlTypes.ContractId(Tavryn_Governance.GovernanceCommittee).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      parties: exports.Parties.encode(__typed__.parties),
      committee: damlTypes.ContractId(Tavryn_Governance.GovernanceCommittee).encode(__typed__.committee),
    };
  },
};

exports.Parties = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      supplier: damlTypes.Party.decoder,
      buyer: damlTypes.Party.decoder,
      financierA: damlTypes.Party.decoder,
      financierB: damlTypes.Party.decoder,
      financierC: damlTypes.Party.decoder,
      auditor: damlTypes.Party.decoder,
      operatorOne: damlTypes.Party.decoder,
      operatorTwo: damlTypes.Party.decoder,
      operatorThree: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      supplier: damlTypes.Party.encode(__typed__.supplier),
      buyer: damlTypes.Party.encode(__typed__.buyer),
      financierA: damlTypes.Party.encode(__typed__.financierA),
      financierB: damlTypes.Party.encode(__typed__.financierB),
      financierC: damlTypes.Party.encode(__typed__.financierC),
      auditor: damlTypes.Party.encode(__typed__.auditor),
      operatorOne: damlTypes.Party.encode(__typed__.operatorOne),
      operatorTwo: damlTypes.Party.encode(__typed__.operatorTwo),
      operatorThree: damlTypes.Party.encode(__typed__.operatorThree),
    };
  },
};
