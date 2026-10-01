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

var Tavryn_Types = require('../../Tavryn/Types/module');

exports.Accept = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.Approve = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      networkRules: damlTypes.ContractId(exports.NetworkRules).decoder,
      approvalRegistry: damlTypes.ContractId(exports.BuyerApprovalRegistry).decoder,
      eligibleFinanciers: damlTypes.List(damlTypes.Party).decoder,
      auditor: damlTypes.Party.decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      networkRules: damlTypes.ContractId(exports.NetworkRules).encode(__typed__.networkRules),
      approvalRegistry: damlTypes.ContractId(exports.BuyerApprovalRegistry).encode(__typed__.approvalRegistry),
      eligibleFinanciers: damlTypes.List(damlTypes.Party).encode(__typed__.eligibleFinanciers),
      auditor: damlTypes.Party.encode(__typed__.auditor),
    };
  },
};

exports.ApprovedInvoice = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn:Tavryn.Contracts:ApprovedInvoice',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:ApprovedInvoice',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        supplier: damlTypes.Party.decoder,
        buyer: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        invoiceDetails: damlTypes.ContractId(exports.InvoiceDetails).decoder,
        networkRules: damlTypes.ContractId(exports.NetworkRules).decoder,
        fundingSlot: damlTypes.ContractId(exports.FundingSlot).decoder,
        eligibleFinanciers: damlTypes.List(damlTypes.Party).decoder,
        auditor: damlTypes.Party.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        supplier: damlTypes.Party.encode(__typed__.supplier),
        buyer: damlTypes.Party.encode(__typed__.buyer),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        invoiceDetails: damlTypes.ContractId(exports.InvoiceDetails).encode(__typed__.invoiceDetails),
        networkRules: damlTypes.ContractId(exports.NetworkRules).encode(__typed__.networkRules),
        fundingSlot: damlTypes.ContractId(exports.FundingSlot).encode(__typed__.fundingSlot),
        eligibleFinanciers: damlTypes.List(damlTypes.Party).encode(__typed__.eligibleFinanciers),
        auditor: damlTypes.Party.encode(__typed__.auditor),
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
    FinalizeFunding: {
      template: function () { return exports.ApprovedInvoice; },
      choiceName: 'FinalizeFunding',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.FinalizeFunding.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.FinalizeFunding.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.FinancedInvoice).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.FinancedInvoice).encode(__typed__); },
    },
    ReopenFunding: {
      template: function () { return exports.ApprovedInvoice; },
      choiceName: 'ReopenFunding',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.ReopenFunding.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.ReopenFunding.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.ApprovedInvoice).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.ApprovedInvoice).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.ApprovedInvoice, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

exports.BeginFunding = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

exports.BuyerApprovalRegistry = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn:Tavryn.Contracts:BuyerApprovalRegistry',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:BuyerApprovalRegistry',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        approvedInvoiceNumbers: damlTypes.List(damlTypes.Text).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
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

damlTypes.registerTemplate(exports.BuyerApprovalRegistry, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

exports.Cancel = {
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

exports.CreateOffer = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      approvedInvoice: damlTypes.ContractId(exports.ApprovedInvoice).decoder,
      financier: damlTypes.Party.decoder,
      advance: damlTypes.Numeric(10).decoder,
      advanceRate: damlTypes.Numeric(10).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      approvedInvoice: damlTypes.ContractId(exports.ApprovedInvoice).encode(__typed__.approvedInvoice),
      financier: damlTypes.Party.encode(__typed__.financier),
      advance: damlTypes.Numeric(10).encode(__typed__.advance),
      advanceRate: damlTypes.Numeric(10).encode(__typed__.advanceRate),
    };
  },
};

exports.FinalizeFunding = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      financier: damlTypes.Party.decoder,
      advance: damlTypes.Numeric(10).decoder,
      advanceRate: damlTypes.Numeric(10).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      financier: damlTypes.Party.encode(__typed__.financier),
      advance: damlTypes.Numeric(10).encode(__typed__.advance),
      advanceRate: damlTypes.Numeric(10).encode(__typed__.advanceRate),
    };
  },
};

exports.FinancedInvoice = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn:Tavryn.Contracts:FinancedInvoice',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:FinancedInvoice',
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

damlTypes.registerTemplate(exports.FinancedInvoice, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

exports.FinancingOffer = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn:Tavryn.Contracts:FinancingOffer',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:FinancingOffer',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        supplier: damlTypes.Party.decoder,
        buyer: damlTypes.Party.decoder,
        financier: damlTypes.Party.decoder,
        approvedInvoice: damlTypes.ContractId(exports.ApprovedInvoice).decoder,
        fundingSlot: damlTypes.ContractId(exports.FundingSlot).decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        terms: Tavryn_Types.InvoiceTerms.decoder,
        networkRules: damlTypes.ContractId(exports.NetworkRules).decoder,
        advance: damlTypes.Numeric(10).decoder,
        advanceRate: damlTypes.Numeric(10).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        supplier: damlTypes.Party.encode(__typed__.supplier),
        buyer: damlTypes.Party.encode(__typed__.buyer),
        financier: damlTypes.Party.encode(__typed__.financier),
        approvedInvoice: damlTypes.ContractId(exports.ApprovedInvoice).encode(__typed__.approvedInvoice),
        fundingSlot: damlTypes.ContractId(exports.FundingSlot).encode(__typed__.fundingSlot),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        terms: Tavryn_Types.InvoiceTerms.encode(__typed__.terms),
        networkRules: damlTypes.ContractId(exports.NetworkRules).encode(__typed__.networkRules),
        advance: damlTypes.Numeric(10).encode(__typed__.advance),
        advanceRate: damlTypes.Numeric(10).encode(__typed__.advanceRate),
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
        return damlTypes.Unit.decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.Unit.encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.FinancingOffer, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

exports.FundingReceipt = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn:Tavryn.Contracts:FundingReceipt',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:FundingReceipt',
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

damlTypes.registerTemplate(exports.FundingReceipt, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

exports.FundingSlot = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn:Tavryn.Contracts:FundingSlot',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:FundingSlot',
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

damlTypes.registerTemplate(exports.FundingSlot, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

exports.InvoiceDetails = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn:Tavryn.Contracts:InvoiceDetails',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:InvoiceDetails',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        supplier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        terms: Tavryn_Types.InvoiceTerms.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        buyer: damlTypes.Party.encode(__typed__.buyer),
        supplier: damlTypes.Party.encode(__typed__.supplier),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        terms: Tavryn_Types.InvoiceTerms.encode(__typed__.terms),
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

damlTypes.registerTemplate(exports.InvoiceDetails, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

exports.InvoiceDraft = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn:Tavryn.Contracts:InvoiceDraft',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:InvoiceDraft',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        supplier: damlTypes.Party.decoder,
        buyer: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        terms: Tavryn_Types.InvoiceTerms.decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        supplier: damlTypes.Party.encode(__typed__.supplier),
        buyer: damlTypes.Party.encode(__typed__.buyer),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        terms: Tavryn_Types.InvoiceTerms.encode(__typed__.terms),
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

damlTypes.registerTemplate(exports.InvoiceDraft, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

exports.NetworkRules = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn:Tavryn.Contracts:NetworkRules',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:NetworkRules',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        governanceParty: damlTypes.Party.decoder,
        members: damlTypes.List(damlTypes.Party).decoder,
        maxAdvanceRate: damlTypes.Numeric(10).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        governanceParty: damlTypes.Party.encode(__typed__.governanceParty),
        members: damlTypes.List(damlTypes.Party).encode(__typed__.members),
        maxAdvanceRate: damlTypes.Numeric(10).encode(__typed__.maxAdvanceRate),
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
    SetMaxAdvanceRate: {
      template: function () { return exports.NetworkRules; },
      choiceName: 'SetMaxAdvanceRate',
      argumentDecoder: damlTypes.lazyMemo(function () {
        return exports.SetMaxAdvanceRate.decoder;
      }),
      argumentEncode: function (__typed__) { return exports.SetMaxAdvanceRate.encode(__typed__); },
      resultDecoder: damlTypes.lazyMemo(function () {
        return damlTypes.ContractId(exports.NetworkRules).decoder;
      }),
      resultEncode: function (__typed__) { return damlTypes.ContractId(exports.NetworkRules).encode(__typed__); },
    },
  },
);

damlTypes.registerTemplate(exports.NetworkRules, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

exports.PendingFunding = damlTypes.assembleTemplate(
  {
    templateId: '#tavryn:Tavryn.Contracts:PendingFunding',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:PendingFunding',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        supplier: damlTypes.Party.decoder,
        financier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        approvedInvoice: damlTypes.ContractId(exports.ApprovedInvoice).decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        terms: Tavryn_Types.InvoiceTerms.decoder,
        networkRules: damlTypes.ContractId(exports.NetworkRules).decoder,
        advance: damlTypes.Numeric(10).decoder,
        advanceRate: damlTypes.Numeric(10).decoder,
      });
    }),
    encode: function (__typed__) {
      return {
        buyer: damlTypes.Party.encode(__typed__.buyer),
        supplier: damlTypes.Party.encode(__typed__.supplier),
        financier: damlTypes.Party.encode(__typed__.financier),
        auditor: damlTypes.Party.encode(__typed__.auditor),
        approvedInvoice: damlTypes.ContractId(exports.ApprovedInvoice).encode(__typed__.approvedInvoice),
        invoiceCommitment: damlTypes.Text.encode(__typed__.invoiceCommitment),
        terms: Tavryn_Types.InvoiceTerms.encode(__typed__.terms),
        networkRules: damlTypes.ContractId(exports.NetworkRules).encode(__typed__.networkRules),
        advance: damlTypes.Numeric(10).encode(__typed__.advance),
        advanceRate: damlTypes.Numeric(10).encode(__typed__.advanceRate),
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

damlTypes.registerTemplate(exports.PendingFunding, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

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

exports.ReopenFunding = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};

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
    templateId: '#tavryn:Tavryn.Contracts:RepaymentReceipt',
    templateIdWithPackageId: '#ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05:Tavryn.Contracts:RepaymentReceipt',
    keyDecoder: jtv.constant(undefined),
    keyEncode: function () { throw 'EncodeError'; },
    decoder: damlTypes.lazyMemo(function () {
      return jtv.object({
        buyer: damlTypes.Party.decoder,
        financier: damlTypes.Party.decoder,
        auditor: damlTypes.Party.decoder,
        invoiceCommitment: damlTypes.Text.decoder,
        repaymentDate: damlTypes.Date.decoder,
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

damlTypes.registerTemplate(exports.RepaymentReceipt, ['ef9391a48163946a5c3fe26f92e5e9c980be5aab8b30a4891e4312b97db1fe05', '#tavryn']);

exports.SetMaxAdvanceRate = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
      newRate: damlTypes.Numeric(10).decoder,
    });
  }),
  encode: function (__typed__) {
    return {
      newRate: damlTypes.Numeric(10).encode(__typed__.newRate),
    };
  },
};

exports.Withdraw = {
  decoder: damlTypes.lazyMemo(function () {
    return jtv.object({
    });
  }),
  encode: function (__typed__) {
    return {};
  },
};
