import "dotenv/config";

export type Role =
  | "supplier"
  | "buyer"
  | "financierA"
  | "financierB"
  | "auditor"
  | "governance";

export interface PartyConfig {
  supplier: string;
  buyer: string;
  financierA: string;
  financierB: string;
  auditor: string;
  governance: string;
}

export interface TavrynConfig {
  ledgerApiUrl: string;
  ledgerApiToken?: string;
  userId?: string;
  synchronizerId?: string;
  participantId?: string;
  packageId?: string;
  httpPort: number;
  demoAccessToken?: string;
  demoPassphrase?: string;
  writeRateLimit: number;
  parties: PartyConfig;
  governance: GovernanceConfig;
  settlement: SettlementConfig;
}

export interface GovernanceConfig {
  operatorPartyIds: string[];
  threshold?: number;
  candidatePartyId?: string;
}

export interface SettlementConfig {
  cantonCoinSymbol?: string;
  validatorApiUrl?: string;
  walletTokens: {
    buyer?: string;
    financierA?: string;
    financierB?: string;
  };
  transferExpirySeconds: number;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment value: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function requiredPort(name: string): number {
  const value = required(name);
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer TCP port`);
  }
  return port;
}

function optionalPositiveInteger(name: string, fallback: number): number {
  const value = optional(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function optionalPositiveIntegerOrUndefined(name: string): number | undefined {
  const value = optional(name);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function loadConfig(): TavrynConfig {
  const demoAccessToken = optional("TAVRYN_DEMO_ACCESS_TOKEN");
  return {
    ledgerApiUrl: required("CANTON_LEDGER_API_URL").replace(/\/+$/, ""),
    ledgerApiToken: optional("CANTON_LEDGER_API_TOKEN"),
    userId: optional("CANTON_USER_ID"),
    synchronizerId: optional("CANTON_SYNCHRONIZER_ID"),
    participantId: optional("CANTON_PARTICIPANT_ID"),
    packageId: optional("CANTON_PACKAGE_ID"),
    httpPort: requiredPort("TAVRYN_HTTP_PORT"),
    demoAccessToken,
    demoPassphrase: optional("TAVRYN_DEMO_PASSPHRASE") ?? demoAccessToken,
    writeRateLimit: optionalPositiveInteger("TAVRYN_WRITE_RATE_LIMIT", 30),
    parties: {
      supplier: required("SUPPLIER_PARTY_ID"),
      buyer: required("BUYER_PARTY_ID"),
      financierA: required("FINANCIER_A_PARTY_ID"),
      financierB: required("FINANCIER_B_PARTY_ID"),
      auditor: required("AUDITOR_PARTY_ID"),
      governance: required("GOVERNANCE_PARTY_ID"),
    },
    governance: {
      operatorPartyIds: [
        optional("GOVERNANCE_OPERATOR_ONE_PARTY_ID"),
        optional("GOVERNANCE_OPERATOR_TWO_PARTY_ID"),
        optional("GOVERNANCE_OPERATOR_THREE_PARTY_ID"),
      ].filter((value): value is string => Boolean(value)),
      threshold: optionalPositiveIntegerOrUndefined("GOVERNANCE_THRESHOLD"),
      candidatePartyId: optional("GOVERNANCE_CANDIDATE_PARTY_ID"),
    },
    settlement: {
      cantonCoinSymbol: optional("CANTON_COIN_SYMBOL"),
      validatorApiUrl: optional("CANTON_VALIDATOR_API_URL")?.replace(/\/+$/, ""),
      walletTokens: {
        buyer: optional("CANTON_WALLET_TOKEN_BUYER"),
        financierA: optional("CANTON_WALLET_TOKEN_FINANCIER_A"),
        financierB: optional("CANTON_WALLET_TOKEN_FINANCIER_B"),
      },
      transferExpirySeconds: optionalPositiveInteger(
        "CANTON_TRANSFER_EXPIRY_SECONDS",
        300,
      ),
    },
  };
}

export function partyForRole(config: TavrynConfig, role: Role): string {
  return config.parties[role];
}

export function isRole(value: string): value is Role {
  return (
    value === "supplier" ||
    value === "buyer" ||
    value === "financierA" ||
    value === "financierB" ||
    value === "auditor" ||
    value === "governance"
  );
}
