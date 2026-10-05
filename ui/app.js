const ROLES = ["supplier", "buyer", "financierA", "financierB", "auditor"];

const ROLE_LABELS = {
  supplier: "Supplier",
  buyer: "Buyer",
  financierA: "Financier A",
  financierB: "Financier B",
  auditor: "Auditor",
};

const ROLE_CONTEXT = {
  supplier: "Issue an invoice, then make private offers to the financiers you choose.",
  buyer: "Approve supplier invoices once, then repay the financier at maturity.",
  financierA: "Evaluate and fund your own offers. Rival books are not in this view.",
  financierB: "See only your own offer — and a clean rejection if another financier won.",
  auditor: "See the complete, unbroken trail without operating the workflow.",
};

const state = {
  role: "buyer",
  contracts: {},
  setup: { rulesCid: "", registryCid: "" },
  lastResult: null,
  currentStep: "draft",
  loading: false,
};

const $ = (id) => document.getElementById(id);

class ApiError extends Error {
  constructor(status, payload) {
    super(safeErrorMessage(status, payload));
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
  if (response.status === 401 && payload?.code === "DEMO_AUTH_REQUIRED" && !authRetry) {
    const passphrase = window.prompt("Enter the Tavryn demo passphrase");
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

function safeErrorMessage(status, payload) {
  const messages = {
    INVOICE_UNAVAILABLE: "This invoice is no longer available for funding.",
    DUPLICATE_OR_INVALID_APPROVAL: "The buyer already approved this external invoice number.",
    SETTLEMENT_NOT_CONFIGURED: "Canton Coin settlement is not configured for this role.",
    SETTLEMENT_PENDING: "Cash is still pending. The invoice remains locked for reconciliation.",
    SETTLEMENT_LEDGER_FINALIZATION_FAILED: "Cash moved, but funding needs ledger reconciliation.",
    SETTLEMENT_LEDGER_REPAYMENT_FAILED: "Cash moved, but repayment needs ledger reconciliation.",
    SERVICE_UNREACHABLE: "The Tavryn service could not be reached.",
    LEDGER_REQUEST_FAILED: "The ledger could not complete the request.",
    DEMO_AUTH_REQUIRED: "Sign in is required to use this demo.",
    DEMO_AUTH_FAILED: "That demo passphrase is not correct.",
  };
  if (payload?.code && messages[payload.code]) return messages[payload.code];
  if (status === 0) return messages.SERVICE_UNREACHABLE;
  if (status === 409) return "The ledger rejected this action because the state has changed.";
  if (status >= 500) return "The Tavryn service could not complete this action.";
  return "Check the highlighted inputs and try again.";
}

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

function shortCid(value) {
  if (!value) return "—";
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function optionList(items, label) {
  if (!items.length) return '<option value="">No matching contracts in this view</option>';
  return `<option value="">Select ${label.toLowerCase()}</option>${items.map((item) =>
    `<option value="${escapeHtml(contractId(item))}">${escapeHtml(labelForContract(item))}</option>`).join("")}`;
}

function labelForContract(contract) {
  const name = templateName(contract);
  const arg = argument(contract);
  if (name === "InvoiceDraft") return `${arg.terms?.externalInvoiceNumber || "Invoice draft"} · ${arg.terms?.faceValue || "—"} ${arg.terms?.currency || ""}`;
  if (name === "ApprovedInvoice") return `Approved invoice · ${shortCid(contractId(contract))}`;
  if (name === "FinancingOffer") return `${ROLE_LABELS[roleForParty(arg.financier)] || "Financier"} offer · ${arg.advance || "—"}`;
  if (name === "FinancedInvoice") return `${arg.terms?.externalInvoiceNumber || "Financed invoice"} · ${arg.advance || "—"}`;
  return `${name} · ${shortCid(contractId(contract))}`;
}

function roleForParty(party) {
  const known = state.partyLabels || {};
  return known[party] || "";
}

function selectedContracts() {
  return state.contracts[state.role] || [];
}

async function loadRole(role, announce = false) {
  const result = await api(`/api/v1/roles/${encodeURIComponent(role)}/contracts`);
  state.contracts[role] = Array.isArray(result.contracts) ? result.contracts : [];
  if (announce) setResult({ kind: "success", status: "VIEW REFRESHED", message: `${ROLE_LABELS[role]} view read from the ledger.` });
  syncSetupFromBuyer();
  render();
}

function syncSetupFromBuyer() {
  const buyerContracts = state.contracts.buyer || [];
  state.setup.rulesCid = contractId(contractsFor("buyer", "NetworkRules")[0]);
  state.setup.registryCid = contractId(contractsFor("buyer", "BuyerApprovalRegistry")[0]);
}

async function loadSelectedRole() {
  setLoading(true);
  try {
    await loadRole(state.role);
  } catch (error) {
    setResult({ kind: "failure", status: "VIEW UNAVAILABLE", message: error.message, reference: error.reference });
  } finally {
    setLoading(false);
  }
}

async function initializeSetup() {
  setLoading(true);
  try {
    const maxAdvanceRate = $("maxAdvanceRate")?.value.trim();
    if (!state.setup.rulesCid) {
      if (!maxAdvanceRate) throw new Error("Enter the network maximum advance rate before setup.");
      await api("/api/v1/setup/rules", { method: "POST", body: JSON.stringify({ maxAdvanceRate }) });
    }
    if (!state.setup.registryCid) await api("/api/v1/setup/registry", { method: "POST", body: JSON.stringify({}) });
    await loadRole("buyer");
    setResult({ kind: "success", status: "NETWORK READY", message: "Buyer registry and advance rules are active Canton contracts." });
  } catch (error) {
    setResult({ kind: "failure", status: "SETUP FAILED", message: error.message, reference: error.reference });
  } finally {
    setLoading(false);
  }
}

function setLoading(value) {
  state.loading = value;
  document.querySelectorAll("button").forEach((button) => { button.disabled = value; });
  if (!value) render();
}

function setResult(result) {
  state.lastResult = result;
  renderResult();
}

function updateStep(step) {
  const order = ["draft", "approved", "offered", "funded", "repaid"];
  state.currentStep = step;
  document.querySelectorAll(".workflow-step").forEach((element) => {
    const current = order.indexOf(element.dataset.step);
    const target = order.indexOf(step);
    element.classList.toggle("complete", current < target);
    element.classList.toggle("current", current === target);
  });
}

function render() {
  document.querySelectorAll(".role-button").forEach((button) => {
    const active = button.dataset.role === state.role;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("roleContext").innerHTML = `<strong>${ROLE_LABELS[state.role]} view.</strong> ${ROLE_CONTEXT[state.role]}`;
  $("actionRole").textContent = ROLE_LABELS[state.role].toUpperCase();
  renderSetup();
  renderActionPanel();
  renderContracts();
  renderPrivacy();
  renderResult();
  updateStep(state.currentStep);
}

function renderSetup() {
  const ready = Boolean(state.setup.rulesCid && state.setup.registryCid);
  $("setupState").textContent = ready ? "LIVE" : "SETUP REQUIRED";
  $("setupState").classList.toggle("ready", ready);
  $("registryState").textContent = state.setup.registryCid ? "Active on ledger" : "Not loaded";
  const rules = contractsFor("buyer", "NetworkRules")[0];
  const rulesArg = argument(rules);
  $("rulesState").textContent = state.setup.rulesCid ? `${rulesArg.maxAdvanceRate || "—"} maximum advance` : "Not loaded";
  $("setupButton").textContent = ready ? "Refresh setup view" : "Load / create setup";
}

function renderActionPanel() {
  const title = {
    supplier: "Issue or offer an invoice",
    buyer: "Approve once or repay",
    financierA: "Fund your offer",
    financierB: "Test the privacy boundary",
    auditor: "Inspect the proof trail",
  }[state.role];
  $("actionTitle").textContent = title;
  $("actionBody").innerHTML = actionMarkup();
}

function actionMarkup() {
  if (state.role === "supplier") return supplierActionMarkup();
  if (state.role === "buyer") return buyerActionMarkup();
  if (state.role === "financierA" || state.role === "financierB") return financierActionMarkup();
  return auditorActionMarkup();
}

function supplierActionMarkup() {
  const approved = contractsFor("supplier", "ApprovedInvoice");
  return `
    <form class="action-form" data-action="create-draft">
      <div class="form-grid">
        <div class="field wide"><label for="invoiceCommitment">Invoice commitment</label><input id="invoiceCommitment" name="invoiceCommitment" placeholder="Reference or document hash" required /></div>
        <div class="field"><label for="externalInvoiceNumber">External invoice number</label><input id="externalInvoiceNumber" name="externalInvoiceNumber" placeholder="INV-2026-001" required /></div>
        <div class="field"><label for="faceValue">Face value</label><input id="faceValue" name="faceValue" inputmode="decimal" placeholder="100000.00" required /></div>
        <div class="field"><label for="currency">Currency</label><input id="currency" name="currency" placeholder="USD" required /></div>
        <div class="field"><label for="issuedDate">Issue date</label><input id="issuedDate" name="issuedDate" type="date" required /></div>
        <div class="field"><label for="dueDate">Due date</label><input id="dueDate" name="dueDate" type="date" required /></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Create invoice draft</button><span class="form-note">The draft stays private to the supplier and buyer until approval.</span></div>
    </form>
    ${approved.length ? `<div class="action-divider"></div><form class="action-form" data-action="create-offer"><div class="form-grid"><div class="field wide"><label for="approvedCid">Approved invoice</label><select id="approvedCid" name="approvedCid" required>${optionList(approved, "approved invoice")}</select></div><div class="field"><label for="offerFinancier">Offer to</label><select id="offerFinancier" name="financierRole" required><option value="">Select financier</option><option value="financierA">Financier A</option><option value="financierB">Financier B</option></select></div><div class="field"><label for="offerAdvance">Advance amount</label><input id="offerAdvance" name="advance" inputmode="decimal" placeholder="90000.00" required /></div><div class="field"><label for="offerRate">Advance rate</label><input id="offerRate" name="advanceRate" inputmode="decimal" placeholder="0.90" required /></div></div><div class="form-actions"><button class="button button-secondary" type="submit">Create private offer</button></div></form>` : ""}
  `;
}

function buyerActionMarkup() {
  const drafts = contractsFor("buyer", "InvoiceDraft");
  const financed = contractsFor("buyer", "FinancedInvoice");
  if (!state.setup.rulesCid || !state.setup.registryCid) {
    return `<div class="empty-action"><strong>Network setup is required first.</strong><br />Use the button above to create the live buyer registry and advance rules.</div>`;
  }
  return `
    <form class="action-form" data-action="approve">
      <div class="form-grid">
        <div class="field wide"><label for="draftCid">Supplier invoice draft</label><select id="draftCid" name="draftCid" required>${optionList(drafts, "invoice draft")}</select></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Approve invoice once</button><span class="form-note">The buyer registry rejects a second approval of the same external number.</span></div>
    </form>
    ${financed.length ? `<div class="action-divider"></div><form class="action-form" data-action="repay"><div class="form-grid"><div class="field wide"><label for="financedCid">Financed invoice</label><select id="financedCid" name="financedCid" required>${optionList(financed, "financed invoice")}</select></div><div class="field"><label for="repaymentFinancier">Financier to repay</label><select id="repaymentFinancier" name="financierRole" required><option value="">Select financier</option><option value="financierA">Financier A</option><option value="financierB">Financier B</option></select></div><div class="field"><label for="repaymentDate">Repayment date</label><input id="repaymentDate" name="repaymentDate" type="date" required /></div></div><div class="form-actions"><button class="button button-primary" type="submit">Repay with Canton Coin</button><span class="form-note">The date can be on or after the invoice issue date.</span></div></form>` : ""}
  `;
}

function financierActionMarkup() {
  const offers = contractsFor(state.role, "FinancingOffer");
  const isB = state.role === "financierB";
  return `
    <div class="action-callout ${isB ? "purple" : "teal"}"><strong>${isB ? "The proof moment" : "Your private book"}</strong><span>${isB ? "Try funding an offer after Financier A wins. The ledger returns a clean rejection; no rival terms are disclosed." : "Only offers addressed to Financier A appear here. Funding consumes the one-use state."}</span></div>
    <form class="action-form" data-action="fund">
      <div class="form-grid"><div class="field wide"><label for="offerCid">Your financing offer</label><select id="offerCid" name="offerCid" required>${optionList(offers, "financing offer")}</select></div></div>
      <div class="form-actions"><button class="button ${isB ? "button-danger" : "button-primary"}" type="submit">${isB ? "Attempt funding" : "Fund invoice"}</button><span class="form-note">The response includes a safe operation reference for the demo record.</span></div>
    </form>
  `;
}

function auditorActionMarkup() {
  return `<div class="empty-action"><strong>Auditor mode is read-only.</strong><br />The contract list below is the proof: approval, funding receipt, repayment receipt, and no rival deal data.</div>`;
}

function renderContracts() {
  const contracts = selectedContracts();
  $("contractsTitle").textContent = `${ROLE_LABELS[state.role]} visible contracts`;
  $("contractCount").textContent = String(contracts.length);
  if (!contracts.length) {
    $("contractsList").innerHTML = `<div class="empty-state">No active contracts are visible to ${ROLE_LABELS[state.role]} yet.</div>`;
    return;
  }
  $("contractsList").innerHTML = contracts.map(contractCard).join("");
}

function contractCard(contract) {
  const name = templateName(contract);
  const arg = argument(contract);
  const detail = contractDetail(name, arg);
  return `<article class="contract-card" data-kind="${escapeHtml(name)}"><span class="contract-card-bar"></span><div><p class="contract-name">${escapeHtml(displayTemplate(name))}</p><p class="contract-detail">${detail}</p></div><code class="contract-cid">${escapeHtml(shortCid(contractId(contract)))}</code></article>`;
}

function displayTemplate(name) {
  return {
    NetworkRules: "Network rules",
    BuyerApprovalRegistry: "Buyer approval registry",
    InvoiceDraft: "Invoice draft",
    ApprovedInvoice: "Approved invoice · one-use seal",
    FundingSlot: "Funding slot · one-use semaphore",
    FinancingOffer: "Private financing offer",
    PendingFunding: "Pending funding lock",
    FundingReceipt: "Funding receipt",
    FinancedInvoice: "Financed invoice",
    RepaymentReceipt: "Repayment receipt",
    InvoiceDetails: "Private invoice details",
  }[name] || name;
}

function contractDetail(name, arg) {
  if (name === "NetworkRules") return `Maximum advance <strong>${escapeHtml(arg.maxAdvanceRate || "—")}</strong>`;
  if (name === "BuyerApprovalRegistry") return `<strong>${escapeHtml((arg.approvedInvoiceNumbers || []).length)}</strong> approved external invoice number(s)`;
  if (name === "InvoiceDraft") return `<strong>${escapeHtml(arg.terms?.externalInvoiceNumber || "Draft")}</strong> · ${escapeHtml(arg.terms?.faceValue || "—")} ${escapeHtml(arg.terms?.currency || "")}`;
  if (name === "ApprovedInvoice") return "One-use approval · terms appear only in each private offer";
  if (name === "FundingSlot") return "Terms-free shared state · first successful claim wins";
  if (name === "FinancingOffer") return `<strong>${escapeHtml(arg.advance || "—")}</strong> advance · ${escapeHtml(arg.advanceRate || "—")} rate`;
  if (name === "PendingFunding") return `<strong>${escapeHtml(arg.advance || "—")}</strong> locked · cash transfer in progress`;
  if (name === "FundingReceipt") return "Cash reference recorded for the auditor";
  if (name === "FinancedInvoice") return `<strong>${escapeHtml(arg.terms?.externalInvoiceNumber || "Invoice")}</strong> · ${escapeHtml(arg.advance || "—")} funded`;
  if (name === "RepaymentReceipt") return `<strong>${escapeHtml(arg.repaymentDate || "Repaid")}</strong> · cash reference recorded`;
  if (name === "InvoiceDetails") return "Private terms visible only to the buyer, supplier and auditor";
  return "Active on the Canton ledger";
}

function renderPrivacy() {
  const copy = {
    supplier: [["Invoice drafts", true], ["Own offers and funding", true], ["Rival financier terms", false]],
    buyer: [["Approved supplier invoices", true], ["Approval registry", true], ["Financier private books", false]],
    financierA: [["Offers addressed to A", true], ["A-funded receivables", true], ["Financier B clients or terms", false]],
    financierB: [["Offers addressed to B", true], ["Plain unavailable result", true], ["Financier A amount or terms", false]],
    auditor: [["Full lifecycle trail", true], ["Funding and repayment receipts", true], ["Operational control actions", false]],
  }[state.role];
  $("privacyList").innerHTML = copy.map(([text, allowed]) => `<div class="privacy-row ${allowed ? "" : "restricted"}"><span>${escapeHtml(text)}</span></div>`).join("");
}

function renderResult() {
  const result = state.lastResult;
  if (!result) return;
  const failure = result.kind === "failure";
  const refs = [];
  if (result.updateId) refs.push(["Ledger update", result.updateId]);
  if (result.cashUpdateId) refs.push(["Canton Coin", result.cashUpdateId]);
  if (result.reference?.commandId) refs.push(["Command", result.reference.commandId]);
  if (result.reference?.submissionId) refs.push(["Submission", result.reference.submissionId]);
  $("resultBody").innerHTML = `<div class="${failure ? "result-failure" : "result-success"}"><p class="result-status">${escapeHtml(result.status)}</p><p class="result-message">${escapeHtml(result.message)}</p>${refs.length ? `<div class="result-reference">${refs.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><code title="${escapeHtml(value)}">${escapeHtml(shortCid(value))}</code></div>`).join("")}</div>` : ""}</div>`;
}

async function handleAction(form) {
  const data = new FormData(form);
  const value = (name) => String(data.get(name) || "").trim();
  const action = form.dataset.action;
  setLoading(true);
  try {
    let result;
    if (action === "create-draft") {
      result = await api("/api/v1/invoices/drafts", { method: "POST", body: JSON.stringify({ invoiceCommitment: value("invoiceCommitment"), terms: { externalInvoiceNumber: value("externalInvoiceNumber"), faceValue: value("faceValue"), currency: value("currency"), issuedDate: value("issuedDate"), dueDate: value("dueDate") } }) });
      state.currentStep = "draft";
      await loadRole("supplier");
      setResult(successFrom(result, "DRAFT CREATED", "The supplier draft is now visible to the supplier and buyer."));
    } else if (action === "approve") {
      result = await api(`/api/v1/invoices/drafts/${encodeURIComponent(value("draftCid"))}/approve`, { method: "POST", body: JSON.stringify({ networkRulesCid: state.setup.rulesCid, registryCid: state.setup.registryCid }) });
      state.currentStep = "approved";
      await loadRole("buyer");
      setResult(successFrom(result, "APPROVED ONCE", "The buyer approval seal and one-use funding slot are live."));
    } else if (action === "create-offer") {
      result = await api(`/api/v1/invoices/approved/${encodeURIComponent(value("approvedCid"))}/offers`, { method: "POST", body: JSON.stringify({ financierRole: value("financierRole"), advance: value("advance"), advanceRate: value("advanceRate") }) });
      state.currentStep = "offered";
      await loadRole("supplier");
      setResult(successFrom(result, "OFFER CREATED", "The offer is visible only to the named financier and its counterparties."));
    } else if (action === "fund") {
      result = await api(`/api/v1/offers/${encodeURIComponent(value("offerCid"))}/fund`, { method: "POST", body: JSON.stringify({ financierRole: state.role }) });
      state.currentStep = "funded";
      await loadRole(state.role);
      setResult({ kind: "success", status: "FUNDED ONCE", message: "Canton Coin moved and the one-use state was consumed.", updateId: result.updateId, cashUpdateId: result.cashTransfer?.updateId });
    } else if (action === "repay") {
      const financier = value("financierRole");
      result = await api(`/api/v1/financed/${encodeURIComponent(value("financedCid"))}/settle-repay`, { method: "POST", body: JSON.stringify({ financierRole: financier, repaymentDate: value("repaymentDate") }) });
      state.currentStep = "repaid";
      await loadRole("buyer");
      setResult({ kind: "success", status: "REPAID", message: "Canton Coin repayment and the closing receipt are recorded.", updateId: result.updateId, cashUpdateId: result.cashTransfer?.updateId });
    }
  } catch (error) {
    setResult({ kind: "failure", status: error.code === "INVOICE_UNAVAILABLE" ? "SECOND FUNDING REJECTED" : "ACTION FAILED", message: error.message, reference: error.reference });
  } finally {
    setLoading(false);
  }
}

function successFrom(result, status, message) {
  return { kind: "success", status, message, updateId: result.updateId };
}

function bindEvents() {
  $("roleButtons").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-role]");
    if (!button || state.loading) return;
    state.role = button.dataset.role;
    state.lastResult = null;
    render();
    await loadSelectedRole();
  });
  $("setupButton").addEventListener("click", initializeSetup);
  $("refreshButton").addEventListener("click", loadSelectedRole);
  $("actionPanel").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.loading) handleAction(event.target);
  });
}

async function start() {
  bindEvents();
  render();
  await loadSelectedRole();
}

start();
