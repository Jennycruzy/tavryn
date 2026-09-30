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
  parties: PartyConfig;
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

export function loadConfig(): TavrynConfig {
  return {
    ledgerApiUrl: required("CANTON_LEDGER_API_URL").replace(/\/+$/, ""),
    ledgerApiToken: optional("CANTON_LEDGER_API_TOKEN"),
    userId: optional("CANTON_USER_ID"),
    synchronizerId: optional("CANTON_SYNCHRONIZER_ID"),
    participantId: optional("CANTON_PARTICIPANT_ID"),
    packageId: optional("CANTON_PACKAGE_ID"),
    httpPort: requiredPort("TAVRYN_HTTP_PORT"),
    parties: {
      supplier: required("SUPPLIER_PARTY_ID"),
      buyer: required("BUYER_PARTY_ID"),
      financierA: required("FINANCIER_A_PARTY_ID"),
      financierB: required("FINANCIER_B_PARTY_ID"),
      auditor: required("AUDITOR_PARTY_ID"),
      governance: required("GOVERNANCE_PARTY_ID"),
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
