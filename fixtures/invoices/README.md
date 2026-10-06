# Sample invoices (synthetic)

These three invoices are **synthetic**. Every company, person, address, tax number and
bank detail in them is invented for this repository. They are not real invoices, were not
supplied by any customer, and must not be presented as customer data.

They exist so a reviewer can see what a supplier's invoice looks like before it becomes a
Tavryn draft, and which fields the supplier keys or corrects. Each layout is different on
purpose: a US manufacturing invoice on net-60 terms, an EU invoice with VAT and a credit
note line, and a services invoice with milestone billing.

| File | Layout | Tavryn draft |
|---|---|---|
| `SYN-001-harlow-fasteners.html` | US, net 60, line items, freight | `SYN-001.terms.json` |
| `SYN-002-voss-packaging.html` | EU, VAT 21%, credit note applied | `SYN-002.terms.json` |
| `SYN-003-meridian-logistics.html` | Nigeria, naira, milestone billing, retention held back | `SYN-003.terms.json` |

## From invoice to draft

A Tavryn draft needs five fields: the supplier's invoice number, the face value, the
currency, the issue date and the due date. The `.terms.json` files are exactly the body
of `POST /api/v1/invoices/drafts`. The `corrections` list in each records what a supplier
has to get right by hand, because the printed invoice does not state the financeable
amount directly:

- SYN-001: the due date is printed as "Net 60", so it is computed from the issue date.
- SYN-002: the financeable amount is the total after the credit note, including VAT.
- SYN-003: the retention is not payable until acceptance, so it is excluded.

Automatic extraction from PDFs is **not built**; it is on the production roadmap
(`docs/engineering/REMAINING.md`). Today the supplier enters these fields in the app.

Provenance: written for this repository on 2026-10-06. Synthetic, no source document.
