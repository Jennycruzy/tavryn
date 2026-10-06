const ROLE_CONTEXT = {
  supplier: "Create invoices and offer them privately to the lenders the buyer approved.",
  buyer: "Approve each supplier invoice once, then repay the lender who financed it.",
  lender: "See the offers made to you and finance the ones you want. Other lenders' offers never appear here.",
  auditor: "A read-only view of every payment and repayment, with amounts.",
  operator: "The organisations that run the network agree on its rules together. No single one can change them.",
};

const state = {
  // The signed-in company, when the server runs with company accounts.
  account: null,
  documents: new Set(),
  upload: null,
  role: roleFromHash(),
  contracts: {},
  network: null,
  lastResult: null,
  currentStep: "draft",
  loading: false,
  showAllActivity: false,
};

const $ = (id) => document.getElementById(id);

class ApiError extends Error {
  constructor(status, payload) {
    super(friendlyError(status, payload));
    this.status = status;
    this.code = typeof payload?.code === "string" ? payload.code : "REQUEST_FAILED";
    this.reference = payload?.submissionReference;
  }
}

async function api(path, options = {}, authRetry = false) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
  } catch {
    throw new ApiError(0, { code: "SERVICE_UNREACHABLE" });
  }
  const text = await response.text();
  let payload = {};
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = {}; }
  }
  if (response.status === 401 && payload?.code === "ACCOUNT_REQUIRED") {
    window.location.replace("/login");
  }
  if (response.status === 401 && payload?.code === "DEMO_AUTH_REQUIRED" && !authRetry) {
    const passphrase = window.prompt("Enter the demo passphrase");
    if (passphrase) {
      const session = await fetch("/api/v1/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (session.ok) return api(path, options, true);
    }
  }
  if (!response.ok) throw new ApiError(response.status, payload);
  return payload;
}

function friendlyError(status, payload) {
  const messages = {
    INVOICE_UNAVAILABLE: "This invoice has already been financed by another lender.",
    DUPLICATE_INVOICE: "The buyer has already approved an invoice with this number.",
    FINANCIER_NOT_ELIGIBLE: "This lender isn't approved for this invoice.",
    RATE_ABOVE_NETWORK_MAX: "That advance is above the network's maximum.",
    INVALID_ADVANCE: "The advance must be more than zero and no more than the invoice amount.",
    PROPOSAL_EXPIRED: "This proposal has expired. Nothing changed.",
    PROPOSAL_STALE: "The rules changed since this was proposed. Propose it again.",
    GOVERNANCE_ACTION_INVALID: "That change doesn't apply to the current rules.",
    NETWORK_NOT_BOOTSTRAPPED: "The network hasn't been set up yet.",
    BUYER_NOT_ONBOARDED: "The buyer hasn't joined the network yet.",
    REPAYMENT_NOT_AVAILABLE: "This invoice isn't waiting for repayment. If a repayment is already in progress it will finish on its own, so don't pay again.",
    SETTLEMENT_NOT_CONFIGURED: "Payments aren't set up for this account.",
    SETTLEMENT_PENDING: "The payment is still on its way. The invoice stays reserved until it arrives.",
    SETTLEMENT_LEDGER_FINALIZATION_FAILED: "The payment went through. The record will be completed automatically in a moment.",
    SETTLEMENT_LEDGER_REPAYMENT_FAILED: "The repayment went through. The record will be completed automatically in a moment. Don't pay again.",
    SETTLEMENT_INSTRUMENT_MISMATCH: "This invoice isn't in the network's payment currency.",
    SETTLEMENT_REJECTED: "The wallet declined the payment, so nothing was paid and the invoice is open again.",
    SERVICE_UNREACHABLE: "Can't reach Tavryn right now. Check your connection and try again.",
    LEDGER_REQUEST_FAILED: "The network couldn't complete this just now. Please try again.",
    DEMO_AUTH_REQUIRED: "Please sign in to use the demo.",
    DEMO_AUTH_FAILED: "That passphrase isn't right.",
    WRITE_RATE_LIMITED: "Too many changes at once. Please wait a minute and try again.",
    FORBIDDEN: "Your company can't do that.",
    INVALID_FEE: "The fee can't be negative, and the advance plus the fee can't be more than the invoice amount.",
    BALANCE_NOT_AVAILABLE: "This balance has already been paid.",
    ACCOUNT_REQUIRED: "Please sign in again.",
    DUPLICATE_DOCUMENT: payload?.error || "This exact file was already submitted for another invoice.",
    INVOICE_HAS_DOCUMENT: "This invoice number already has a different file attached.",
    DOCUMENT_TOO_LARGE: "The file must be under 1 MB.",
    DOCUMENT_TYPE_UNSUPPORTED: "Upload a PDF, PNG or JPEG file.",
    DOCUMENT_NOT_FOUND: "That file isn't available. Upload it again.",
  };
  if (payload?.code === "GOVERNANCE_THRESHOLD_NOT_MET") {
    const have = payload.approvals ?? "not enough";
    const need = payload.threshold ?? state.network?.threshold;
    return `Not enough approvals yet (${have} of ${need}). Nothing changed.`;
  }
  if (payload?.code && messages[payload.code]) return messages[payload.code];
  if (status === 0) return messages.SERVICE_UNREACHABLE;
  if (status === 409) return "Something changed in the meantime. Refresh and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "Please check the details and try again.";
}

// ------------------------------------------------------------------ roles and network

function financierRoles() {
  return (state.network?.financierRoles || []).map((entry) => entry.role);
}

function admittedFinancierRoles() {
  return (state.network?.rules?.financiers || []).map((entry) => entry.role).filter(Boolean);
}

function roles() {
  return ["supplier", "buyer", ...financierRoles(), "auditor", "operator"];
}

function isFinancier(role) {
  return String(role).startsWith("financier");
}

function roleLabel(role) {
  if (state.account && role === state.account.role && role !== "operator") return state.account.name;
  if (isFinancier(role)) return `Lender ${role.slice("financier".length)}`;
  return { supplier: "Supplier", buyer: "Buyer", auditor: "Auditor", operator: "Network admins" }[role] || role;
}

function roleForParty(party) {
  const financier = (state.network?.financierRoles || []).find((entry) => entry.party === party);
  return financier ? financier.role : "";
}

function lenderName(party) {
  const role = roleForParty(party);
  return role ? roleLabel(role) : "a lender";
}

function currency() {
  return state.network?.settlementCurrency || "CC";
}

async function loadNetwork() {
  try {
    state.network = await api("/api/v1/network");
    setConnection(true);
  } catch (error) {
    setConnection(false);
    throw error;
  }
}

function setConnection(ok) {
  $("connection").classList.toggle("ok", ok);
  $("connection").classList.toggle("down", !ok);
  $("connectionText").textContent = ok ? "Connected to Canton Network" : "Not connected";
}

// ------------------------------------------------------------------ formatting

function templateName(contract) {
  return String(contract?.templateId || "").split(":").pop() || "Contract";
}

function contractsFor(role, template) {
  return (state.contracts[role] || []).filter((contract) => templateName(contract) === template);
}

function contractId(contract) {
  return contract?.contractId || "";
}

function argument(contract) {
  return contract?.createArgument && typeof contract.createArgument === "object"
    ? contract.createArgument
    : {};
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function amount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function money(value, unit = currency()) {
  return `${amount(value)} ${unit}`;
}

function percent(rate) {
  const number = Number(rate);
  return Number.isFinite(number) ? `${Math.round(number * 1000) / 10}%` : "-";
}

function niceDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function isoDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

// Invoice details are only in the supplier's and buyer's views; look them up by the
// invoice's private reference so other records can be labelled by invoice number.
function termsFor(commitment) {
  for (const contract of state.contracts[state.role] || []) {
    const arg = argument(contract);
    if (arg.invoiceCommitment === commitment && arg.terms) return arg.terms;
  }
  return undefined;
}

function invoiceLabel(terms) {
  return terms ? `Invoice ${terms.externalInvoiceNumber}` : "Invoice";
}

function optionList(items, placeholder, describe) {
  if (!items.length) return `<option value="">Nothing here yet</option>`;
  return `<option value="">${escapeHtml(placeholder)}</option>${items.map((item) =>
    `<option value="${escapeHtml(contractId(item))}">${escapeHtml(describe(item))}</option>`).join("")}`;
}

function lenderOptions(list) {
  if (!list.length) return '<option value="">No lenders available</option>';
  return `<option value="">Choose a lender</option>${list.map((role) =>
    `<option value="${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</option>`).join("")}`;
}

// ------------------------------------------------------------------ loading

async function loadRole(role) {
  const result = await api(`/api/v1/roles/${encodeURIComponent(role)}/contracts`);
  const contracts = Array.isArray(result.contracts) ? result.contracts : [];
  contracts.sort((a, b) => Number(b.offset || 0) - Number(a.offset || 0));
  state.contracts[role] = contracts;
  render();
}

async function loadDocuments() {
  try {
    const result = await api("/api/v1/documents");
    state.documents = new Set(result.invoices || []);
  } catch {
    state.documents = new Set();
  }
}

function documentLink(invoiceNumber) {
  return state.documents.has(invoiceNumber)
    ? `<a class="link-button" href="/api/v1/documents/${encodeURIComponent(invoiceNumber)}" target="_blank" rel="noopener">View invoice file ${escapeHtml(invoiceNumber)}</a>`
    : "";
}

async function loadSelectedRole() {
  setLoading(true);
  try {
    await loadNetwork();
    renderRoleButtons();
    await loadDocuments();
    await loadRole(state.role);
  } catch (error) {
    setResult({ ok: false, title: "Couldn't load this view", message: error.message });
  } finally {
    setLoading(false);
  }
}

function setLoading(value) {
  state.loading = value;
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = value || button.dataset.locked === "true";
  });
  if (!value) render();
}

function setResult(result) {
  state.lastResult = result;
  renderResult();
}

// ------------------------------------------------------------------ rendering

const ICONS = {
  supplier: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  buyer: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
  lender: '<path d="M3 10h18L12 4zM5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
  auditor: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  operator: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
};

function roleIcon(role) {
  const key = isFinancier(role) ? "lender" : role;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[key] || ""}</svg>`;
}

function renderRoleButtons() {
  if (state.account) {
    const role = state.account.role;
    const kind = role === "operator" ? `Network admin ${state.account.operatorIndex}`
      : isFinancier(role) ? "Lender" : { supplier: "Supplier", buyer: "Buyer", auditor: "Auditor" }[role] || role;
    $("roleButtons").classList.add("account");
    $("roleButtons").innerHTML = `<p class="side-group">Your company</p>
      <button class="role-button active" type="button" aria-selected="true">${roleIcon(role)}${escapeHtml(state.account.name)}</button>
      <p class="hint" style="padding: 4px 10px">${escapeHtml(kind)} · ${escapeHtml(state.account.email)}</p>
      <button class="link-button" type="button" id="signOut" style="padding: 4px 10px">Sign out</button>`;
    return;
  }
  const button = (role) =>
    `<button class="role-button" data-role="${escapeHtml(role)}" type="button">${roleIcon(role)}${escapeHtml(roleLabel(role))}</button>`;
  $("roleButtons").innerHTML = [
    `<p class="side-group">Companies</p>`,
    button("supplier"),
    button("buyer"),
    `<p class="side-group">Lenders</p>`,
    ...financierRoles().map(button),
    `<p class="side-group">Oversight</p>`,
    button("auditor"),
    button("operator"),
  ].join("");
}

function roleFromHash() {
  const role = decodeURIComponent(window.location.hash.slice(1));
  return role && (["supplier", "buyer", "auditor", "operator"].includes(role) || isFinancier(role)) ? role : "supplier";
}

function render() {
  document.querySelectorAll(".role-button[data-role]").forEach((button) => {
    const active = button.dataset.role === state.role;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("roleContext").textContent = ROLE_CONTEXT[isFinancier(state.role) ? "lender" : state.role];
  $("pageTitle").textContent = state.account?.role === "operator" ? `Network admin ${state.account.operatorIndex}` : roleLabel(state.role);
  $("pageKicker").textContent = state.account ? "Signed in as" : "Demo workspace · viewing as";
  document.title = `${roleLabel(state.role)} · Tavryn`;
  renderNetwork();
  renderActionPanel();
  renderActivity();
  renderPrivacy();
  renderResult();
  renderSteps();
}

function renderSteps() {
  $("steps").hidden = state.role === "operator";
  const order = ["draft", "approved", "offered", "funded", "repaid"];
  const target = order.indexOf(state.account ? stepFromContracts() : state.currentStep);
  document.querySelectorAll("#steps li").forEach((element) => {
    const index = order.indexOf(element.dataset.step);
    element.classList.toggle("complete", index < target);
    element.classList.toggle("current", index === target);
  });
}

// With company accounts each sign-in starts fresh, so progress follows the company's
// most recent record instead of the last click.
function stepFromContracts() {
  const steps = {
    InvoiceDraft: "draft", ApprovedInvoice: "approved", FinancingOffer: "offered",
    PendingFunding: "funded", FinancedInvoice: "funded", FundingReceipt: "funded",
    PendingRepayment: "repaid", RepaymentReceipt: "repaid",
  };
  for (const contract of state.contracts[state.role] || []) {
    const step = steps[templateName(contract)];
    if (step) return step;
  }
  return "draft";
}

function renderNetwork() {
  const network = state.network;
  if (!network?.rules) {
    ["operatorsState", "rulesState", "financiersState", "registryState"].forEach((id) => { $(id).textContent = "-"; });
    return;
  }
  $("operatorsState").textContent = `${network.threshold} of ${network.operators.length} admins`;
  $("rulesState").textContent = percent(network.rules.maxAdvanceRate);
  const letters = network.rules.financiers.map((entry) => (entry.role || "").slice("financier".length)).filter(Boolean);
  $("financiersState").textContent = letters.length ? `Lender ${letters.join(", ")}` : "None";
  $("registryState").textContent = network.registry ? `${network.registry.approvedCount} to date` : "Not set up";
}

function renderActionPanel() {
  $("actionTitle").textContent = isFinancier(state.role)
    ? "Offers for you"
    : { supplier: "Invoices", buyer: "Approvals and repayments", auditor: "Records", operator: "Network rules" }[state.role];
  $("actionBody").innerHTML = actionMarkup();
  updatePaymentFields();
}

function actionMarkup() {
  if (state.role === "supplier") return supplierActions();
  if (state.role === "buyer") return buyerActions();
  if (state.role === "operator") return adminActions();
  if (isFinancier(state.role)) return lenderActions();
  return `<div class="notice"><strong>Read-only view</strong>The auditor sees every payment and repayment below, with amounts and references, and cannot change anything.</div>`;
}

function supplierActions() {
  const approved = contractsFor("supplier", "ApprovedInvoice");
  const eligible = (contract) => (argument(contract).eligibleFinanciers || []).map(roleForParty).filter(Boolean);
  const lenders = [...new Set(approved.flatMap(eligible))];
  const approvedLabel = (contract) => {
    const terms = termsFor(argument(contract).invoiceCommitment);
    return terms ? `${terms.externalInvoiceNumber} · ${money(terms.faceValue, terms.currency)}` : "Approved invoice";
  };
  return `
    <form class="action-form" data-action="create-draft">
      <p class="form-title">New invoice</p>
      <div class="form-grid">
        <div class="field wide"><label for="invoiceFile">Invoice file (PDF or photo, optional)</label><input id="invoiceFile" type="file" accept="application/pdf,image/png,image/jpeg" /><span class="hint" id="uploadStatus">We read the number, amount and dates from a PDF where we can. Check them before you create the invoice.</span></div>
        <div class="field"><label for="externalInvoiceNumber">Invoice number</label><input id="externalInvoiceNumber" name="externalInvoiceNumber" value="INV-${Date.now().toString().slice(-6)}" required /></div>
        <div class="field"><label for="invoiceCurrency">Currency</label><select id="invoiceCurrency" name="currency">
          <option value="NGN">NGN · bank transfer</option>
          <option value="${escapeHtml(currency())}">${escapeHtml(currency())} · Canton Coin</option>
        </select></div>
        <div class="field"><label for="faceValue">Amount</label><input id="faceValue" name="faceValue" inputmode="decimal" placeholder="e.g. 4800000" required /></div>
        <div class="field"><label for="issuedDate">Issue date</label><input id="issuedDate" name="issuedDate" type="date" value="${isoDate(0)}" required /></div>
        <div class="field"><label for="dueDate">Due date</label><input id="dueDate" name="dueDate" type="date" value="${isoDate(60)}" required /></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Create invoice</button><span class="hint">Only you and the buyer can see it.</span></div>
    </form>
    ${approved.length ? `
    <form class="action-form" data-action="create-offer">
      <p class="form-title">Offer an approved invoice to a lender</p>
      <div class="form-grid">
        <div class="field wide"><label for="approvedCid">Invoice</label><select id="approvedCid" name="approvedCid" required>${optionList(approved, "Choose an invoice", approvedLabel)}</select></div>
        <div class="field"><label for="offerFinancier">Lender</label><select id="offerFinancier" name="financierRole" required>${lenderOptions(lenders)}</select></div>
        <div class="field"><label for="offerAdvance">Amount to advance</label><input id="offerAdvance" name="advance" inputmode="decimal" placeholder="0.90" required /><span class="hint" id="advanceHint">Up to ${percent(state.network?.rules?.maxAdvanceRate)} of the invoice.</span></div>
        <div class="field"><label for="offerFee">Lender's fee (optional)</label><input id="offerFee" name="fee" inputmode="decimal" placeholder="e.g. 405000" /><span class="hint" id="feeHint">Agreed now. The rest comes back to you when the buyer pays.</span></div>
      </div>
      <div class="form-actions"><button class="button button-secondary" type="submit">Send private offer</button><span class="hint">Only this lender sees the offer.</span></div>
    </form>` : ""}
  `;
}

function buyerActions() {
  if (!state.network?.rules?.buyerOnboarded) {
    return `<div class="notice"><strong>Not set up yet</strong>The network admins haven't added this buyer yet.</div>`;
  }
  const drafts = contractsFor("buyer", "InvoiceDraft");
  const financed = contractsFor("buyer", "FinancedInvoice");
  const lenders = admittedFinancierRoles();
  const draftLabel = (contract) => {
    const terms = argument(contract).terms;
    return `${terms.externalInvoiceNumber} · ${money(terms.faceValue, terms.currency)} · due ${niceDate(terms.dueDate)}`;
  };
  const financedLabel = (contract) => {
    const arg = argument(contract);
    return `${arg.terms.externalInvoiceNumber} · ${money(arg.terms.faceValue, arg.terms.currency)} to ${lenderName(arg.financier)}`;
  };
  return `
    <form class="action-form" data-action="approve">
      <p class="form-title">Approve an invoice</p>
      <div class="form-grid">
        <div class="field wide"><label for="draftCid">Invoice</label><select id="draftCid" name="draftCid" required>${optionList(drafts, "Choose an invoice to approve", draftLabel)}</select><span id="draftFile"></span></div>
        <div class="field wide"><span class="label">Lenders who may finance it</span><div class="checks">${lenders.map((role) =>
          `<label><input type="checkbox" name="eligible" value="${escapeHtml(role)}" ${role === "financierC" ? "" : "checked"} /> ${escapeHtml(roleLabel(role))}</label>`).join("")}</div></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Approve invoice</button><span class="hint">Each invoice number can only be approved once.</span></div>
    </form>
    ${financed.length ? `
    <form class="action-form" data-action="repay">
      <p class="form-title">Repay a lender</p>
      <div class="form-grid">
        <div class="field wide"><label for="financedCid">Invoice</label><select id="financedCid" name="financedCid" required>${optionList(financed, "Choose an invoice", financedLabel)}</select></div>
        <div class="field"><label for="repaymentDate">Payment date</label><input id="repaymentDate" name="repaymentDate" type="date" value="${isoDate(0)}" required /></div>
        <div class="field" id="repayReferenceField" hidden><label for="repayReference">Bank transfer reference</label><input id="repayReference" name="paymentReference" placeholder="e.g. NIP reference" /></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Repay</button><span class="hint">Paying early is fine. A retry never pays twice.</span></div>
    </form>` : ""}
  `;
}

function lenderActions() {
  const offers = contractsFor(state.role, "FinancingOffer");
  const balances = contractsFor(state.role, "BalanceDue");
  const balanceLabel = (contract) => {
    const arg = argument(contract);
    return `${money(arg.balance, arg.currency)} to the supplier · collected ${money(arg.collected, arg.currency)}, advance ${money(arg.advance, arg.currency)}, fee ${money(arg.fee, arg.currency)}`;
  };
  const closed = contractsFor(state.role, "OfferClosed");
  const offerLabel = (contract) => {
    const arg = argument(contract);
    const fee = arg.fee !== null && arg.fee !== undefined ? ` · fee ${money(arg.fee, arg.terms.currency)}` : "";
    return `${arg.terms.externalInvoiceNumber} · advance ${money(arg.advance, arg.terms.currency)} (${percent(arg.advanceRate)})${fee} · due ${niceDate(arg.terms.dueDate)}`;
  };
  return `
    ${offers.length ? `
    <form class="action-form" data-action="fund">
      <div class="form-grid"><div class="field wide"><label for="offerCid">Offer</label><select id="offerCid" name="offerCid" required>${optionList(offers, "Choose an offer", offerLabel)}</select><span id="offerFile"></span></div>
        <div class="field wide" id="fundReferenceField" hidden><label for="fundReference">Bank transfer reference</label><input id="fundReference" name="paymentReference" placeholder="The reference of your transfer to the supplier" /><span class="hint">Naira moves by bank transfer. Tavryn records your reference and locks the invoice to you.</span></div></div>
      <div class="form-actions"><button class="button button-primary" type="submit">Finance this invoice</button><span class="hint">You pay the supplier now and the buyer repays you by the due date.</span></div>
    </form>` : `<div class="notice"><strong>No open offers</strong>Offers made to you will appear here.</div>`}
    ${balances.length ? `
    <form class="action-form" data-action="pay-balance">
      <p class="form-title">Pay the supplier's balance</p>
      <div class="form-grid">
        <div class="field wide"><label for="balanceCid">Balance due</label><select id="balanceCid" name="balanceCid" required>${optionList(balances, "Choose a balance", balanceLabel)}</select></div>
        <div class="field wide" id="balanceReferenceField" hidden><label for="balanceReference">Bank transfer reference</label><input id="balanceReference" name="paymentReference" placeholder="The reference of your transfer to the supplier" /></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Pay balance</button><span class="hint">The buyer paid you the full invoice. This returns the rest, less your agreed fee.</span></div>
    </form>` : ""}
    ${closed.length ? `<div class="notice"><strong>${closed.length === 1 ? "1 offer is" : `${closed.length} offers are`} no longer available</strong>Another lender financed ${closed.length === 1 ? "that invoice" : "those invoices"} first. You aren't told who, or at what price.</div>` : ""}
  `;
}

function adminActions() {
  const network = state.network;
  if (!network?.bootstrapped) {
    return `<div class="notice"><strong>Not set up yet</strong>All network admins must sign before the network has rules.</div>`;
  }
  const proposals = network.proposals.length
    ? network.proposals.map((proposal) => {
      const buttons = network.operators.filter((operator) => !state.account || String(operator.index) === String(state.account.operatorIndex)).map((operator) => {
        const voted = proposal.votes.includes(operator.index);
        return `<button class="button button-secondary" type="button" data-governance="vote" data-proposal="${escapeHtml(proposal.contractId)}" data-operator="${operator.index}" ${voted ? 'data-locked="true" disabled' : ""}>${voted ? `Admin ${operator.index} approved` : `Approve as Admin ${operator.index}`}</button>`;
      }).join("");
      return `<div class="proposal">
        <div class="item-title">${escapeHtml(describeAction(proposal.action))}</div>
        ${proposal.stale ? "" : `<div class="votes">${Array.from({ length: proposal.threshold }, (_, index) => `<span class="${index < proposal.votes.length ? "on" : ""}"></span>`).join("")}</div>`}
        <div class="item-detail">${proposal.stale
          ? "Out of date: the rules changed after this was proposed. Propose it again if it's still wanted."
          : `${proposal.votes.length} of ${proposal.threshold} approvals`}</div>
        ${proposal.stale ? "" : `<div class="proposal-actions">${buttons}<button class="button button-primary" type="button" data-governance="execute" data-proposal="${escapeHtml(proposal.contractId)}">Apply change</button></div>`}
      </div>`;
    }).join("")
    : `<p class="empty">No proposed changes.</p>`;
  return `
    <form class="action-form" data-action="propose">
      <p class="form-title">Propose a change</p>
      <div class="form-grid">
        <div class="field"><label for="proposalType">Change</label><select id="proposalType" name="type" required>
          <option value="AdmitFinancier">Add a lender</option>
          <option value="RemoveFinancier">Remove a lender</option>
          <option value="SetMaxAdvanceRate">Change the maximum advance</option>
        </select></div>
        <div class="field" data-for="lender"><label for="proposalFinancier">Lender</label><select id="proposalFinancier" name="financierRole">${lenderOptions(financierRoles())}</select></div>
        <div class="field" data-for="rate" hidden><label for="proposalRate">Maximum advance (%)</label><input id="proposalRate" name="rate" inputmode="decimal" placeholder="90" /></div>
        <div class="field" ${state.account ? "hidden" : ""}><label for="proposalOperator">Proposed by</label><select id="proposalOperator" name="operatorIndex">${network.operators.filter((operator) => !state.account || String(operator.index) === String(state.account.operatorIndex)).map((operator) => `<option value="${operator.index}">Admin ${operator.index}</option>`).join("")}</select></div>
      </div>
      <div class="form-actions"><button class="button button-secondary" type="submit">Propose</button><span class="hint">${network.threshold} of ${network.operators.length} admins must approve before it applies.</span></div>
    </form>
    <div class="action-form">
      <p class="form-title">Proposed changes</p>
      ${proposals}
    </div>
  `;
}

function describeAction(action) {
  if (action.type === "AdmitFinancier") return `Add ${roleLabel(action.financierRole || "a lender")}`;
  if (action.type === "RemoveFinancier") return `Remove ${roleLabel(action.financierRole || "a lender")}`;
  if (action.type === "SetMaxAdvanceRate") return `Set the maximum advance to ${percent(action.rate)}`;
  if (action.type === "OnboardBuyer") return "Add the buyer";
  return action.type;
}

// One plain-language line per record. Internal bookkeeping records are not shown.
function activityItem(contract) {
  const arg = argument(contract);
  const terms = arg.terms || termsFor(arg.invoiceCommitment);
  const lender = isFinancier(state.role) ? "You" : lenderName(arg.financier);
  // Off-network payments are in the invoice's own currency, when this view knows it.
  const unit = (instrument) => (instrument === "OFF_LEDGER" ? (terms?.currency ?? "by bank transfer") : instrument);
  switch (templateName(contract)) {
    case "InvoiceDraft":
      return [`${invoiceLabel(arg.terms)} · ${money(arg.terms.faceValue, arg.terms.currency)}`, `Due ${niceDate(arg.terms.dueDate)}`, "Waiting for approval", "wait"];
    case "ApprovedInvoice":
      return [terms ? `${invoiceLabel(terms)} · ${money(terms.faceValue, terms.currency)}` : "An approved invoice",
        isFinancier(state.role) ? "You may be offered this invoice" : "Approved by the buyer", "Open for financing", "good"];
    case "FinancingOffer":
      return [`Offer · ${invoiceLabel(arg.terms)}`,
        `${money(arg.advance, arg.terms.currency)} advance (${percent(arg.advanceRate)}) · ${isFinancier(state.role) ? "sent to you" : `to ${lenderName(arg.financier)}`}`, "Offered", "wait"];
    case "OfferClosed":
      return isFinancier(state.role)
        ? ["An offer is no longer available", "Another lender financed this invoice first.", "Closed", "closed"]
        : null;
    case "PendingFunding":
      return [`Payment on its way · ${invoiceLabel(arg.terms)}`, `${money(arg.settlementAmount, arg.instrument)} from ${lenderName(arg.financier)}`, "In progress", "wait"];
    case "FinancedInvoice":
      return [`${invoiceLabel(arg.terms)} · financed`, `${lender} advanced ${money(arg.advance, arg.terms.currency)}${arg.fee !== null && arg.fee !== undefined ? ` · fee ${money(arg.fee, arg.terms.currency)}` : ""} · repayment due ${niceDate(arg.terms.dueDate)}`, "Financed", "good"];
    case "FundingReceipt":
      return [`Payment made · ${money(arg.settlementAmount, unit(arg.instrument))}`,
        `${lender} paid the supplier${arg.instrument === "OFF_LEDGER" ? ` by bank transfer · ref ${arg.paymentReference}` : ""}`, "Paid", "good"];
    case "PendingRepayment":
      return [`Repayment on its way · ${invoiceLabel(arg.terms)}`, money(arg.settlementAmount, arg.instrument), "In progress", "wait"];
    case "BalanceDue":
      return [`Balance due to the supplier · ${money(arg.balance, arg.currency)}`,
        `Buyer paid ${money(arg.collected, arg.currency)} · advance ${money(arg.advance, arg.currency)} · fee ${money(arg.fee, arg.currency)}`, "Balance due", "wait"];
    case "BalanceReceipt":
      return [`Balance paid to the supplier · ${money(arg.amount, unit(arg.instrument))}`,
        arg.instrument === "OFF_LEDGER" ? `ref ${arg.paymentReference}` : "Paid on the network in Canton Coin", "Settled", "good"];
    case "RepaymentReceipt":
      return [`Repaid · ${money(arg.amount, unit(arg.instrument))}`, `On ${niceDate(arg.repaymentDate)}${arg.early ? ", before the due date" : ""}${arg.instrument === "OFF_LEDGER" ? ` · ref ${arg.paymentReference}` : ""}`, "Repaid", "good"];
    default:
      return null;
  }
}

const ACTIVITY_PREVIEW = 8;

function renderActivity() {
  $("activityPanel").hidden = state.role === "operator";
  const items = (state.contracts[state.role] || []).map(activityItem).filter(Boolean);
  const shown = state.showAllActivity ? items : items.slice(0, ACTIVITY_PREVIEW);
  $("contractsTitle").textContent = "Activity";
  $("contractsList").innerHTML = items.length
    ? shown.map(([title, detail, badge, tone]) =>
      `<div class="item"><div class="item-text"><span class="item-title">${escapeHtml(title)}</span><span class="item-detail">${escapeHtml(detail)}</span></div><span class="badge ${tone}">${escapeHtml(badge)}</span></div>`).join("")
      + (items.length > ACTIVITY_PREVIEW
        ? `<button class="link-button" type="button" id="toggleActivity">${state.showAllActivity ? "Show less" : `Show all ${items.length}`}</button>`
        : "")
    : `<p class="empty">Nothing yet.</p>`;
}

function renderPrivacy() {
  const copy = isFinancier(state.role)
    ? [["Offers made to you, with the invoice details", true], ["Which other lenders could bid on the same invoice", true], ["Other lenders' offers, prices or wins", false]]
    : {
      supplier: [["Your invoices and approvals", true], ["Every offer you sent", true], ["Lenders' other business", false]],
      buyer: [["Invoices sent to you", true], ["Who financed each invoice", true], ["Lenders' other business", false]],
      auditor: [["Every payment and repayment, with amounts", true], ["Payment references", true], ["Ability to change anything", false]],
      operator: [["Network rules and proposed changes", true], ["Approved invoice numbers", true], ["Invoice amounts, offers and prices", false]],
    }[state.role];
  $("privacyList").innerHTML = copy.map(([text, allowed]) => `<li class="${allowed ? "" : "hidden"}">${escapeHtml(text)}</li>`).join("");
}

function renderResult() {
  const result = state.lastResult;
  if (!result) {
    $("resultBody").innerHTML = `<p class="empty">Results of your actions appear here.</p>`;
    return;
  }
  const refs = [];
  if (result.updateId) refs.push(["Network record", result.updateId]);
  if (result.cashUpdateId) refs.push(["Payment", result.cashUpdateId]);
  if (result.reference?.submissionId) refs.push(["Request", result.reference.submissionId]);
  $("resultBody").innerHTML = `<div class="result-box ${result.ok ? "ok" : "fail"}"><p class="result-title">${escapeHtml(result.title)}</p><p class="result-message">${escapeHtml(result.message)}</p>${refs.length ? `<details><summary>References</summary>${refs.map(([label, value]) => `<code>${escapeHtml(label)}: ${escapeHtml(value)}</code>`).join("")}</details>` : ""}</div>`;
}

// ------------------------------------------------------------------ actions

function approvedFaceValue(approvedCid) {
  const approved = contractsFor("supplier", "ApprovedInvoice").find((contract) => contractId(contract) === approvedCid);
  const terms = approved && termsFor(argument(approved).invoiceCommitment);
  return terms ? Number(terms.faceValue) : undefined;
}

// The advance rate is derived from the amount, rounded up so the advance never exceeds
// the invoice amount times the rate.
function rateFor(advance, faceValue) {
  return (Math.ceil((advance / faceValue) * 10_000) / 10_000).toFixed(4);
}

async function handleAction(form) {
  const data = new FormData(form);
  const value = (name) => String(data.get(name) || "").trim();
  const action = form.dataset.action;
  setLoading(true);
  try {
    let result;
    if (action === "create-draft") {
      const number = value("externalInvoiceNumber");
      if (state.upload?.duplicateOf && state.upload.duplicateOf !== number) {
        throw new Error(`This exact file was already submitted as invoice ${state.upload.duplicateOf}.`);
      }
      const amountValue = value("faceValue").replaceAll(",", "");
      result = await api("/api/v1/invoices/drafts", { method: "POST", body: JSON.stringify({
        terms: { externalInvoiceNumber: number, faceValue: amountValue, currency: value("currency") || currency(), issuedDate: value("issuedDate"), dueDate: value("dueDate") },
        ...(state.upload ? { documentSha256: state.upload.sha256 } : {}),
      }) });
      state.currentStep = "draft";
      state.upload = null;
      await loadDocuments();
      await loadRole("supplier");
      setResult({ ok: true, title: "Invoice created", message: `${number} is waiting for the buyer's approval.`, updateId: result.updateId });
    } else if (action === "approve") {
      const eligibleFinancierRoles = data.getAll("eligible").map(String);
      if (!eligibleFinancierRoles.length) throw new Error("Choose at least one lender.");
      result = await api(`/api/v1/invoices/drafts/${encodeURIComponent(value("draftCid"))}/approve`, { method: "POST", body: JSON.stringify({ eligibleFinancierRoles }) });
      state.currentStep = "approved";
      await loadNetwork();
      await loadRole("buyer");
      setResult({ ok: true, title: "Invoice approved", message: `It can now be financed once, by ${eligibleFinancierRoles.map(roleLabel).join(" or ")}.`, updateId: result.updateId });
    } else if (action === "create-offer") {
      const face = approvedFaceValue(value("approvedCid"));
      const advance = Number(value("advance").replaceAll(",", ""));
      if (!face || !(advance > 0) || advance > face) throw new Error("The advance must be more than zero and no more than the invoice amount.");
      const advanceRate = rateFor(advance, face);
      const max = Number(state.network?.rules?.maxAdvanceRate ?? 1);
      if (Number(advanceRate) > max) throw new Error(`That's more than the network's maximum advance of ${percent(max)}.`);
      const fee = value("fee").replaceAll(",", "");
      if (fee && !(Number(fee) >= 0 && advance + Number(fee) <= face)) throw new Error("The advance plus the fee can't be more than the invoice amount.");
      result = await api(`/api/v1/invoices/approved/${encodeURIComponent(value("approvedCid"))}/offers`, { method: "POST", body: JSON.stringify({ financierRole: value("financierRole"), advance: value("advance"), advanceRate, ...(fee ? { fee } : {}) }) });
      state.currentStep = "offered";
      await loadRole("supplier");
      setResult({ ok: true, title: "Offer sent", message: `${roleLabel(value("financierRole"))} can now see this offer. No other lender can.`, updateId: result.updateId });
    } else if (action === "fund") {
      const offer = contractsFor(state.role, "FinancingOffer").find((contract) => contractId(contract) === value("offerCid"));
      const terms = offer ? argument(offer).terms : undefined;
      if (terms && terms.currency !== currency()) {
        if (!value("paymentReference")) throw new Error("Enter the reference of your bank transfer to the supplier.");
        result = await api(`/api/v1/offers/${encodeURIComponent(value("offerCid"))}/accept`, { method: "POST", body: JSON.stringify({ financierRole: state.role, paymentReference: value("paymentReference") }) });
        state.currentStep = "funded";
        await loadRole(state.role);
        setResult({ ok: true, title: "Invoice financed", message: `Your transfer ${value("paymentReference")} is recorded. No one else can finance this invoice now.`, updateId: result.updateId });
      } else {
        result = await api(`/api/v1/offers/${encodeURIComponent(value("offerCid"))}/fund`, { method: "POST", body: JSON.stringify({ financierRole: state.role }) });
        state.currentStep = "funded";
        await loadRole(state.role);
        setResult({ ok: true, title: "Invoice financed", message: `You paid ${money(result.cashTransfer?.amount)} to the supplier. No one else can finance this invoice now.`, updateId: result.updateId, cashUpdateId: result.cashTransfer?.updateId });
      }
    } else if (action === "repay") {
      const financed = contractsFor("buyer", "FinancedInvoice").find((contract) => contractId(contract) === value("financedCid"));
      const terms = financed ? argument(financed).terms : undefined;
      if (terms && terms.currency !== currency()) {
        if (!value("paymentReference")) throw new Error("Enter the reference of your bank transfer to the lender.");
        result = await api(`/api/v1/financed/${encodeURIComponent(value("financedCid"))}/repay`, { method: "POST", body: JSON.stringify({ repaymentDate: value("repaymentDate"), paymentReference: value("paymentReference") }) });
        state.currentStep = "repaid";
        await loadRole("buyer");
        setResult({ ok: true, title: "Lender repaid", message: `Your transfer ${value("paymentReference")} is recorded. The invoice is closed.`, updateId: result.updateId });
      } else {
        result = await api(`/api/v1/financed/${encodeURIComponent(value("financedCid"))}/settle-repay`, { method: "POST", body: JSON.stringify({ repaymentDate: value("repaymentDate") }) });
        state.currentStep = "repaid";
        await loadRole("buyer");
        setResult({ ok: true, title: "Lender repaid", message: `${money(result.cashTransfer?.amount)} paid. The invoice is closed.`, updateId: result.updateId, cashUpdateId: result.cashTransfer?.updateId });
      }
    } else if (action === "pay-balance") {
      const due = contractsFor(state.role, "BalanceDue").find((contract) => contractId(contract) === value("balanceCid"));
      const arg = due ? argument(due) : {};
      if (arg.currency && arg.currency !== currency()) {
        if (!value("paymentReference")) throw new Error("Enter the reference of your bank transfer to the supplier.");
        result = await api(`/api/v1/balances/${encodeURIComponent(value("balanceCid"))}/pay`, { method: "POST", body: JSON.stringify({ financierRole: state.role, paymentReference: value("paymentReference") }) });
        await loadRole(state.role);
        setResult({ ok: true, title: "Balance paid", message: `Your transfer ${value("paymentReference")} of ${money(arg.balance, arg.currency)} is recorded. The invoice is fully settled.`, updateId: result.updateId });
      } else {
        result = await api(`/api/v1/balances/${encodeURIComponent(value("balanceCid"))}/settle`, { method: "POST", body: JSON.stringify({ financierRole: state.role }) });
        await loadRole(state.role);
        setResult({ ok: true, title: "Balance paid", message: `${money(result.cashTransfer?.amount)} paid to the supplier. The invoice is fully settled.`, updateId: result.updateId, cashUpdateId: result.cashTransfer?.updateId });
      }
    } else if (action === "propose") {
      const type = value("type");
      let proposal;
      if (type === "SetMaxAdvanceRate") {
        const pct = Number(value("rate"));
        if (!value("rate") || !(pct >= 0 && pct <= 100)) throw new Error("Enter a maximum advance between 0 and 100%.");
        proposal = { type, rate: (pct / 100).toFixed(4) };
      } else {
        if (!value("financierRole")) throw new Error("Choose a lender.");
        proposal = { type, financierRole: value("financierRole") };
      }
      result = await api("/api/v1/governance/proposals", { method: "POST", body: JSON.stringify({ operatorIndex: value("operatorIndex"), action: proposal }) });
      await loadNetwork();
      await loadRole("operator");
      setResult({ ok: true, title: "Change proposed", message: `Nothing changes until ${state.network.threshold} admins approve.`, updateId: result.updateId });
    }
  } catch (error) {
    const taken = error.code === "INVOICE_UNAVAILABLE";
    setResult({ ok: false, title: taken ? "Already financed" : "Couldn't complete that", message: error.message, reference: error.reference });
  } finally {
    setLoading(false);
  }
}

async function handleGovernance(button) {
  const proposal = button.dataset.proposal;
  setLoading(true);
  try {
    let result;
    if (button.dataset.governance === "vote") {
      const operatorIndex = button.dataset.operator;
      result = await api(`/api/v1/governance/proposals/${encodeURIComponent(proposal)}/votes`, { method: "POST", body: JSON.stringify({ operatorIndex }) });
      await loadNetwork();
      setResult({ ok: true, title: "Approval recorded", message: `Admin ${operatorIndex} approved the change.`, updateId: result.updateId });
    } else {
      result = await api(`/api/v1/governance/proposals/${encodeURIComponent(proposal)}/execute`, { method: "POST", body: JSON.stringify({ operatorIndex: state.account?.operatorIndex || "1" }) });
      await loadNetwork();
      setResult({ ok: true, title: "Rules changed", message: "Enough admins approved, so the new rule now applies to everyone.", updateId: result.updateId });
    }
    await loadRole("operator");
  } catch (error) {
    await loadNetwork().catch(() => {});
    const below = error.code === "GOVERNANCE_THRESHOLD_NOT_MET";
    setResult({ ok: false, title: below ? "Not enough approvals" : "Couldn't complete that", message: error.message, reference: error.reference });
  } finally {
    setLoading(false);
  }
}

function updateProposalFields() {
  const type = $("proposalType")?.value;
  if (!type) return;
  document.querySelectorAll('[data-for="lender"]').forEach((field) => { field.hidden = type === "SetMaxAdvanceRate"; });
  document.querySelectorAll('[data-for="rate"]').forEach((field) => { field.hidden = type !== "SetMaxAdvanceRate"; });
}

function updateFeeHint() {
  const hint = $("feeHint");
  const select = $("approvedCid");
  if (!hint || !select) return;
  const face = approvedFaceValue(select.value);
  const advance = Number(($("offerAdvance")?.value || "").replaceAll(",", ""));
  const fee = Number(($("offerFee")?.value || "").replaceAll(",", ""));
  hint.textContent = face && advance > 0 && fee >= 0 && $("offerFee").value
    ? (advance + fee <= face
      ? `You get ${amount(advance)} now and ${amount(face - advance - fee)} when the buyer pays.`
      : "The advance plus the fee is more than the invoice.")
    : "Agreed now. The rest comes back to you when the buyer pays.";
}

function updateAdvanceHint() {
  updateFeeHint();
  const hint = $("advanceHint");
  const select = $("approvedCid");
  const input = $("offerAdvance");
  if (!hint || !select || !input) return;
  const face = approvedFaceValue(select.value);
  const advance = Number(input.value.replaceAll(",", ""));
  const max = percent(state.network?.rules?.maxAdvanceRate);
  hint.textContent = face && advance > 0
    ? `${percent(advance / face)} of the invoice · maximum ${max}.`
    : `Up to ${max} of the invoice.`;
}

function bindEvents() {
  $("roleButtons").addEventListener("click", async (event) => {
    if (event.target.id === "signOut") {
      await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
      window.location.replace("/login");
      return;
    }
    const button = event.target.closest("button[data-role]");
    if (!button || state.loading) return;
    window.location.hash = button.dataset.role;
  });
  window.addEventListener("hashchange", async () => {
    if (state.account) return;
    const role = roleFromHash();
    if (role === state.role) return;
    state.role = role;
    state.lastResult = null;
    state.showAllActivity = false;
    render();
    await loadSelectedRole();
  });
  $("refreshButton").addEventListener("click", loadSelectedRole);
  $("actionPanel").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.loading) handleAction(event.target);
  });
  $("actionPanel").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-governance]");
    if (button && !state.loading) handleGovernance(button);
  });
  $("actionPanel").addEventListener("input", updateAdvanceHint);
  $("actionPanel").addEventListener("change", (event) => {
    if (event.target.id === "invoiceFile") {
      handleInvoiceFile(event.target.files?.[0]);
      return;
    }
    updateAdvanceHint();
    updateProposalFields();
    updatePaymentFields();
  });
  $("contractsList").addEventListener("click", (event) => {
    if (event.target.id !== "toggleActivity") return;
    state.showAllActivity = !state.showAllActivity;
    renderActivity();
  });
}

async function start() {
  const me = await fetch("/api/v1/auth/me").catch(() => undefined);
  if (me?.status === 401) {
    window.location.replace("/login");
    return;
  }
  if (me?.ok) {
    state.account = (await me.json()).account;
    if (state.account.role === "presenter") {
      window.location.replace("/race");
      return;
    }
    state.role = state.account.role;
  }
  bindEvents();
  render();
  await loadSelectedRole();
}

// Shows the bank-reference field when the chosen invoice is in naira, and a link to
// the invoice file when one was attached.
function updatePaymentFields() {
  const offerSelect = $("offerCid");
  if (offerSelect) {
    const offer = contractsFor(state.role, "FinancingOffer").find((contract) => contractId(contract) === offerSelect.value);
    const terms = offer ? argument(offer).terms : undefined;
    $("fundReferenceField").hidden = !terms || terms.currency === currency();
    $("offerFile").innerHTML = terms ? documentLink(terms.externalInvoiceNumber) : "";
  }
  const balanceSelect = $("balanceCid");
  if (balanceSelect) {
    const due = contractsFor(state.role, "BalanceDue").find((contract) => contractId(contract) === balanceSelect.value);
    $("balanceReferenceField").hidden = !due || argument(due).currency === currency();
  }
  const financedSelect = $("financedCid");
  if (financedSelect) {
    const financed = contractsFor("buyer", "FinancedInvoice").find((contract) => contractId(contract) === financedSelect.value);
    const terms = financed ? argument(financed).terms : undefined;
    $("repayReferenceField").hidden = !terms || terms.currency === currency();
  }
  const draftSelect = $("draftCid");
  if (draftSelect) {
    const draft = contractsFor("buyer", "InvoiceDraft").find((contract) => contractId(contract) === draftSelect.value);
    $("draftFile").innerHTML = draft ? documentLink(argument(draft).terms.externalInvoiceNumber) : "";
  }
}

// ------------------------------------------------------------------ invoice files

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${PDFJS}/pdf.min.js`;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Couldn't load the PDF reader."));
    document.head.appendChild(script);
  });
}

async function pdfText(file) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let index = 1; index <= Math.min(pdf.numPages, 3); index += 1) {
    const content = await (await pdf.getPage(index)).getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join(" ").replace(/\s+/g, " ");
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function parseDate(text) {
  if (!text) return "";
  let match = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = /(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/.exec(text);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  match = /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/.exec(text);
  if (match && MONTHS[match[2].toLowerCase()]) return `${match[3]}-${String(MONTHS[match[2].toLowerCase()]).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  match = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(text);
  if (match && MONTHS[match[1].toLowerCase()]) return `${match[3]}-${String(MONTHS[match[1].toLowerCase()]).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return "";
}

const DATE = "(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[\\/.]\\d{1,2}[\\/.]\\d{4}|\\d{1,2}(?:st|nd|rd|th)?\\s+[A-Za-z]{3,9}\\.?,?\\s+\\d{4}|[A-Za-z]{3,9}\\.?\\s+\\d{1,2},?\\s+\\d{4})";

// Best-effort reading of a text PDF. The supplier always checks and corrects the result.
function extractFields(text) {
  const found = {};
  const number = /invoice\s*(?:no\.?|number|num\.?|#)\s*[:.]?\s*([A-Z0-9][A-Z0-9\-\/_.]{2,})/i.exec(text);
  if (number) found.number = number[1].replace(/[.,]$/, "");
  const amounts = [...text.matchAll(/(amount due|total due|balance due|grand total|invoice total|total)[^0-9]{0,30}?([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi)];
  const preferred = amounts.filter((match) => /due|grand/i.test(match[1]));
  const chosen = (preferred.length ? preferred : amounts).at(-1);
  if (chosen) found.amount = chosen[2].replaceAll(",", "");
  if (/₦|\bNGN\b/.test(text)) found.currency = "NGN";
  const issued = new RegExp(`(?:invoice date|date of issue|issue date|issued(?: on)?|date)\\s*[:.]?\\s*${DATE}`, "i").exec(text);
  if (issued) found.issued = parseDate(issued[1]);
  const due = new RegExp(`(?:due date|payment due|due on|due)\\s*[:.]?\\s*${DATE}`, "i").exec(text);
  if (due) found.due = parseDate(due[1]);
  const net = /net\s*(\d{1,3})\b/i.exec(text);
  if (!found.due && net && found.issued) {
    found.due = new Date(Date.parse(`${found.issued}T00:00:00Z`) + Number(net[1]) * 86_400_000).toISOString().slice(0, 10);
  }
  return found;
}

// Photos over the upload limit are re-encoded smaller in the browser.
async function shrinkImage(file, limit) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= limit) return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  }
  throw new Error("This photo is too large even after shrinking. Try a smaller photo.");
}

async function handleInvoiceFile(file) {
  const status = $("uploadStatus");
  state.upload = null;
  if (!file) return;
  const LIMIT = 950_000;
  try {
    status.textContent = "Reading the file…";
    let upload = file;
    const filled = [];
    if (file.type === "application/pdf") {
      if (file.size > LIMIT) throw new Error("PDFs must be under 1 MB.");
      const fields = extractFields(await pdfText(file).catch(() => ""));
      if (fields.number) { $("externalInvoiceNumber").value = fields.number; filled.push("number"); }
      if (fields.amount) { $("faceValue").value = fields.amount; filled.push("amount"); }
      if (fields.currency) $("invoiceCurrency").value = fields.currency;
      if (fields.issued) { $("issuedDate").value = fields.issued; filled.push("issue date"); }
      if (fields.due) { $("dueDate").value = fields.due; filled.push("due date"); }
    } else if (file.type === "image/png" || file.type === "image/jpeg") {
      if (file.size > LIMIT) upload = await shrinkImage(file, LIMIT);
    } else {
      throw new Error("Upload a PDF, PNG or JPEG file.");
    }
    status.textContent = "Uploading…";
    const response = await fetch("/api/v1/documents", {
      method: "POST",
      headers: { "Content-Type": upload.type, "X-File-Name": encodeURIComponent(upload.name) },
      body: upload,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status, payload);
    state.upload = { sha256: payload.sha256, duplicateOf: payload.duplicateOf };
    if (payload.duplicateOf) {
      status.textContent = `Warning: this exact file was already submitted as invoice ${payload.duplicateOf}. It can't back a second invoice.`;
      return;
    }
    const read = file.type === "application/pdf"
      ? (filled.length ? `Filled in the ${filled.join(", ")} from the PDF. Check them before you continue.` : "Couldn't read the details from this PDF. Please type them in.")
      : "Photo attached. Please type in the details.";
    status.textContent = `${upload.name} attached (fingerprint ${payload.sha256.slice(0, 10)}…). ${read}`;
  } catch (error) {
    state.upload = null;
    status.textContent = error.message || "Couldn't attach this file.";
  }
}

start();
