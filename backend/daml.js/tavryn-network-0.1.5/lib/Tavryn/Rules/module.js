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

var pkg9e70a8b3510d617f8a136213f33d6a903a10ca0eeec76bb06ba55d1ed9680f69 = require('@tavryn.js/ghc-stdlib-DA-Internal-Template-1.0.0');

exports.BuyerApprovalRegistry = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Rules:BuyerApprovalRegistry',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Rules:BuyerApprovalRegistry',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        networkId: damlTypes.Text.decoder,
        operators: damlTypes.List(damlTypes.Party).decoder,
        buyer: damlTypes.Party.decoder,
        approvedInvoiceNumbers: damlTypes.List(damlTypes.Text).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        networkId: damlTypes.Text.encode(__typed__.networkId),
        operators: damlTypes.List(damlTypes.Party).encode(__typed__.operators),
        buyer: damlTypes.Party.encode(__typed__.buyer),
        approvedInvoiceNumbers: damlTypes.List(damlTypes.Text).encode(__typed__.approvedInvoiceNumbers),
      };
    },
    Archive: {
      template: function () { return exports.BuyerApprovalRegistry; },
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
    RecordApproval: {
      template: function () { return exports.BuyerApprovalRegistry; },
      choiceName: 'RecordApproval',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.RecordApproval.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.RecordApproval.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.BuyerApprovalRegistry).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.BuyerApprovalRegistry).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.BuyerApprovalRegistry, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.NetworkRules = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Rules:NetworkRules',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Rules:NetworkRules',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        networkId: damlTypes.Text.decoder,
        operators: damlTypes.List(damlTypes.Party).decoder,
        threshold: damlTypes.Int.decoder,
        financiers: damlTypes.List(damlTypes.Party).decoder,
        buyers: damlTypes.List(damlTypes.Party).decoder,
        participants: damlTypes.List(damlTypes.Party).decoder,
        maxAdvanceRate: damlTypes.Numeric(10).decoder,
        version: damlTypes.Int.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        networkId: damlTypes.Text.encode(__typed__.networkId),
        operators: damlTypes.List(damlTypes.Party).encode(__typed__.operators),
        threshold: damlTypes.Int.encode(__typed__.threshold),
        financiers: damlTypes.List(damlTypes.Party).encode(__typed__.financiers),
        buyers: damlTypes.List(damlTypes.Party).encode(__typed__.buyers),
        participants: damlTypes.List(damlTypes.Party).encode(__typed__.participants),
        maxAdvanceRate: damlTypes.Numeric(10).encode(__typed__.maxAdvanceRate),
        version: damlTypes.Int.encode(__typed__.version),
      };
    },
    Archive: {
      template: function () { return exports.NetworkRules; },
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

damlTypes.registerTemplate(exports.NetworkRules, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.RecordApproval = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      externalInvoiceNumber: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      externalInvoiceNumber: damlTypes.Text.encode(__typed__.externalInvoiceNumber),
    };
  },
};
