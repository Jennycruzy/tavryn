# Every invoice can be pledged once. Prove it without revealing it.

## Problem

Suppliers wait 30–120 days for approved invoices to be paid. Invoice financing provides
cash sooner, but the same receivable can be pledged to multiple lenders because each
lender sees only its own deal. The buyer then pays once while several financiers expect
the cash.

## ICP

Large buyers with supplier-finance programmes, plus the financiers funding those
programmes. The buyer starts the process through reverse factoring: it confirms approved
supplier invoices so suppliers can receive cheaper funding and the buyer can negotiate
longer payment terms.

## Use case and payer

The buyer approves an invoice; the supplier offers it privately to multiple financiers;
one financier funds it; the buyer repays that financier at maturity. Financiers pay per
invoice because they bear the cost of double financing; the buyer gains supply-chain
health and financing capacity.

## Why Canton

Canton lets the ledger enforce a one-time consuming choice while contract stakeholders
define who can see the deal. The approved invoice is consumed by the first successful
funding, while rival financiers receive only their own offer and a failure when the
invoice is no longer available.

## Why not a shared database?

A shared database needs an operator who sees every financier's book, and no financier
will hand its client list to a rival or a startup. Tavryn gives them the guarantee
without anyone seeing the books, and the network's rules are governed by the financiers
themselves.

## Limit

Duplicate creation relies on the buyer's single approval service checking external
invoice numbers, and financing outside the network is invisible. These are explicit
pilot assumptions, not hidden claims.
