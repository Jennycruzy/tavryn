import { config as loadDotenv } from "dotenv";

// TAVRYN_ENV_FILE selects another environment file (for example `.env.devnet`); the
// default stays `.env` so LocalNet runs are unchanged.
loadDotenv({ path: process.env.TAVRYN_ENV_FILE?.trim() || ".env" });

export type FinancierRole = string;
export type Role = "supplier" | "buyer" | "auditor" | "operator" | FinancierRole;

export interface PartyConfig {
  supplier: string;
  buyer: string;
  auditor: string;
}

export interface OidcConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  refreshToken?: string;
  audience?: string;
  scope?: string;
}

export interface TavrynConfig {
  ledgerApiUrl: string;
  ledgerApiToken?: string;
  oidc?: OidcConfig;
  userId?: string;
  synchronizerId?: string;
  participantId?: string;
  packageId?: string;
  // Role views show invoice activity created at or after this ledger offset, so a demo
  // can start from a clean page without archiving anything. Unset shows everything.
  viewFromOffset?: number;
  networkId: string;
  httpPort: number;
  demoAccessToken?: string;
  demoPassphrase?: string;
  writeRateLimit: number;
  parties: PartyConfig;
  // Ordered role → party map, for example financierA, financierB, financierC.
  financiers: Map<FinancierRole, string>;
  governance: GovernanceConfig;
  settlement: SettlementConfig;
}

export interface GovernanceConfig {
  operatorPartyIds: string[];
  threshold: number;
  initialMaxAdvanceRate: string;
  // Financier roles admitted when the network is first bootstrapped.
  initialFinancierRoles: FinancierRole[];
}

export interface SettlementConfig {
  cantonCoinSymbol?: string;
  validatorApiUrl?: string;
  walletTokens: Map<string, string>;
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

// TAVRYN_FINANCIERS=financierA:<party>,financierB:<party>,financierC:<party>. The older
// FINANCIER_A/B_PARTY_ID and GOVERNANCE_CANDIDATE_PARTY_ID values remain a fallback.
function loadFinanciers(): Map<FinancierRole, string> {
  const financiers = new Map<FinancierRole, string>();
  const configured = optional("TAVRYN_FINANCIERS");
  if (configured) {
    for (const entry of configured.split(",")) {
      const separator = entry.indexOf(":");
      const role = entry.slice(0, separator).trim();
      const party = entry.slice(separator + 1).trim();
      if (separator < 1 || !party || !/^financier[A-Z]$/.test(role)) {
        throw new Error("TAVRYN_FINANCIERS entries must look like financierA:<party-id>");
      }
      financiers.set(role, party);
    }
  } else {
    financiers.set("financierA", required("FINANCIER_A_PARTY_ID"));
    financiers.set("financierB", required("FINANCIER_B_PARTY_ID"));
    const candidate = optional("GOVERNANCE_CANDIDATE_PARTY_ID");
    if (candidate) financiers.set("financierC", candidate);
  }
  if (financiers.size < 2) {
    throw new Error("At least two financiers must be configured");
  }
  return financiers;
}

function loadOidc(): OidcConfig | undefined {
  const tokenUrl = optional("CANTON_OIDC_TOKEN_URL");
  if (!tokenUrl) return undefined;
  const oidc: OidcConfig = {
    tokenUrl,
    clientId: required("CANTON_OIDC_CLIENT_ID"),
    clientSecret: optional("CANTON_OIDC_CLIENT_SECRET"),
    username: optional("CANTON_OIDC_USERNAME"),
    password: optional("CANTON_OIDC_PASSWORD"),
    refreshToken: optional("CANTON_OIDC_REFRESH_TOKEN"),
    audience: optional("CANTON_OIDC_AUDIENCE"),
    scope: optional("CANTON_OIDC_SCOPE"),
  };
  if (!oidc.refreshToken && !(oidc.username && oidc.password) && !oidc.clientSecret) {
    throw new Error(
      "CANTON_OIDC_TOKEN_URL needs a refresh token, a username and password, or a client secret",
    );
  }
  return oidc;
}

export function loadConfig(): TavrynConfig {
  const demoAccessToken = optional("TAVRYN_DEMO_ACCESS_TOKEN");
  const financiers = loadFinanciers();
  const operatorPartyIds = [
    optional("GOVERNANCE_OPERATOR_ONE_PARTY_ID"),
    optional("GOVERNANCE_OPERATOR_TWO_PARTY_ID"),
    optional("GOVERNANCE_OPERATOR_THREE_PARTY_ID"),
  ].filter((value): value is string => Boolean(value));
  if (operatorPartyIds.length < 2) {
    throw new Error("At least two governance operator parties must be configured");
  }
  const threshold = optionalPositiveInteger("GOVERNANCE_THRESHOLD", 2);
  if (threshold > operatorPartyIds.length) {
    throw new Error("GOVERNANCE_THRESHOLD cannot exceed the configured operator count");
  }
  const initialFinancierRoles = (optional("TAVRYN_INITIAL_FINANCIERS") ?? "financierA,financierB")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
  for (const role of initialFinancierRoles) {
    if (!financiers.has(role)) {
      throw new Error(`TAVRYN_INITIAL_FINANCIERS names an unconfigured financier: ${role}`);
    }
  }

  const walletTokens = new Map<string, string>();
  const buyerToken = optional("CANTON_WALLET_TOKEN_BUYER");
  if (buyerToken) walletTokens.set("buyer", buyerToken);
  for (const role of financiers.keys()) {
    const suffix = role.slice("financier".length);
    const token = optional(`CANTON_WALLET_TOKEN_FINANCIER_${suffix}`);
    if (token) walletTokens.set(role, token);
  }

  return {
    ledgerApiUrl: required("CANTON_LEDGER_API_URL").replace(/\/+$/, ""),
    ledgerApiToken: optional("CANTON_LEDGER_API_TOKEN"),
    oidc: loadOidc(),
    userId: optional("CANTON_USER_ID"),
    synchronizerId: optional("CANTON_SYNCHRONIZER_ID"),
    participantId: optional("CANTON_PARTICIPANT_ID"),
    packageId: optional("CANTON_PACKAGE_ID"),
    viewFromOffset: optional("TAVRYN_VIEW_FROM_OFFSET")
      ? optionalPositiveInteger("TAVRYN_VIEW_FROM_OFFSET", 1)
      : undefined,
    networkId: optional("TAVRYN_NETWORK_ID") ?? "tavryn",
    httpPort: requiredPort("TAVRYN_HTTP_PORT"),
    demoAccessToken,
    demoPassphrase: optional("TAVRYN_DEMO_PASSPHRASE") ?? demoAccessToken,
    writeRateLimit: optionalPositiveInteger("TAVRYN_WRITE_RATE_LIMIT", 30),
    parties: {
      supplier: required("SUPPLIER_PARTY_ID"),
      buyer: required("BUYER_PARTY_ID"),
      auditor: required("AUDITOR_PARTY_ID"),
    },
    financiers,
    governance: {
      operatorPartyIds,
      threshold,
      initialMaxAdvanceRate: optional("TAVRYN_INITIAL_MAX_ADVANCE_RATE") ?? "0.95",
      initialFinancierRoles,
    },
    settlement: {
      cantonCoinSymbol: optional("CANTON_COIN_SYMBOL"),
      validatorApiUrl: optional("CANTON_VALIDATOR_API_URL")?.replace(/\/+$/, ""),
      walletTokens,
      transferExpirySeconds: optionalPositiveInteger("CANTON_TRANSFER_EXPIRY_SECONDS", 300),
    },
  };
}

export function isFinancierRole(config: TavrynConfig, value: string): boolean {
  return config.financiers.has(value);
}

export function isRole(config: TavrynConfig, value: string): value is Role {
  return (
    value === "supplier" ||
    value === "buyer" ||
    value === "auditor" ||
    value === "operator" ||
    isFinancierRole(config, value)
  );
}

export function partyForRole(config: TavrynConfig, role: Role): string {
  if (role === "supplier" || role === "buyer" || role === "auditor") {
    return config.parties[role];
  }
  if (role === "operator") {
    return config.governance.operatorPartyIds[0];
  }
  const financier = config.financiers.get(role);
  if (!financier) {
    throw new Error(`Unknown role: ${role}`);
  }
  return financier;
}

export function roleForFinancierParty(
  config: TavrynConfig,
  party: string,
): FinancierRole | undefined {
  for (const [role, financier] of config.financiers) {
    if (financier === party) return role;
  }
  return undefined;
}
