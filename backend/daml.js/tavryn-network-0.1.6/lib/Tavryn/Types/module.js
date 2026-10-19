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

exports.GovernanceAction = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.oneOf(
      jtv.object({
        tag: jtv.constant("AdmitFinancier"),
        value: damlTypes.Party.decoder,
      }),
      jtv.object({
        tag: jtv.constant("RemoveFinancier"),
        value: damlTypes.Party.decoder,
      }),
      jtv.object({
        tag: jtv.constant("SetMaxAdvanceRate"),
        value: damlTypes.Numeric(10).decoder,
      }),
      jtv.object({
        tag: jtv.constant("OnboardBuyer"),
        value: damlTypes.Party.decoder,
      }),
      jtv.object({
        tag: jtv.constant("AdmitParticipant"),
        value: damlTypes.Party.decoder,
      }),
    );
  }),
  encode: function (__typed__) {
    switch(__typed__.tag) {
      case 'AdmitFinancier': return {tag: __typed__.tag, value: damlTypes.Party.encode(__typed__.value)};
      case 'RemoveFinancier': return {tag: __typed__.tag, value: damlTypes.Party.encode(__typed__.value)};
      case 'SetMaxAdvanceRate': return {tag: __typed__.tag, value: damlTypes.Numeric(10).encode(__typed__.value)};
      case 'OnboardBuyer': return {tag: __typed__.tag, value: damlTypes.Party.encode(__typed__.value)};
      case 'AdmitParticipant': return {tag: __typed__.tag, value: damlTypes.Party.encode(__typed__.value)};
      default: throw 'unrecognized type tag: ' + __typed__.tag + ' while serializing a value of type GovernanceAction';
    }
  },
};

exports.InvoiceTerms = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      externalInvoiceNumber: damlTypes.Text.decoder,
      faceValue: damlTypes.Numeric(10).decoder,
      currency: damlTypes.Text.decoder,
      issuedDate: damlTypes.Date.decoder,
      dueDate: damlTypes.Date.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      externalInvoiceNumber: damlTypes.Text.encode(__typed__.externalInvoiceNumber),
      faceValue: damlTypes.Numeric(10).encode(__typed__.faceValue),
      currency: damlTypes.Text.encode(__typed__.currency),
      issuedDate: damlTypes.Date.encode(__typed__.issuedDate),
      dueDate: damlTypes.Date.encode(__typed__.dueDate),
    };
  },
};
