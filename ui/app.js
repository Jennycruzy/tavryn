const ROLE_CONTEXT = {
  supplier: "Issue an invoice, then make private offers to the financiers the buyer approved.",
  buyer: "Approve each supplier invoice once, then repay the financier who funded it.",
  financier: "Fund your own offers. Rival offers, prices and wins never appear here.",
  auditor: "See the complete funding and repayment trail without operating the workflow.",
  operator: "Change the network rules together. No operator can change them alone.",
};

const state = {
  role: "buyer",
  contracts: {},
  network: null,
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
    DUPLICATE_INVOICE: "The buyer already approved this external invoice number.",
    FINANCIER_NOT_ELIGIBLE: "This financier is not admitted to the network or not eligible for this invoice.",
    RATE_ABOVE_NETWORK_MAX: "The advance rate is above the network's current maximum.",
    INVALID_ADVANCE: "The advance must be positive and no more than face value times the rate.",
    PROPOSAL_EXPIRED: "This proposal has expired. Nothing changed.",
    PROPOSAL_STALE: "The rules changed after this proposal was made. Propose it again.",
    GOVERNANCE_ACTION_INVALID: "That change does not apply to the current rules.",
    NETWORK_NOT_BOOTSTRAPPED: "The network has not been set up by its operators yet.",
    BUYER_NOT_ONBOARDED: "The buyer has not been onboarded to this network yet.",
    REPAYMENT_NOT_AVAILABLE: "This invoice is not awaiting repayment. If a repayment is in progress, it will be reconciled — do not pay again.",
    SETTLEMENT_NOT_CONFIGURED: "Canton Coin settlement is not configured for this role.",
    SETTLEMENT_PENDING: "Cash is still pending. The invoice stays locked until it settles.",
    SETTLEMENT_LEDGER_FINALIZATION_FAILED: "Cash moved; the ledger record will be completed by reconciliation.",
    SETTLEMENT_LEDGER_REPAYMENT_FAILED: "Cash moved; the repayment record will be completed by reconciliation. Do not pay again.",
    SETTLEMENT_INSTRUMENT_MISMATCH: "This invoice is not denominated in the configured Canton Coin currency.",
    SERVICE_UNREACHABLE: "The Tavryn service could not be reached.",
    LEDGER_REQUEST_FAILED: "The ledger could not complete the request.",
    DEMO_AUTH_REQUIRED: "Sign in is required to use this demo.",
    DEMO_AUTH_FAILED: "That demo passphrase is not correct.",
    WRITE_RATE_LIMITED: "Too many changes were sent. Please wait a minute and try again.",
  };
  // The threshold message carries the live vote count from the server.
  if (payload?.code === "GOVERNANCE_THRESHOLD_NOT_MET" && payload.error) return payload.error;
  if (payload?.code && messages[payload.code]) return messages[payload.code];
  if (status === 0) return messages.SERVICE_UNREACHABLE;
  if (status === 409) return "The ledger rejected this action because the state has changed.";
  if (status >= 500) return "The Tavryn service could not complete this action.";
  return "Check the highlighted inputs and try again.";
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
  return role.startsWith("financier");
}

function roleLabel(role) {
  if (isFinancier(role)) return `Financier ${role.slice("financier".length)}`;
  return { supplier: "Supplier", buyer: "Buyer", auditor: "Auditor", operator: "Operators" }[role] || role;
}

function roleForParty(party) {
  if (!state.network) return "";
  const financier = state.network.financierRoles.find((entry) => entry.party === party);
  return financier ? financier.role : "";
}

async function loadNetwork() {
  state.network = await api("/api/v1/network");
}

// ------------------------------------------------------------------ contract helpers

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

function amount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Number(number.toFixed(10))) : "—";
}

function optionList(items, label) {
  if (!items.length) return '<option value="">No matching contracts in this view</option>';
  return `<option value="">Select ${label.toLowerCase()}</option>${items.map((item) =>
    `<option value="${escapeHtml(contractId(item))}">${escapeHtml(labelForContract(item))}</option>`).join("")}`;
}

function financierOptions(list) {
  if (!list.length) return '<option value="">No admitted financiers</option>';
  return `<option value="">Select financier</option>${list.map((role) =>
    `<option value="${escapeHtml(role)}">${escapeHtml(roleLabel(role))}</option>`).join("")}`;
}

function labelForContract(contract) {
  const name = templateName(contract);
  const arg = argument(contract);
  if (name === "InvoiceDraft") return `${arg.terms?.externalInvoiceNumber || "Invoice draft"} · ${amount(arg.terms?.faceValue)} ${arg.terms?.currency || ""}`;
  if (name === "ApprovedInvoice") {
    // The supplier and buyer hold the private details; label the invoice by its number.
    const details = (state.contracts[state.role] || []).find((item) =>
      templateName(item) === "InvoiceDetails" && argument(item).invoiceCommitment === arg.invoiceCommitment);
    const terms = argument(details).terms;
    return terms
      ? `${terms.externalInvoiceNumber} · ${amount(terms.faceValue)} ${terms.currency}`
      : `Approved invoice · ${shortCid(arg.invoiceCommitment)}`;
  }
  if (name === "FinancingOffer") return `${arg.terms?.externalInvoiceNumber || "Offer"} · ${amount(arg.advance)} ${arg.terms?.currency || ""}`;
  if (name === "FinancedInvoice") return `${arg.terms?.externalInvoiceNumber || "Financed invoice"} · ${roleLabel(roleForParty(arg.financier)) || "financier"}`;
  return `${name} · ${shortCid(contractId(contract))}`;
}

async function loadRole(role, announce = false) {
  const result = await api(`/api/v1/roles/${encodeURIComponent(role)}/contracts`);
  state.contracts[role] = Array.isArray(result.contracts) ? result.contracts : [];
  if (announce) setResult({ kind: "success", status: "VIEW REFRESHED", message: `${roleLabel(role)} view read from the ledger.` });
  render();
}

async function loadSelectedRole() {
  setLoading(true);
  try {
    await loadNetwork();
    renderRoleButtons();
    await loadRole(state.role);
  } catch (error) {
    setResult({ kind: "failure", status: "VIEW UNAVAILABLE", message: error.message, reference: error.reference });
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

// ------------------------------------------------------------------ rendering

function renderRoleButtons() {
  $("roleButtons").innerHTML = roles().map((role) =>
    `<button class="role-button" data-role="${escapeHtml(role)}" role="tab">${escapeHtml(roleLabel(role))}</button>`).join("");
}

function render() {
  document.querySelectorAll(".role-button").forEach((button) => {
    const active = button.dataset.role === state.role;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const context = ROLE_CONTEXT[isFinancier(state.role) ? "financier" : state.role];
  $("roleContext").innerHTML = `<strong>${escapeHtml(roleLabel(state.role))} view.</strong> ${escapeHtml(context)}`;
  $("actionRole").textContent = roleLabel(state.role).toUpperCase();
  renderNetwork();
  renderActionPanel();
  renderContracts();
  renderPrivacy();
  renderResult();
  updateStep(state.currentStep);
}

function renderNetwork() {
  const network = state.network;
  const ready = Boolean(network?.bootstrapped && network.rules?.buyerOnboarded);
  $("setupState").textContent = ready ? "LIVE" : "NOT SET UP";
  $("setupState").classList.toggle("ready", ready);
  if (!network?.rules) {
    $("rulesState").textContent = "Not set up";
    $("registryState").textContent = "Not set up";
    $("financiersState").textContent = "—";
    $("operatorsState").textContent = network ? `${network.operators.length} operators, ${network.threshold} must agree` : "—";
    return;
  }
  $("rulesState").textContent = `${amount(network.rules.maxAdvanceRate)} max · v${network.rules.version}`;
  $("registryState").textContent = network.registry ? `${network.registry.approvedCount} approved` : "Buyer not onboarded";
  $("financiersState").textContent = network.rules.financiers.map((entry) => roleLabel(entry.role || "unknown")).join(", ") || "None";
  $("operatorsState").textContent = `${network.threshold} of ${network.operators.length} must agree`;
}

function renderActionPanel() {
  const title = isFinancier(state.role)
    ? "Fund your offer"
    : {
      supplier: "Issue or offer an invoice",
      buyer: "Approve once or repay",
      auditor: "Inspect the proof trail",
      operator: "Govern the network together",
    }[state.role];
  $("actionTitle").textContent = title;
  $("actionBody").innerHTML = actionMarkup();
}

function actionMarkup() {
  if (state.role === "supplier") return supplierActionMarkup();
  if (state.role === "buyer") return buyerActionMarkup();
  if (state.role === "operator") return governanceActionMarkup();
  if (isFinancier(state.role)) return financierActionMarkup();
  return auditorActionMarkup();
}

function supplierActionMarkup() {
  const approved = contractsFor("supplier", "ApprovedInvoice");
  const eligible = (contract) => (argument(contract).eligibleFinanciers || []).map(roleForParty).filter(Boolean);
  const offerTargets = [...new Set(approved.flatMap(eligible))];
  return `
    <form class="action-form" data-action="create-draft">
      <div class="form-grid">
        <div class="field"><label for="externalInvoiceNumber">External invoice number</label><input id="externalInvoiceNumber" name="externalInvoiceNumber" placeholder="INV-2026-001" required /></div>
        <div class="field"><label for="faceValue">Face value</label><input id="faceValue" name="faceValue" inputmode="decimal" placeholder="100.00" required /></div>
        <div class="field"><label for="currency">Currency</label><input id="currency" name="currency" placeholder="CC" required /></div>
        <div class="field"><label for="issuedDate">Issue date</label><input id="issuedDate" name="issuedDate" type="date" required /></div>
        <div class="field"><label for="dueDate">Due date</label><input id="dueDate" name="dueDate" type="date" required /></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Create invoice draft</button><span class="form-note">Only the supplier and buyer see the draft. The ledger seals it with a private commitment when the buyer approves.</span></div>
    </form>
    ${approved.length ? `<div class="action-divider"></div>
    <form class="action-form" data-action="create-offer">
      <div class="form-grid">
        <div class="field wide"><label for="approvedCid">Approved invoice</label><select id="approvedCid" name="approvedCid" required>${optionList(approved, "approved invoice")}</select></div>
        <div class="field"><label for="offerFinancier">Offer to</label><select id="offerFinancier" name="financierRole" required>${financierOptions(offerTargets)}</select></div>
        <div class="field"><label for="offerAdvance">Advance amount</label><input id="offerAdvance" name="advance" inputmode="decimal" placeholder="90.00" required /></div>
        <div class="field"><label for="offerRate">Advance rate</label><input id="offerRate" name="advanceRate" inputmode="decimal" placeholder="0.90" required /></div>
      </div>
      <div class="form-actions"><button class="button button-secondary" type="submit">Create private offer</button><span class="form-note">The offered financier sees this invoice's terms, never another financier's offer.</span></div>
    </form>` : ""}
  `;
}

function buyerActionMarkup() {
  const drafts = contractsFor("buyer", "InvoiceDraft");
  const financed = contractsFor("buyer", "FinancedInvoice");
  if (!state.network?.rules?.buyerOnboarded) {
    return `<div class="empty-action"><strong>The buyer is not onboarded yet.</strong><br />The network operators onboard a buyer by vote; run the bootstrap to set up the demo network.</div>`;
  }
  const admitted = admittedFinancierRoles();
  return `
    <form class="action-form" data-action="approve">
      <div class="form-grid">
        <div class="field wide"><label for="draftCid">Supplier invoice draft</label><select id="draftCid" name="draftCid" required>${optionList(drafts, "invoice draft")}</select></div>
        <div class="field wide"><label>Financiers who may fund it</label><div class="form-note">${admitted.map((role) =>
          `<label><input type="checkbox" name="eligible" value="${escapeHtml(role)}" checked /> ${escapeHtml(roleLabel(role))}</label>`).join(" &nbsp; ")}</div></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Approve invoice once</button><span class="form-note">The registry refuses a second approval of the same external number.</span></div>
    </form>
    ${financed.length ? `<div class="action-divider"></div>
    <form class="action-form" data-action="repay">
      <div class="form-grid">
        <div class="field wide"><label for="financedCid">Financed invoice</label><select id="financedCid" name="financedCid" required>${optionList(financed, "financed invoice")}</select></div>
        <div class="field"><label for="repaymentDate">Repayment date</label><input id="repaymentDate" name="repaymentDate" type="date" required /></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">Repay with Canton Coin</button><span class="form-note">Early repayment is allowed. A retry never pays twice.</span></div>
    </form>` : ""}
  `;
}

function financierActionMarkup() {
  const offers = contractsFor(state.role, "FinancingOffer");
  const closed = contractsFor(state.role, "OfferClosed");
  return `
    <div class="action-callout teal"><strong>Your private book</strong><span>Only offers addressed to ${escapeHtml(roleLabel(state.role))} appear here. Funding consumes the invoice's one-use state; any later attempt is refused.</span></div>
    <form class="action-form" data-action="fund">
      <div class="form-grid"><div class="field wide"><label for="offerCid">Your financing offer</label><select id="offerCid" name="offerCid" required>${optionList(offers, "financing offer")}</select></div></div>
      <div class="form-actions"><button class="button button-primary" type="submit">Fund with Canton Coin</button><span class="form-note">The response shows the ledger and Canton Coin references.</span></div>
    </form>
    ${closed.length ? `<div class="action-divider"></div><div class="empty-action"><strong>This invoice is no longer available.</strong><br />${closed.length} of your offer(s) closed. The ledger tells you nothing about who funded them or on what terms.</div>` : ""}
  `;
}

function governanceActionMarkup() {
  const network = state.network;
  if (!network?.bootstrapped) {
    return `<div class="empty-action"><strong>No committee yet.</strong><br />Every operator must sign the bootstrap before rules exist. Run <code>npm run bootstrap</code>.</div>`;
  }
  const operatorButtons = (proposal) => network.operators.map((operator) => {
    const voted = proposal.votes.includes(operator.index);
    return `<button class="button button-quiet" type="button" data-governance="vote" data-proposal="${escapeHtml(proposal.contractId)}" data-operator="${operator.index}" ${voted ? "disabled" : ""}>${voted ? `Operator ${operator.index} voted` : `Vote as operator ${operator.index}`}</button>`;
  }).join(" ");
  const proposals = network.proposals.length
    ? network.proposals.map((proposal) => `
      <article class="contract-card" data-kind="GovernanceProposal"><span class="contract-card-bar"></span><div>
        <p class="contract-name">${escapeHtml(describeAction(proposal.action))}</p>
        <p class="contract-detail"><strong>${proposal.votes.length} of ${proposal.threshold}</strong> operator approvals · proposed for rules v${proposal.rulesVersion}${proposal.stale ? " · <strong>stale</strong>" : ""}</p>
        <div class="form-actions">${operatorButtons(proposal)} <button class="button button-primary" type="button" data-governance="execute" data-proposal="${escapeHtml(proposal.contractId)}">Execute</button></div>
      </div><code class="contract-cid">${escapeHtml(shortCid(proposal.contractId))}</code></article>`).join("")
    : `<div class="empty-state">No open proposals.</div>`;
  const allFinanciers = financierRoles();
  return `
    <form class="action-form" data-action="propose">
      <div class="form-grid">
        <div class="field"><label for="proposalType">Change</label><select id="proposalType" name="type" required>
          <option value="AdmitFinancier">Admit financier</option>
          <option value="RemoveFinancier">Remove financier</option>
          <option value="SetMaxAdvanceRate">Set maximum advance rate</option>
        </select></div>
        <div class="field"><label for="proposalFinancier">Financier</label><select id="proposalFinancier" name="financierRole">${financierOptions(allFinanciers)}</select></div>
        <div class="field"><label for="proposalRate">Rate</label><input id="proposalRate" name="rate" inputmode="decimal" placeholder="0.90" /></div>
        <div class="field"><label for="proposalOperator">Proposed by</label><select id="proposalOperator" name="operatorIndex">${network.operators.map((operator) => `<option value="${operator.index}">Operator ${operator.index}</option>`).join("")}</select></div>
      </div>
      <div class="form-actions"><button class="button button-secondary" type="submit">Propose change</button><span class="form-note">${network.threshold} of ${network.operators.length} operators must vote before anyone can execute it.</span></div>
    </form>
    <div class="action-divider"></div>
    <div class="contracts-list">${proposals}</div>
  `;
}

function describeAction(action) {
  if (action.type === "AdmitFinancier") return `Admit ${roleLabel(action.financierRole || "a financier")}`;
  if (action.type === "RemoveFinancier") return `Remove ${roleLabel(action.financierRole || "a financier")}`;
  if (action.type === "SetMaxAdvanceRate") return `Set maximum advance rate to ${amount(action.rate)}`;
  if (action.type === "OnboardBuyer") return "Onboard the buyer";
  return action.type;
}

function auditorActionMarkup() {
  return `<div class="empty-action"><strong>Auditor mode is read-only.</strong><br />The contract list below is the proof: funding receipts and repayment receipts with amounts and cash references.</div>`;
}

function renderContracts() {
  const contracts = state.contracts[state.role] || [];
  $("contractsTitle").textContent = `${roleLabel(state.role)} visible contracts`;
  $("contractCount").textContent = String(contracts.length);
  if (!contracts.length) {
    $("contractsList").innerHTML = `<div class="empty-state">No active contracts are visible to ${escapeHtml(roleLabel(state.role))} yet.</div>`;
    return;
  }
  $("contractsList").innerHTML = contracts.map(contractCard).join("");
}

function contractCard(contract) {
  const name = templateName(contract);
  const detail = contractDetail(name, argument(contract));
  return `<article class="contract-card" data-kind="${escapeHtml(name)}"><span class="contract-card-bar"></span><div><p class="contract-name">${escapeHtml(displayTemplate(name))}</p><p class="contract-detail">${detail}</p></div><code class="contract-cid">${escapeHtml(shortCid(contractId(contract)))}</code></article>`;
}

function displayTemplate(name) {
  return {
    NetworkRules: "Network rules",
    GovernanceCommittee: "Governance committee",
    GovernanceProposal: "Governance proposal",
    GovernanceVote: "Operator vote",
    BuyerApprovalRegistry: "Buyer approval registry",
    InvoiceDraft: "Invoice draft",
    ApprovedInvoice: "Approved invoice · one-use seal",
    FundingSlot: "Funding slot · one-use",
    FinancingOffer: "Private financing offer",
    OfferClosed: "Offer closed",
    PendingFunding: "Funding lock · cash in flight",
    FundingReceipt: "Funding receipt",
    FinancedInvoice: "Financed invoice",
    PendingRepayment: "Repayment lock · cash in flight",
    RepaymentReceipt: "Repayment receipt",
    InvoiceDetails: "Private invoice details",
  }[name] || name;
}

function contractDetail(name, arg) {
  if (name === "NetworkRules") return `v${escapeHtml(arg.version)} · maximum advance <strong>${escapeHtml(amount(arg.maxAdvanceRate))}</strong> · ${(arg.financiers || []).length} financier(s)`;
  if (name === "GovernanceCommittee") return `${escapeHtml(arg.threshold)} of ${(arg.operators || []).length} operators must agree`;
  if (name === "GovernanceProposal") return escapeHtml(describeAction({ type: arg.action?.tag, rate: arg.action?.value, financierRole: roleForParty(arg.action?.value) }));
  if (name === "GovernanceVote") return `For rules v${escapeHtml(arg.rulesVersion)}`;
  if (name === "BuyerApprovalRegistry") return `<strong>${escapeHtml((arg.approvedInvoiceNumbers || []).length)}</strong> approved external invoice number(s)`;
  if (name === "InvoiceDraft") return `<strong>${escapeHtml(arg.terms?.externalInvoiceNumber || "Draft")}</strong> · ${escapeHtml(amount(arg.terms?.faceValue))} ${escapeHtml(arg.terms?.currency || "")}`;
  if (name === "ApprovedInvoice") return "Approved once · terms appear only in each private offer";
  if (name === "FundingSlot") return "Terms-free shared state · the first successful claim wins";
  if (name === "FinancingOffer") return `<strong>${escapeHtml(arg.terms?.externalInvoiceNumber || "")}</strong> · ${escapeHtml(amount(arg.advance))} advance at ${escapeHtml(amount(arg.advanceRate))}`;
  if (name === "OfferClosed") return "<strong>This invoice is no longer available.</strong> No winner, amount or terms disclosed.";
  if (name === "PendingFunding") return `<strong>${escapeHtml(amount(arg.settlementAmount))} ${escapeHtml(arg.instrument || "")}</strong> locked · tracking ${escapeHtml(shortCid(arg.trackingId))}`;
  if (name === "FundingReceipt") return `<strong>${escapeHtml(amount(arg.settlementAmount))} ${escapeHtml(arg.instrument || "")}</strong> · cash reference ${escapeHtml(shortCid(arg.paymentReference))}`;
  if (name === "FinancedInvoice") return `<strong>${escapeHtml(arg.terms?.externalInvoiceNumber || "Invoice")}</strong> · ${escapeHtml(amount(arg.advance))} funded`;
  if (name === "PendingRepayment") return `<strong>${escapeHtml(amount(arg.settlementAmount))} ${escapeHtml(arg.instrument || "")}</strong> repayment locked`;
  if (name === "RepaymentReceipt") return `<strong>${escapeHtml(amount(arg.amount))} ${escapeHtml(arg.instrument || "")}</strong> · ${escapeHtml(arg.repaymentDate || "")}${arg.early ? " · early" : ""}`;
  if (name === "InvoiceDetails") return "Private terms visible only to the buyer, supplier and auditor";
  return "Active on the Canton ledger";
}

function renderPrivacy() {
  const copy = isFinancier(state.role)
    ? [["Offers addressed to you, with their terms", true], ["Which financiers were eligible for an invoice", true], ["Another financier's offer, price or win", false]]
    : {
      supplier: [["Invoice drafts and approvals", true], ["Every offer you made", true], ["Financier books outside your invoices", false]],
      buyer: [["Approved supplier invoices", true], ["Your approval registry", true], ["Financier books", false]],
      auditor: [["Funding and repayment receipts", true], ["Amounts and cash references", true], ["Operational control actions", false]],
      operator: [["Network rules and proposals", true], ["Approved invoice numbers (registry)", true], ["Invoice terms, offers and prices", false]],
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

// ------------------------------------------------------------------ actions

async function handleAction(form) {
  const data = new FormData(form);
  const value = (name) => String(data.get(name) || "").trim();
  const action = form.dataset.action;
  setLoading(true);
  try {
    let result;
    if (action === "create-draft") {
      result = await api("/api/v1/invoices/drafts", { method: "POST", body: JSON.stringify({ terms: { externalInvoiceNumber: value("externalInvoiceNumber"), faceValue: value("faceValue"), currency: value("currency"), issuedDate: value("issuedDate"), dueDate: value("dueDate") } }) });
      state.currentStep = "draft";
      await loadRole("supplier");
      setResult(successFrom(result, "DRAFT CREATED", "The draft is visible to the supplier and buyer only."));
    } else if (action === "approve") {
      const eligibleFinancierRoles = data.getAll("eligible").map(String);
      result = await api(`/api/v1/invoices/drafts/${encodeURIComponent(value("draftCid"))}/approve`, { method: "POST", body: JSON.stringify({ eligibleFinancierRoles }) });
      state.currentStep = "approved";
      await loadNetwork();
      await loadRole("buyer");
      setResult(successFrom(result, "APPROVED ONCE", "The invoice is sealed with an on-ledger commitment, and its one-use funding slot is live."));
    } else if (action === "create-offer") {
      result = await api(`/api/v1/invoices/approved/${encodeURIComponent(value("approvedCid"))}/offers`, { method: "POST", body: JSON.stringify({ financierRole: value("financierRole"), advance: value("advance"), advanceRate: value("advanceRate") }) });
      state.currentStep = "offered";
      await loadRole("supplier");
      setResult(successFrom(result, "OFFER CREATED", "Only the named financier and the invoice parties can see this offer."));
    } else if (action === "fund") {
      result = await api(`/api/v1/offers/${encodeURIComponent(value("offerCid"))}/fund`, { method: "POST", body: JSON.stringify({ financierRole: state.role }) });
      state.currentStep = "funded";
      await loadRole(state.role);
      setResult({ kind: "success", status: "FUNDED ONCE", message: "Canton Coin moved and the invoice's one-use state was consumed.", updateId: result.updateId, cashUpdateId: result.cashTransfer?.updateId });
    } else if (action === "repay") {
      result = await api(`/api/v1/financed/${encodeURIComponent(value("financedCid"))}/settle-repay`, { method: "POST", body: JSON.stringify({ repaymentDate: value("repaymentDate") }) });
      state.currentStep = "repaid";
      await loadRole("buyer");
      setResult({ kind: "success", status: "REPAID", message: "Canton Coin repayment and its receipt are recorded.", updateId: result.updateId, cashUpdateId: result.cashTransfer?.updateId });
    } else if (action === "propose") {
      const type = value("type");
      const proposal = type === "SetMaxAdvanceRate" ? { type, rate: value("rate") } : { type, financierRole: value("financierRole") };
      result = await api("/api/v1/governance/proposals", { method: "POST", body: JSON.stringify({ operatorIndex: value("operatorIndex"), action: proposal }) });
      await loadNetwork();
      setResult(successFrom(result, "PROPOSED", "The change waits for operator votes. Nothing has changed yet."));
    }
  } catch (error) {
    setResult({ kind: "failure", status: error.code === "INVOICE_UNAVAILABLE" ? "SECOND FUNDING REJECTED" : "ACTION FAILED", message: error.message, reference: error.reference });
  } finally {
    setLoading(false);
  }
}

async function handleGovernance(button) {
  const proposal = button.dataset.proposal;
  setLoading(true);
  try {
    if (button.dataset.governance === "vote") {
      const operatorIndex = button.dataset.operator;
      const result = await api(`/api/v1/governance/proposals/${encodeURIComponent(proposal)}/votes`, { method: "POST", body: JSON.stringify({ operatorIndex }) });
      await loadNetwork();
      setResult(successFrom(result, "VOTE RECORDED", `Operator ${operatorIndex} approved the change.`));
    } else {
      const result = await api(`/api/v1/governance/proposals/${encodeURIComponent(proposal)}/execute`, { method: "POST", body: JSON.stringify({ operatorIndex: "1" }) });
      await loadNetwork();
      setResult(successFrom(result, "RULES CHANGED", "Enough operators agreed; the ledger replaced the network rules."));
    }
    await loadRole("operator");
  } catch (error) {
    await loadNetwork().catch(() => {});
    setResult({ kind: "failure", status: error.code === "GOVERNANCE_THRESHOLD_NOT_MET" ? "BELOW THRESHOLD" : "ACTION FAILED", message: error.message, reference: error.reference });
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
  $("refreshButton").addEventListener("click", loadSelectedRole);
  $("actionPanel").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.loading) handleAction(event.target);
  });
  $("actionPanel").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-governance]");
    if (button && !state.loading) handleGovernance(button);
  });
}

async function start() {
  bindEvents();
  renderRoleButtons();
  render();
  await loadSelectedRole();
}

start();
