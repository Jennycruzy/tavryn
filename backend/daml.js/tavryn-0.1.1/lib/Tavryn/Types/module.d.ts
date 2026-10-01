// Generated from ../../Tavryn/Types/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type InvoiceTerms = {
  externalInvoiceNumber: string,
  faceValue: damlTypes.Numeric,
  currency: string,
  issuedDate: damlTypes.Date,
  dueDate: damlTypes.Date,
}

export declare const InvoiceTerms:
  damlTypes.Serializable<InvoiceTerms>
