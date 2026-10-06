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

var Tavryn_Rules = require('../../Tavryn/Rules/module');
var Tavryn_Types = require('../../Tavryn/Types/module');

exports.Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      approvedInvoiceCid: damlTypes.ContractId(exports.ApprovedInvoice).decoder,
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).decoder,
      paymentReference: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      approvedInvoiceCid: damlTypes.ContractId(exports.ApprovedInvoice).encode(__typed__.approvedInvoiceCid),
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).encode(__typed__.rulesCid),
      paymentReference: damlTypes.Text.encode(__typed__.paymentReference),
    };
  },
};

exports.Approve = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).decoder,
      registryCid: damlTypes.ContractId(Tavryn_Rules.BuyerApprovalRegistry).decoder,
      eligibleFinanciers: damlTypes.List(damlTypes.Party).decoder,
      auditor: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).encode(__typed__.rulesCid),
      registryCid: damlTypes.ContractId(Tavryn_Rules.BuyerApprovalRegistry).encode(__typed__.registryCid),
      eligibleFinanciers: damlTypes.List(damlTypes.Party).encode(__typed__.eligibleFinanciers),
      auditor: damlTypes.Party.encode(__typed__.auditor),
    };
  },
};

exports.ApprovedInvoice = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:ApprovedInvoice',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:ApprovedInvoice',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        supplier: damlTypes.Party.decoder,
        buyer: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        invoiceDetails: damlTypes.ContractId(exports.InvoiceDetails).decoder,
        fundingSlot: damlTypes.ContractId(exports.FundingSlot).decoder,
        eligibleFinanciers: damlTypes.List(damlTypes.Party).decoder,
        auditor: damlTypes.Party.decoder,
        networkId: damlTypes.Text.decoder,
        operators: damlTypes.List(damlTypes.Party).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        supplier: damlTypes.Party.encode(__typed__.supplier),
        buyer: damlTypes.Party.encode(__typed__.buyer),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        invoiceDetails: damlTypes.ContractId(exports.InvoiceDetails).encode(__typed__.invoiceDetails),
        fundingSlot: damlTypes.ContractId(exports.FundingSlot).encode(__typed__.fundingSlot),
        eligibleFinanciers: damlTypes.List(damlTypes.Party).encode(__typed__.eligibleFinanciers),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        networkId: damlTypes.Text.encode(__typed__.networkId),
        operators: damlTypes.List(damlTypes.Party).encode(__typed__.operators),
      };
    },
    Archive: {
      template: function () { return exports.ApprovedInvoice; },
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
    CreateOffer: {
      template: function () { return exports.ApprovedInvoice; },
      choiceName: 'CreateOffer',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.CreateOffer.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.CreateOffer.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.FinancingOffer).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.FinancingOffer).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.ApprovedInvoice, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.BalanceDue = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:BalanceDue',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:BalanceDue',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        financier: damlTypes.Party.decoder,
        supplier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        currency: damlTypes.Text.decoder,
        collected: damlTypes.Numeric(10).decoder,
        advance: damlTypes.Numeric(10).decoder,
        fee: damlTypes.Numeric(10).decoder,
        balance: damlTypes.Numeric(10).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        financier: damlTypes.Party.encode(__typed__.financier),
        supplier: damlTypes.Party.encode(__typed__.supplier),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        currency: damlTypes.Text.encode(__typed__.currency),
        collected: damlTypes.Numeric(10).encode(__typed__.collected),
        advance: damlTypes.Numeric(10).encode(__typed__.advance),
        fee: damlTypes.Numeric(10).encode(__typed__.fee),
        balance: damlTypes.Numeric(10).encode(__typed__.balance),
      };
    },
    Archive: {
      template: function () { return exports.BalanceDue; },
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
    PayBalance: {
      template: function () { return exports.BalanceDue; },
      choiceName: 'PayBalance',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.PayBalance.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.PayBalance.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.BalanceReceipt).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.BalanceReceipt).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.BalanceDue, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.BalanceReceipt = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:BalanceReceipt',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:BalanceReceipt',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        financier: damlTypes.Party.decoder,
        supplier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        amount: damlTypes.Numeric(10).decoder,
        instrument: damlTypes.Text.decoder,
        trackingId: damlTypes.Text.decoder,
        paymentReference: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        financier: damlTypes.Party.encode(__typed__.financier),
        supplier: damlTypes.Party.encode(__typed__.supplier),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        amount: damlTypes.Numeric(10).encode(__typed__.amount),
        instrument: damlTypes.Text.encode(__typed__.instrument),
        trackingId: damlTypes.Text.encode(__typed__.trackingId),
        paymentReference: damlTypes.Text.encode(__typed__.paymentReference),
      };
    },
    Archive: {
      template: function () { return exports.BalanceReceipt; },
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

damlTypes.registerTemplate(exports.BalanceReceipt, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.BeginFunding = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      approvedInvoiceCid: damlTypes.ContractId(exports.ApprovedInvoice).decoder,
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).decoder,
      trackingId: damlTypes.Text.decoder,
      settlementAmount: damlTypes.Numeric(10).decoder,
      instrument: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      approvedInvoiceCid: damlTypes.ContractId(exports.ApprovedInvoice).encode(__typed__.approvedInvoiceCid),
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).encode(__typed__.rulesCid),
      trackingId: damlTypes.Text.encode(__typed__.trackingId),
      settlementAmount: damlTypes.Numeric(10).encode(__typed__.settlementAmount),
      instrument: damlTypes.Text.encode(__typed__.instrument),
    };
  },
};

exports.BeginRepayment = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      repaymentDate: damlTypes.Date.decoder,
      trackingId: damlTypes.Text.decoder,
      settlementAmount: damlTypes.Numeric(10).decoder,
      instrument: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      repaymentDate: damlTypes.Date.encode(__typed__.repaymentDate),
      trackingId: damlTypes.Text.encode(__typed__.trackingId),
      settlementAmount: damlTypes.Numeric(10).encode(__typed__.settlementAmount),
      instrument: damlTypes.Text.encode(__typed__.instrument),
    };
  },
};

exports.Cancel = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.CancelRepayment = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Claim = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      claimant: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      claimant: damlTypes.Party.encode(__typed__.claimant),
    };
  },
};

exports.Complete = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      paymentReference: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      paymentReference: damlTypes.Text.encode(__typed__.paymentReference),
    };
  },
};

exports.CompleteRepayment = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      paymentReference: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      paymentReference: damlTypes.Text.encode(__typed__.paymentReference),
    };
  },
};

exports.CreateOffer = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).decoder,
      financier: damlTypes.Party.decoder,
      advance: damlTypes.Numeric(10).decoder,
      advanceRate: damlTypes.Numeric(10).decoder,
      fee: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Numeric(10)).decoder),
    });
  }),
  encode: function (__typed__) {
    return {
      rulesCid: damlTypes.ContractId(Tavryn_Rules.NetworkRules).encode(__typed__.rulesCid),
      financier: damlTypes.Party.encode(__typed__.financier),
      advance: damlTypes.Numeric(10).encode(__typed__.advance),
      advanceRate: damlTypes.Numeric(10).encode(__typed__.advanceRate),
      fee: damlTypes.Optional(damlTypes.Numeric(10)).encode(__typed__.fee),
    };
  },
};

exports.FinancedInvoice = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:FinancedInvoice',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:FinancedInvoice',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        supplier: damlTypes.Party.decoder,
        financier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        terms: Tavryn_Types.InvoiceTerms.decoder,
        advance: damlTypes.Numeric(10).decoder,
        advanceRate: damlTypes.Numeric(10).decoder,
        fee: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Numeric(10)).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        buyer: damlTypes.Party.encode(__typed__.buyer),
        supplier: damlTypes.Party.encode(__typed__.supplier),
        financier: damlTypes.Party.encode(__typed__.financier),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        terms: Tavryn_Types.InvoiceTerms.encode(__typed__.terms),
        advance: damlTypes.Numeric(10).encode(__typed__.advance),
        advanceRate: damlTypes.Numeric(10).encode(__typed__.advanceRate),
        fee: damlTypes.Optional(damlTypes.Numeric(10)).encode(__typed__.fee),
      };
    },
    Archive: {
      template: function () { return exports.FinancedInvoice; },
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
    BeginRepayment: {
      template: function () { return exports.FinancedInvoice; },
      choiceName: 'BeginRepayment',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BeginRepayment.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BeginRepayment.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.PendingRepayment).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.PendingRepayment).encode(__typed__); },
    },
    Repay: {
      template: function () { return exports.FinancedInvoice; },
      choiceName: 'Repay',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Repay.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Repay.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.RepaymentReceipt).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.RepaymentReceipt).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.FinancedInvoice, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.FinancingOffer = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:FinancingOffer',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:FinancingOffer',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        supplier: damlTypes.Party.decoder,
        buyer: damlTypes.Party.decoder,
        financier: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        terms: Tavryn_Types.InvoiceTerms.decoder,
        networkId: damlTypes.Text.decoder,
        operators: damlTypes.List(damlTypes.Party).decoder,
        advance: damlTypes.Numeric(10).decoder,
        advanceRate: damlTypes.Numeric(10).decoder,
        fee: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Numeric(10)).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        supplier: damlTypes.Party.encode(__typed__.supplier),
        buyer: damlTypes.Party.encode(__typed__.buyer),
        financier: damlTypes.Party.encode(__typed__.financier),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        terms: Tavryn_Types.InvoiceTerms.encode(__typed__.terms),
        networkId: damlTypes.Text.encode(__typed__.networkId),
        operators: damlTypes.List(damlTypes.Party).encode(__typed__.operators),
        advance: damlTypes.Numeric(10).encode(__typed__.advance),
        advanceRate: damlTypes.Numeric(10).encode(__typed__.advanceRate),
        fee: damlTypes.Optional(damlTypes.Numeric(10)).encode(__typed__.fee),
      };
    },
    Accept: {
      template: function () { return exports.FinancingOffer; },
      choiceName: 'Accept',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Accept.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Accept.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.FinancedInvoice).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.FinancedInvoice).encode(__typed__); },
    },
    Archive: {
      template: function () { return exports.FinancingOffer; },
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
    BeginFunding: {
      template: function () { return exports.FinancingOffer; },
      choiceName: 'BeginFunding',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.BeginFunding.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.BeginFunding.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.PendingFunding).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.PendingFunding).encode(__typed__); },
    },
    Withdraw: {
      template: function () { return exports.FinancingOffer; },
      choiceName: 'Withdraw',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Withdraw.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Withdraw.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.OfferClosed).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.OfferClosed).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.FinancingOffer, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.FundingReceipt = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:FundingReceipt',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:FundingReceipt',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        supplier: damlTypes.Party.decoder,
        financier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        financedInvoice: damlTypes.ContractId(exports.FinancedInvoice).decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        settlementAmount: damlTypes.Numeric(10).decoder,
        instrument: damlTypes.Text.decoder,
        trackingId: damlTypes.Text.decoder,
        paymentReference: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        buyer: damlTypes.Party.encode(__typed__.buyer),
        supplier: damlTypes.Party.encode(__typed__.supplier),
        financier: damlTypes.Party.encode(__typed__.financier),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        financedInvoice: damlTypes.ContractId(exports.FinancedInvoice).encode(__typed__.financedInvoice),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        settlementAmount: damlTypes.Numeric(10).encode(__typed__.settlementAmount),
        instrument: damlTypes.Text.encode(__typed__.instrument),
        trackingId: damlTypes.Text.encode(__typed__.trackingId),
        paymentReference: damlTypes.Text.encode(__typed__.paymentReference),
      };
    },
    Archive: {
      template: function () { return exports.FundingReceipt; },
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

damlTypes.registerTemplate(exports.FundingReceipt, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.FundingSlot = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:FundingSlot',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:FundingSlot',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        supplier: damlTypes.Party.decoder,
        buyer: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        eligibleFinanciers: damlTypes.List(damlTypes.Party).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        supplier: damlTypes.Party.encode(__typed__.supplier),
        buyer: damlTypes.Party.encode(__typed__.buyer),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        eligibleFinanciers: damlTypes.List(damlTypes.Party).encode(__typed__.eligibleFinanciers),
      };
    },
    Archive: {
      template: function () { return exports.FundingSlot; },
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
    Claim: {
      template: function () { return exports.FundingSlot; },
      choiceName: 'Claim',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Claim.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Claim.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.FundingSlot, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.InvoiceDetails = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:InvoiceDetails',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:InvoiceDetails',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        supplier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        terms: Tavryn_Types.InvoiceTerms.decoder,
        salt: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        buyer: damlTypes.Party.encode(__typed__.buyer),
        supplier: damlTypes.Party.encode(__typed__.supplier),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        terms: Tavryn_Types.InvoiceTerms.encode(__typed__.terms),
        salt: damlTypes.Text.encode(__typed__.salt),
      };
    },
    Archive: {
      template: function () { return exports.InvoiceDetails; },
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

damlTypes.registerTemplate(exports.InvoiceDetails, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.InvoiceDraft = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:InvoiceDraft',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:InvoiceDraft',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        supplier: damlTypes.Party.decoder,
        buyer: damlTypes.Party.decoder,
        terms: Tavryn_Types.InvoiceTerms.decoder,
        salt: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        supplier: damlTypes.Party.encode(__typed__.supplier),
        buyer: damlTypes.Party.encode(__typed__.buyer),
        terms: Tavryn_Types.InvoiceTerms.encode(__typed__.terms),
        salt: damlTypes.Text.encode(__typed__.salt),
      };
    },
    Approve: {
      template: function () { return exports.InvoiceDraft; },
      choiceName: 'Approve',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Approve.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Approve.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.ApprovedInvoice).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.ApprovedInvoice).encode(__typed__); },
    },
    Archive: {
      template: function () { return exports.InvoiceDraft; },
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

damlTypes.registerTemplate(exports.InvoiceDraft, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.OfferClosed = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:OfferClosed',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:OfferClosed',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        supplier: damlTypes.Party.decoder,
        financier: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        buyer: damlTypes.Party.encode(__typed__.buyer),
        supplier: damlTypes.Party.encode(__typed__.supplier),
        financier: damlTypes.Party.encode(__typed__.financier),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
      };
    },
    Archive: {
      template: function () { return exports.OfferClosed; },
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

damlTypes.registerTemplate(exports.OfferClosed, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.PayBalance = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      paymentReference: damlTypes.Text.decoder,
      instrument: damlTypes.Text.decoder,
      trackingId: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      paymentReference: damlTypes.Text.encode(__typed__.paymentReference),
      instrument: damlTypes.Text.encode(__typed__.instrument),
      trackingId: damlTypes.Text.encode(__typed__.trackingId),
    };
  },
};

exports.PendingFunding = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:PendingFunding',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:PendingFunding',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        supplier: damlTypes.Party.decoder,
        financier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        invoiceDetails: damlTypes.ContractId(exports.InvoiceDetails).decoder,
        eligibleFinanciers: damlTypes.List(damlTypes.Party).decoder,
        networkId: damlTypes.Text.decoder,
        operators: damlTypes.List(damlTypes.Party).decoder,
        terms: Tavryn_Types.InvoiceTerms.decoder,
        advance: damlTypes.Numeric(10).decoder,
        advanceRate: damlTypes.Numeric(10).decoder,
        trackingId: damlTypes.Text.decoder,
        settlementAmount: damlTypes.Numeric(10).decoder,
        instrument: damlTypes.Text.decoder,
        lockedAt: damlTypes.Time.decoder,
        fee: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Numeric(10)).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        buyer: damlTypes.Party.encode(__typed__.buyer),
        supplier: damlTypes.Party.encode(__typed__.supplier),
        financier: damlTypes.Party.encode(__typed__.financier),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        invoiceDetails: damlTypes.ContractId(exports.InvoiceDetails).encode(__typed__.invoiceDetails),
        eligibleFinanciers: damlTypes.List(damlTypes.Party).encode(__typed__.eligibleFinanciers),
        networkId: damlTypes.Text.encode(__typed__.networkId),
        operators: damlTypes.List(damlTypes.Party).encode(__typed__.operators),
        terms: Tavryn_Types.InvoiceTerms.encode(__typed__.terms),
        advance: damlTypes.Numeric(10).encode(__typed__.advance),
        advanceRate: damlTypes.Numeric(10).encode(__typed__.advanceRate),
        trackingId: damlTypes.Text.encode(__typed__.trackingId),
        settlementAmount: damlTypes.Numeric(10).encode(__typed__.settlementAmount),
        instrument: damlTypes.Text.encode(__typed__.instrument),
        lockedAt: damlTypes.Time.encode(__typed__.lockedAt),
        fee: damlTypes.Optional(damlTypes.Numeric(10)).encode(__typed__.fee),
      };
    },
    Archive: {
      template: function () { return exports.PendingFunding; },
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
    Cancel: {
      template: function () { return exports.PendingFunding; },
      choiceName: 'Cancel',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Cancel.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Cancel.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.ApprovedInvoice).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.ApprovedInvoice).encode(__typed__); },
    },
    Complete: {
      template: function () { return exports.PendingFunding; },
      choiceName: 'Complete',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.Complete.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.Complete.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.FinancedInvoice).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.FinancedInvoice).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.PendingFunding, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.PendingRepayment = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:PendingRepayment',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:PendingRepayment',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        supplier: damlTypes.Party.decoder,
        financier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        terms: Tavryn_Types.InvoiceTerms.decoder,
        advance: damlTypes.Numeric(10).decoder,
        advanceRate: damlTypes.Numeric(10).decoder,
        repaymentDate: damlTypes.Date.decoder,
        trackingId: damlTypes.Text.decoder,
        settlementAmount: damlTypes.Numeric(10).decoder,
        instrument: damlTypes.Text.decoder,
        lockedAt: damlTypes.Time.decoder,
        fee: jtv.Decoder.withDefault(null, damlTypes.Optional(damlTypes.Numeric(10)).decoder),
      });
    }),
    encode: function (__typed__) {
      return {
        buyer: damlTypes.Party.encode(__typed__.buyer),
        supplier: damlTypes.Party.encode(__typed__.supplier),
        financier: damlTypes.Party.encode(__typed__.financier),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        terms: Tavryn_Types.InvoiceTerms.encode(__typed__.terms),
        advance: damlTypes.Numeric(10).encode(__typed__.advance),
        advanceRate: damlTypes.Numeric(10).encode(__typed__.advanceRate),
        repaymentDate: damlTypes.Date.encode(__typed__.repaymentDate),
        trackingId: damlTypes.Text.encode(__typed__.trackingId),
        settlementAmount: damlTypes.Numeric(10).encode(__typed__.settlementAmount),
        instrument: damlTypes.Text.encode(__typed__.instrument),
        lockedAt: damlTypes.Time.encode(__typed__.lockedAt),
        fee: damlTypes.Optional(damlTypes.Numeric(10)).encode(__typed__.fee),
      };
    },
    Archive: {
      template: function () { return exports.PendingRepayment; },
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
    CancelRepayment: {
      template: function () { return exports.PendingRepayment; },
      choiceName: 'CancelRepayment',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.CancelRepayment.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.CancelRepayment.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.FinancedInvoice).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.FinancedInvoice).encode(__typed__); },
    },
    CompleteRepayment: {
      template: function () { return exports.PendingRepayment; },
      choiceName: 'CompleteRepayment',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.CompleteRepayment.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.CompleteRepayment.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.RepaymentReceipt).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.RepaymentReceipt).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.PendingRepayment, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.Repay = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      repaymentDate: damlTypes.Date.decoder,
      paymentReference: damlTypes.Text.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      repaymentDate: damlTypes.Date.encode(__typed__.repaymentDate),
      paymentReference: damlTypes.Text.encode(__typed__.paymentReference),
    };
  },
};

exports.RepaymentReceipt = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn-network:Tavryn.Contracts:RepaymentReceipt',
    templateIdWithPackageId: '#f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4:Tavryn.Contracts:RepaymentReceipt',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        financier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        repaymentDate: damlTypes.Date.decoder,
        early: damlTypes.Bool.decoder,
        amount: damlTypes.Numeric(10).decoder,
        instrument: damlTypes.Text.decoder,
        trackingId: damlTypes.Text.decoder,
        paymentReference: damlTypes.Text.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        buyer: damlTypes.Party.encode(__typed__.buyer),
        financier: damlTypes.Party.encode(__typed__.financier),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        repaymentDate: damlTypes.Date.encode(__typed__.repaymentDate),
        early: damlTypes.Bool.encode(__typed__.early),
        amount: damlTypes.Numeric(10).encode(__typed__.amount),
        instrument: damlTypes.Text.encode(__typed__.instrument),
        trackingId: damlTypes.Text.encode(__typed__.trackingId),
        paymentReference: damlTypes.Text.encode(__typed__.paymentReference),
      };
    },
    Archive: {
      template: function () { return exports.RepaymentReceipt; },
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

damlTypes.registerTemplate(exports.RepaymentReceipt, ['f658b6f121a2661d16939a15d14374931de519a0e899432afa9d4c5fdc9634f4', '#tavryn-network']);

exports.Withdraw = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};
