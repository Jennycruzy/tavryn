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
