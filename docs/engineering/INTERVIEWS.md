# Interview request log

Five conversations are required by the build specification, all in Nigeria: two people
who run supplier payments at a large buyer, two SME suppliers to large companies, and one
invoice lender (a bank invoice-discounting desk, a microfinance bank or a fintech lender). Record only
real conversations here, with consent and date. Do not identify a person or company
without permission.

| Request | Profile | Contact route | Requested on | Response | Interview date |
|---|---|---|---|---|---|
| I1 | Buyer-side supplier payments: finance manager, large supermarket and distribution company | Owner's network | 2026-10-06 | Answered all five questions; consented to be quoted by role only | Recorded 2026-10-06 |
| I2 | Buyer-side supplier payments: accounts manager, large construction company | Owner's network | 2026-10-06 | Answered all five questions; consented to be quoted by role, company not named | Recorded 2026-10-06 |
| I3 | SME supplier: food and household items to supermarkets | Owner's network | 2026-10-06 | Answered all four supplier questions; consented to be quoted as "supermarket supplier" | Recorded 2026-10-06 |
| I4 | SME supplier: building materials to construction companies | Owner's network | 2026-10-06 | Answered all four supplier questions; consented to be quoted as "building-material supplier" | Recorded 2026-10-06 |
| I5 | Invoice financier: SME lending officer, Nigerian commercial bank | Owner's family (personal connection, disclosed) | 2026-10-06 | Answered all five questions in writing; consented to be quoted by role, no name or bank | Recorded 2026-10-06 |


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

## I2. Accounts manager, large construction company

Quoted by role only, with consent ("Yes, no problem. Just don't mention the company.").
Answers as given to the owner.

**How do you check that an invoice hasn't already been financed somewhere else?**
"We confirm that the contractor or supplier actually did the work and that the invoice is
still unpaid. Sometimes a bank or finance company will call us and ask, 'Is this invoice
genuine? Have you paid it?' We can answer that. But we cannot tell them whether that
supplier has already shown the same invoice to another lender."

**Has double financing or a duplicate invoice ever cost you anything?**
"We've had duplicate invoices before. Maybe somebody submits something, then another
person in their office sends it again. If nobody checks properly, you can pay twice. We
have controls for that. For financing, I have seen situations where payment had to be held
because there was confusion about who was supposed to receive the money."

**Would you share your deals in a common registry to prevent it?**
"Not full details. Construction pricing is sensitive. I don't want another contractor
knowing what we are paying somebody. But if you can just check whether an invoice has
already been used, without showing the whole contract, that is different."

**Would you pay per checked invoice? Who should pay?**
"I would expect the bank or finance company to pay. If they are about to give somebody
₦20 million based on one invoice, paying a small amount to check it makes sense."

**What we take from it**

- Lenders already verify invoices by phoning the buyer, one call at a time. The buyer can
  confirm the invoice is genuine and unpaid, but not whether another lender financed it.
  Tavryn's buyer approval replaces the phone call, and the funding slot answers the
  question the buyer cannot.
- A concrete cost: a payment held because it was unclear who should receive it. Tavryn's
  receipts record exactly one financier per invoice, so the buyer knows whom to repay.
- Same privacy condition as I1: no full details, but an "already used" check is
  acceptable.
- Same answer on pricing as I1: the lender pays, because it carries the risk.

## I5. SME lending officer, Nigerian commercial bank

Quoted by role only, with consent ("You can quote me by my role ... I just wouldn't want
my name or the bank's name mentioned."). Disclosure: the interviewee is a member of the
owner's family. Answers given in writing.

**How do you make sure another bank or lender hasn't already financed the same invoice?**
"To be very honest, there is no central place where we can check that in Nigeria. We do
our own due diligence. We verify the invoice with the company that is supposed to pay it,
check the purchase order and delivery documents, look at the customer's bank statements
and sometimes speak directly with the buyer. We can confirm that the invoice is genuine,
but knowing whether the customer has already taken that same invoice to another lender is
more difficult. Unless the other facility shows somewhere in their banking history or the
customer tells us, we may not know."

**Has it happened that two lenders were owed from the same invoice or buyer payment?**
"Yes, it happens. I have seen situations where a business collected funding from one
lender and still approached another lender using the same expected payment. Sometimes it
is not exactly the same invoice number. They may use the same contract or the same payment
they are expecting from a big customer to support two different facilities. The problem
normally comes out when the buyer finally pays and more than one lender is expecting that
same money. By then, everybody starts chasing the borrower."

**What do you ask for to protect yourself? Does that make you turn down good businesses?**
"That is why lenders ask for plenty of protection. We may ask the buyer to pay directly
into an account with us. We may ask the business to domicile the payment with the bank.
Depending on the amount and the customer, we can also ask for a personal guarantee,
company guarantee or some form of collateral. We also check their account history to
understand how payments normally come in. And yes, it can make us reject businesses that
are actually good businesses. Sometimes the invoice and the buyer are solid, but because
we cannot be completely sure what the borrower has done somewhere else, the risk becomes
too high. A small business may have a genuine ₦20 million invoice from a strong company
but no property to give as collateral. You can still end up saying no because you don't
have enough visibility."

**Would you use an instant "already financed / free" check, and pay per invoice?**
"Yes, definitely. If I can enter or check an invoice and get a reliable answer that this
particular invoice has already been pledged somewhere, that is useful. The important thing
is that I don't need to see which bank financed it, how much they charged or their
customer's private information. I just need to know whether somebody already has a claim
on that invoice. If the system is reliable, I don't see a problem paying a small fee for
each check. Compared with losing millions because an invoice was financed twice, the
checking fee is nothing. For me, the lender giving the money should pay for the check
because we are the ones using it to make the credit decision."

**What we take from it**

- No central check exists in Nigeria; lenders rely on documents, statements and phone
  calls, which confirm an invoice is genuine but not that it is unpledged.
- Double financing happens, and surfaces only when the buyer pays and several lenders
  expect the same money.
- The missing visibility turns away good businesses: a genuine ₦20 million invoice from a
  strong buyer can be refused for lack of property collateral. This is the credit gap
  Tavryn targets.
- Pricing confirmed from the lender side: a small fee per check, paid by the lender.
- The lender wants only "somebody already has a claim", not who or at what price; this is
  what Tavryn's losing lenders see.
- **A gap this exposes in Tavryn.** Borrowers sometimes reuse the same contract or expected
  payment under different invoice numbers. Tavryn's single-approval check is per
  buyer-approved invoice; the buyer's approval step limits this, since the buyer approves
  what it actually owes, but financing against a contract or purchase order before any
  invoice exists is not covered yet. Recorded as roadmap: extend the one-claim rule to
  purchase orders and contracts.

## I3. Supermarket supplier (food and household items)

Quoted by role only, with consent ("You can just say supermarket supplier.").

**How long do your big customers usually take to pay you after you deliver?**
"Usually around 30 days, but sometimes it can enter 45 days or even more. You have already
supplied everything, but you still have to wait for their payment cycle."

**Have you ever tried to get a loan or advance from a bank using an invoice?**
"Yes, I tried once. The process was too much. They asked for plenty documents, bank
statements and other things. At the end, I just left it because the money was taking too
long to come."

**If banks could compete to pay you early on an invoice your customer has approved, would
you use it?**
"Yes, definitely. If my customer has already confirmed that they will pay me, and I can get
most of the money now instead of waiting one month or more, I will use it. It will help me
restock and continue business."

## I4. Building-material supplier

Quoted by role only, with consent ("Just say building-material supplier.").

**How long do your big customers usually take to pay you after you deliver?**
"It depends on the company. Some will tell you 30 days, but in reality you can wait 60
days. Sometimes you have to keep calling accounts before they release your money."

**Have you ever tried to get a loan or advance from a bank using an invoice?**
"I have asked my bank before. They said it was possible, but they wanted collateral and
plenty paperwork. For me, if I already have to bring property before you give me money,
then what is the point of the invoice?"

**If banks could compete to pay you early on an invoice your customer has approved, would
you use it?**
"Yes, as long as the charges are reasonable. Cash flow is the main problem. You can have
₦15 million that customers are owing you and still be struggling to buy materials for the
next job. If different banks can give me their offers and I choose the best one, I will
use it."

**What we take from I3 and I4**

- Payment terms stretch: 30 days stated, 45 to 60 days in practice, with follow-up calls.
- Both tried invoice finance and gave up: too many documents and too slow (I3), collateral
  demanded on top of the invoice (I4). This matches the lender's account (I5) of
  protection that exists because lenders cannot see each other's deals.
- Both would use lenders competing on a buyer-confirmed invoice; I4 adds the condition that
  charges are reasonable and wants to choose the best offer, which is Tavryn's private
  offer flow.

## Summary of all five

Buyers (I1, I2) cannot see whether an invoice is financed elsewhere and refuse to expose
their prices, but accept an "already used" check paid for by lenders. The lender (I5)
confirms there is no central check in Nigeria, that double financing happens, that good
businesses are refused for lack of visibility, and that a per-check fee is worth paying.
Suppliers (I3, I4) wait 30 to 60 days, have given up on bank invoice finance because of
paperwork and collateral, and would use competing offers on an approved invoice.
