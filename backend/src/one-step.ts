import type { ActiveContract, CoinHolding, LedgerApi, SubmissionResult } from "./ledger-api.js";

// One-step funding (package 0.1.6): the lender pays the supplier from its OWN coins
// through the Canton token standard, and the invoice is recorded as financed in the
// same transaction. Only the lender's party acts, so a lender on its own node can run
// it alone. The registry (the coin's issuer, reached through the node's scan proxy)
// supplies the transfer factory and the contracts the transfer needs.

export class OneStepFundingError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

interface FactoryResponse {
  factoryId: string;
  transferKind: string;
  choiceContext: {
    choiceContextData: unknown;
    disclosedContracts: { templateId: string; contractId: string; createdEventBlob: string; synchronizerId?: string }[];
  };
}

export interface OneStepPayment {
  ledger: SubmissionResult;
  amount: string;
  sender: string;
  receiver: string;
}

export class OneStepFunding {
  private dso?: string;

  constructor(
    private readonly ledger: LedgerApi,
    private readonly validatorApiUrl: string,
  ) {}

  // The registry admin of Canton Coin. Offers pin it, so only that coin can fund them.
  async coinAdmin(): Promise<string> {
    if (!this.dso) {
      const response = await this.ledger.validator<{ dso_party_id: string }>(this.validatorApiUrl, "/v0/scan-proxy/dso-party-id");
      this.dso = response.dso_party_id;
    }
    return this.dso;
  }

  async coins(party: string): Promise<CoinHolding[]> {
    const admin = await this.coinAdmin();
    return (await this.ledger.holdings(party))
      .filter((holding) => !holding.locked && holding.instrument.admin === admin && holding.instrument.id === "Amulet")
      .sort((a, b) => Number(b.amount) - Number(a.amount));
  }

  async balance(party: string): Promise<number> {
    return (await this.coins(party)).reduce((sum, holding) => sum + Number(holding.amount), 0);
  }

  async fund(input: {
    offer: ActiveContract;
    approvedInvoiceCid: string;
    rulesCid: string;
    financier: string;
    supplier: string;
    amount: string;
    coinAdmin: string;
    readAs: string[];
  }): Promise<OneStepPayment> {
    const admin = await this.coinAdmin();
    if (input.coinAdmin !== admin) {
      throw new OneStepFundingError("This offer names a different coin than the network's Canton Coin.", "COIN_MISMATCH");
    }
    // Fewest, largest coins that cover the advance.
    const inputs: string[] = [];
    let covered = 0;
    for (const holding of await this.coins(input.financier)) {
      if (covered >= Number(input.amount)) break;
      inputs.push(holding.contractId);
      covered += Number(holding.amount);
    }
    if (covered < Number(input.amount)) {
      throw new OneStepFundingError(
        `This lender's wallet holds ${covered.toFixed(2)} coins, less than the ${input.amount} advance.`,
        "LENDER_BALANCE_LOW",
      );
    }

    const now = Date.now();
    const requestedAt = isoSeconds(now - 30_000);
    const executeBefore = isoSeconds(now + 10 * 60_000);
    const transfer = {
      sender: input.financier,
      receiver: input.supplier,
      amount: input.amount,
      instrumentId: { admin, id: "Amulet" },
      requestedAt,
      executeBefore,
      inputHoldingCids: inputs,
      meta: { values: {} },
    };
    const factory = await this.ledger.validator<FactoryResponse>(
      this.validatorApiUrl,
      "/v0/scan-proxy/registry/transfer-instruction/v1/transfer-factory",
      {
        choiceArguments: { expectedAdmin: admin, transfer, extraArgs: { context: { values: {} }, meta: { values: {} } } },
        excludeDebugFields: true,
      },
    );
    if (factory.transferKind !== "direct") {
      // Without a transfer preapproval the coin would wait for the supplier to accept it,
      // and the invoice must never be marked financed before the money has landed.
      throw new OneStepFundingError(
        "The supplier's wallet cannot receive coins in one step yet.",
        "SUPPLIER_CANNOT_RECEIVE",
      );
    }

    const ledger = await this.ledger.submit(
      [{
        ExerciseCommand: {
          templateId: this.ledger.qualify("#tavryn-network:Tavryn.Contracts:FinancingOffer"),
          contractId: input.offer.contractId,
          choice: "FundNow",
          choiceArgument: {
            approvedInvoiceCid: input.approvedInvoiceCid,
            rulesCid: input.rulesCid,
            transferFactoryCid: factory.factoryId,
            inputHoldingCids: inputs,
            requestedAt,
            executeBefore,
            extraArgs: { context: factory.choiceContext.choiceContextData, meta: { values: {} } },
          },
        },
      }],
      [input.financier],
      input.readAs,
      factory.choiceContext.disclosedContracts.map((contract) => ({
        templateId: contract.templateId,
        contractId: contract.contractId,
        createdEventBlob: contract.createdEventBlob,
        ...(contract.synchronizerId ? { synchronizerId: contract.synchronizerId } : {}),
      })),
    );
    return { ledger, amount: input.amount, sender: input.financier, receiver: input.supplier };
  }
}

function isoSeconds(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
}
