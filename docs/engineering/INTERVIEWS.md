# Interview request log

Five conversations are required by the build specification, all in Nigeria: two people
who run supplier payments at a large buyer, two SME suppliers to large companies, and one
invoice lender (a bank invoice-discounting desk, a microfinance bank or a fintech lender). Record only
real conversations here, with consent and date. Do not identify a person or company
without permission.

| Request | Profile | Contact route | Requested on | Response | Interview date |
|---|---|---|---|---|---|
| I1 | Buyer-side supplier payments: finance manager, large supermarket and distribution company | Owner's network | 2026-10-06 | Answered all five questions; consented to be quoted by role only | Recorded 2026-10-06 |
| I2 | Buyer-side supplier payments | Pending user input | Pending | Pending | Pending |
| I3 | SME supplier | Pending user input | Pending | Pending | Pending |
| I4 | SME supplier | Pending user input | Pending | Pending | Pending |
| I5 | Invoice financier | Pending user input | Pending | Pending | Pending |


## I1. Finance manager, large retail company

Quoted by role only, with consent ("You can say finance manager at a large retail
company"). Answers as given to the owner.

**How do you check that an invoice hasn't already been financed somewhere else?**
"Honestly, we don't really have a way to know that. What we check is whether the supplier
actually supplied us, whether the amount is correct, and whether we have already paid that
invoice. If the supplier has taken that same invoice to a bank or another finance company,
we may not know unless somebody contacts us."

**Has double financing or a duplicate invoice ever cost you anything?**
"We have seen suppliers send the same invoice twice before, especially when they are
following up for payment. Sometimes it is a mistake, sometimes you can't really tell. Our
accounts team normally catches it. The bigger problem would be if two different finance
companies are claiming the same payment. That can become a serious issue."

**Would you share your deals in a common registry to prevent it?**
"I will not agree to put our supplier information and prices somewhere everybody can see.
That one is sensitive. But if the system only tells me that this particular invoice has
already been used somewhere, without exposing all the details, then I can consider it."

**Would you pay per checked invoice? Who should pay?**
"For normal invoices, no. We process too many. But if a finance company wants to check
before giving a supplier money, I think they should pay for the check. They are the ones
taking the risk."

**What we take from it**

- The gap is real on the buyer side: the buyer checks delivery, amount and its own
  payments, but cannot see whether an invoice was financed elsewhere.
- The design matches the condition the buyer set: a shared registry is refused, a check
  that reveals only "already used" would be considered. That is what Tavryn's
  availability signal does.
- The business model is corrected: buyers will not pay per invoice; lenders should,
  because they carry the risk. Tavryn's pricing is lender-paid.
- Not yet tested: whether lenders will pay, and how much. That needs I5.
