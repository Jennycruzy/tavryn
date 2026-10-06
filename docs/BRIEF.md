# Tavryn business brief

**Invoice finance for Nigerian suppliers: every invoice financed once, and lenders never
see each other's deals.**

## The problem

Nigerian small businesses that supply large companies wait months to be paid, and fewer
than one in twenty can get bank credit ([World Bank](https://www.worldbank.org/en/news/press-release/2025/12/22/world-bank-approves-500-million-to-expand-finance-for-small-businesses-in-nigeria)). Their unmet demand for credit
is about ₦13 trillion ([IFC](https://www.ifc.org/en/insights-reports/2022/market-bite-nigeria-innovation-offers-key-to-the-broader-msme-finance-market)). An invoice a large buyer has agreed to pay is strong
collateral, and banks already offer invoice discounting. But each bank sees only its own
deals, so it cannot tell whether the invoice is already financed elsewhere. It compensates
with guarantees, paperwork and redirected buyer payments ([example](https://www.stanbicibtcbank.com/nigeriabank/business/products-and-services/finance-your-business/business-loans/see-all-loans/invoice-discounting)), and lends to
few. When the same invoice is financed twice, the buyer pays once and a lender loses.

Nigeria's National Collateral Registry lets lenders register claims on a business's
receivables, but the IFC and World Bank found lenders still prefer land and buildings as
security and recommend wider use of the registry ([2023 snapshot](https://www.ifc.org/content/dam/ifc/doc/2024/nigerian-credit-infrastructure-reform-snapshot-of-progress-and-next-steps.pdf)). A notice
registry records that a claim exists; it does not let two lenders race for one invoice
and guarantee only one wins.

## Who it's for

Large Nigerian buyers (manufacturers, FMCG, telecoms, oil and gas services) and their SME
suppliers, plus the commercial banks, microfinance banks and fintech lenders that finance
invoices. The buyer starts it: approving invoices gets its suppliers cheaper money and
keeps its supply chain healthy while it pays on its normal terms.

## How it works

The buyer approves an invoice once. The supplier offers it privately to several lenders.
The first lender to pay wins, and the buyer repays that lender when the invoice is due.
Every other lender is told the invoice is no longer available, nothing more.

## Who pays

Lenders pay a fee per invoice financed, because double financing is their loss. Both buyer-side
managers we interviewed said the same, and a bank SME lending officer agreed: "Compared
with losing millions because an invoice was financed twice, the checking fee is nothing"
(`VALIDATION.md`). The buyer
gains healthier suppliers and more financing capacity across its supply chain.

## Why Canton Network

Canton lets several companies agree on one fact (*has this invoice been financed yet?*)
while each deal stays visible only to the companies in it. The network itself refuses a
second payment for the same invoice.

## Why not a shared database?

A shared database needs an operator who can see every lender's business, and no lender will
hand its client list to a competitor or a start-up. With Tavryn nobody sees the other
lenders' books, and the network's rules are set by its members together, not by one owner.

## Who else is here

Supply chain finance is arriving in Nigeria: CycleFlow, backed by C2FO and the IFC,
launched in 2026 to pay approved MSME suppliers early on verified invoices from anchor
buyers ([report](https://news.yrules.com/en/archives/12708)). That model runs through one platform's funding. Tavryn is the
neutral layer underneath: any number of lenders compete for the same invoice, and none of
them, nor Tavryn, sees the others' books.

## Limits

The demo settles in Canton Coin. A Nigerian pilot would settle in naira through the
lender's bank and record the payment reference on the ledger; that path already exists
(`accept` with a payment reference). Tavryn can only check lenders on the network; financing from outside it is invisible. Each
buyer approves an invoice number once through its own approval record. Both are stated
plainly to pilot customers.
