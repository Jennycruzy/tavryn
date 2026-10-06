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

var pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4 = require('@tavryn.js/daml-prim-DA-Types-1.0.0');
var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@tavryn.js/ghc-stdlib-DA-Internal-Template-1.0.0');

var Tavryn_Rules = require('../../Tavryn/Rules/module');
var Tavryn_Types = require('../../Tavryn/Types/module');

exports.CommitteeBootstrap = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Governance:CommitteeBootstrap',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Governance:CommitteeBootstrap',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        networkId: damlTypes.Text.decoder,
        operators: damlTypes.List(damlTypes.Party).decoder,
        threshold: damlTypes.Int.decoder,
        accepted: damlTypes.List(damlTypes.Party).decoder,
        financiers: damlTypes.List(damlTypes.Party).decoder,
        participants: damlTypes.List(damlTypes.Party).decoder,
        maxAdvanceRate: damlTypes.Numeric(10).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        networkId: damlTypes.Text.encode(__typed__.networkId),
        operators: damlTypes.List(damlTypes.Party).encode(__typed__.operators),
        threshold: damlTypes.Int.encode(__typed__.threshold),
        accepted: damlTypes.List(damlTypes.Party).encode(__typed__.accepted),
        financiers: damlTypes.List(damlTypes.Party).encode(__typed__.financiers),
        participants: damlTypes.List(damlTypes.Party).encode(__typed__.participants),
        maxAdvanceRate: damlTypes.Numeric(10).encode(__typed__.maxAdvanceRate),
      };
    },
    Archive: {
      template: function () { return exports.CommitteeBootstrap; },
      choiceName: 'Archive',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive.decoder;
      }),
      argumentEncode: function (__typed__) { return pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    Finalize: {
      template: function () { return exports.CommitteeBootstrap; },
      choiceName: 'Finalize',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Finalize.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Finalize.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.GovernanceCommittee), damlTypes.ContractId(Tavryn_Rules.NetworkRules)).decoder;
      }),
      resultEncode: function (__typed__) { return pkg5aee9b21b8e9a4c4975b5f4c4198e6e6e8469df49e2010820e792f393db870f4.DA.Types.Tuple2(damlTypes.ContractId(exports.GovernanceCommittee), damlTypes.ContractId(Tavryn_Rules.NetworkRules)).encode(__typed__); },
    },
    Join: {
      template: function () { return exports.CommitteeBootstrap; },
      choiceName: 'Join',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Join.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Join.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.CommitteeBootstrap).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.CommitteeBootstrap).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.CommitteeBootstrap, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.Execute = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      executor: damlTypes.Party.decoder,
      proposalCid: damlTypes.ContractId(exports.GovernanceProposal).decoder,
      voteCids: damlTypes.List(damlTypes.ContractId(exports.GovernanceVote)).decoder,
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      executor: damlTypes.Party.encode(__typed__.executor),
      proposalCid: damlTypes.ContractId(exports.GovernanceProposal).encode(__typed__.proposalCid),
      voteCids: damlTypes.List(damlTypes.ContractId(exports.GovernanceVote)).encode(__typed__.voteCids),
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).encode(__typed__.rulesCid),
    };
  },
};

exports.Finalize = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      operator: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      operator: damlTypes.Party.encode(__typed__.operator),
    };
  },
};

exports.GovernanceCommittee = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Governance:GovernanceCommittee',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Governance:GovernanceCommittee',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        networkId: damlTypes.Text.decoder,
        operators: damlTypes.List(damlTypes.Party).decoder,
        threshold: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        networkId: damlTypes.Text.encode(__typed__.networkId),
        operators: damlTypes.List(damlTypes.Party).encode(__typed__.operators),
        threshold: damlTypes.Int.encode(__typed__.threshold),
      };
    },
    Archive: {
      template: function () { return exports.GovernanceCommittee; },
      choiceName: 'Archive',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive.decoder;
      }),
      argumentEncode: function (__typed__) { return pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    Execute: {
      template: function () { return exports.GovernanceCommittee; },
      choiceName: 'Execute',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Execute.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Execute.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(Tavryn_Rules.NetworkRules).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(Tavryn_Rules.NetworkRules).encode(__typed__); },
    },
    Propose: {
      template: function () { return exports.GovernanceCommittee; },
      choiceName: 'Propose',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Propose.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Propose.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.GovernanceProposal).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.GovernanceProposal).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.GovernanceCommittee, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.GovernanceProposal = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Governance:GovernanceProposal',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Governance:GovernanceProposal',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        networkId: damlTypes.Text.decoder,
        operators: damlTypes.List(damlTypes.Party).decoder,
        proposer: damlTypes.Party.decoder,
        action: Tavryn_Types.GovernanceAction.decoder,
        rulesVersion: damlTypes.Int.decoder,
        expiresAt: damlTypes.Time.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        networkId: damlTypes.Text.encode(__typed__.networkId),
        operators: damlTypes.List(damlTypes.Party).encode(__typed__.operators),
        proposer: damlTypes.Party.encode(__typed__.proposer),
        action: Tavryn_Types.GovernanceAction.encode(__typed__.action),
        rulesVersion: damlTypes.Int.encode(__typed__.rulesVersion),
        expiresAt: damlTypes.Time.encode(__typed__.expiresAt),
      };
    },
    Archive: {
      template: function () { return exports.GovernanceProposal; },
      choiceName: 'Archive',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive.decoder;
      }),
      argumentEncode: function (__typed__) { return pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
    Vote: {
      template: function () { return exports.GovernanceProposal; },
      choiceName: 'Vote',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Vote.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Vote.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.GovernanceVote).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.GovernanceVote).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.GovernanceProposal, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.GovernanceVote = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Governance:GovernanceVote',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Governance:GovernanceVote',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        networkId: damlTypes.Text.decoder,
        operators: damlTypes.List(damlTypes.Party).decoder,
        proposal: damlTypes.ContractId(exports.GovernanceProposal).decoder,
        rulesVersion: damlTypes.Int.decoder,
        operator: damlTypes.Party.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        networkId: damlTypes.Text.encode(__typed__.networkId),
        operators: damlTypes.List(damlTypes.Party).encode(__typed__.operators),
        proposal: damlTypes.ContractId(exports.GovernanceProposal).encode(__typed__.proposal),
        rulesVersion: damlTypes.Int.encode(__typed__.rulesVersion),
        operator: damlTypes.Party.encode(__typed__.operator),
      };
    },
    Archive: {
      template: function () { return exports.GovernanceVote; },
      choiceName: 'Archive',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive.decoder;
      }),
      argumentEncode: function (__typed__) { return pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69.DA.Internal.Template.Archive.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.GovernanceVote, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.Join = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      operator: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      operator: damlTypes.Party.encode(__typed__.operator),
    };
  },
};

exports.Propose = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      proposer: damlTypes.Party.decoder,
      action: Tavryn_Types.GovernanceAction.decoder,
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).decoder,
      expiresAt: damlTypes.Time.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      proposer: damlTypes.Party.encode(__typed__.proposer),
      action: Tavryn_Types.GovernanceAction.encode(__typed__.action),
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).encode(__typed__.rulesCid),
      expiresAt: damlTypes.Time.encode(__typed__.expiresAt),
    };
  },
};

exports.Vote = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      operator: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      operator: damlTypes.Party.encode(__typed__.operator),
    };
  },
};
