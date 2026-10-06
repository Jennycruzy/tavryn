import type { ActiveContract, SubmissionResult } from "./ledger-api.js";
import type { TavrynService } from "./tavryn-service.js";

// The demo race: two lenders' real financing requests are sent to Canton at the same
// moment, and the page shows what Canton decided. Nothing here picks a winner; each
// request goes through the same service call a lender's own button uses.

interface RaceOffer {
  offerContractId: string;
  financierRole: string;
  advance: string;
}

export interface RaceCandidate {
  invoiceNumber: string;
  faceValue: string;
  currency: string;
  dueDate: string;
  offers: RaceOffer[];
}

export interface RaceOutcome {
  financierRole: string;
  status: "funded" | "refused" | "failed";
  code?: string;
  message?: string;
  elapsedMs: number;
  updateId?: string;
  paymentReference?: string;
}

const templateName = (contract: { templateId: string }) => contract.templateId.split(":").pop();
const record = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, any>) : {});

// Invoices with open offers to at least two lenders, newest first.
export async function raceCandidates(service: TavrynService): Promise<RaceCandidate[]> {
  const contracts: ActiveContract[] = await service.contractsForRole("supplier");
  const roleFor = new Map([...service.config.financiers].map(([role, party]) => [party, role]));
  const byInvoice = new Map<string, RaceCandidate & { offset: number }>();
  for (const contract of contracts) {
    if (templateName(contract) !== "FinancingOffer") continue;
    const argument = record(contract.createArgument);
    const terms = record(argument.terms);
    const role = roleFor.get(argument.financier);
    if (!role || typeof terms.externalInvoiceNumber !== "string") continue;
    const key = String(argument.invoiceCommitment);
    const entry = byInvoice.get(key) ?? {
      invoiceNumber: terms.externalInvoiceNumber,
      faceValue: String(terms.faceValue),
      currency: String(terms.currency),
      dueDate: String(terms.dueDate),
      offers: [],
      offset: 0,
    };
    entry.offers.push({ offerContractId: contract.contractId, financierRole: role, advance: String(argument.advance) });
    entry.offset = Math.max(entry.offset, Number(contract.offset ?? 0));
    byInvoice.set(key, entry);
  }
  return [...byInvoice.values()]
    .filter((entry) => new Set(entry.offers.map((offer) => offer.financierRole)).size >= 2)
    .sort((a, b) => b.offset - a.offset)
    .map(({ offset: _offset, ...entry }) => entry);
}

// Both requests start together; Canton commits one funding and rejects the other.
export async function runRace(
  service: TavrynService,
  invoiceNumber: string,
): Promise<{ invoiceNumber: string; outcomes: RaceOutcome[] }> {
  const candidate = (await raceCandidates(service)).find((entry) => entry.invoiceNumber === invoiceNumber);
  if (!candidate) {
    throw Object.assign(new Error("That invoice has no open offers to two lenders."), { publicCode: "RACE_NOT_AVAILABLE" });
  }
  const offers = [...new Map(candidate.offers.map((offer) => [offer.financierRole, offer])).values()].slice(0, 2);
  const onNetwork = candidate.currency === service.config.settlement.cantonCoinSymbol;
  const stamp = Date.now().toString(36).toUpperCase();
  const outcomes = await Promise.all(offers.map(async (offer): Promise<RaceOutcome> => {
    const started = Date.now();
    const paymentReference = onNetwork ? undefined : `RACE-${offer.financierRole.slice(-1)}-${stamp}`;
    try {
      const result = onNetwork
        ? (await service.fundOffer(offer.offerContractId, offer.financierRole)).ledger
        : await service.acceptOffer(offer.offerContractId, offer.financierRole, paymentReference as string);
      return {
        financierRole: offer.financierRole,
        status: "funded",
        elapsedMs: Date.now() - started,
        updateId: (result as SubmissionResult).transaction.updateId,
        paymentReference,
      };
    } catch (error) {
      const code = record(error).publicCode as string | undefined;
      return {
        financierRole: offer.financierRole,
        status: code === "INVOICE_UNAVAILABLE" ? "refused" : "failed",
        code,
        message: error instanceof Error ? error.message : undefined,
        elapsedMs: Date.now() - started,
      };
    }
  }));
  return { invoiceNumber, outcomes };
}

// Demo setup for repeated takes: one invoice created, approved and offered to two lenders,
// each step a normal ledger action for the company it belongs to.
export async function prepareRaceInvoice(service: TavrynService): Promise<RaceCandidate | undefined> {
  const number = `LAG-${Date.now().toString(36).toUpperCase()}`;
  const created = (result: SubmissionResult, entity: string) =>
    result.createdContracts.find((event) => event.templateId.endsWith(`:${entity}`))?.contractId as string;
  const draft = await service.createInvoiceDraft({
    externalInvoiceNumber: number,
    faceValue: "20250000.00",
    currency: "NGN",
    issuedDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10),
  });
  const approved = await service.approveInvoice(created(draft, "InvoiceDraft"), ["financierA", "financierB"]);
  const approvedCid = created(approved, "ApprovedInvoice");
  for (const role of ["financierA", "financierB"]) {
    await service.createOffer(approvedCid, role, "16200000.00", "0.8000");
  }
  return (await raceCandidates(service)).find((entry) => entry.invoiceNumber === number);
}
