import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

// Company accounts. Each account belongs to one company and can only act as that
// company: the server takes the role from the signed-in session, never from the
// request body. Accounts are read from TAVRYN_ACCOUNTS_FILE; without it the server
// runs open, as the integration tests and local development expect.
//
// A demo deployment may publish an account's password on the sign-in page by setting
// `demoPassword`; a real deployment leaves it out.

export interface Account {
  email: string;
  name: string;
  role: string;
  operatorIndex?: string;
  passwordHash: string;
  demoPassword?: string;
}

export interface PublicAccount {
  email: string;
  name: string;
  role: string;
  operatorIndex?: string;
}

interface AccountsFile {
  sessionSecret?: string;
  accounts: Account[];
}

const SESSION_SECONDS = 12 * 60 * 60;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class Accounts {
  private readonly byEmail = new Map<string, Account>();
  private readonly secret: Buffer;

  constructor(file: AccountsFile) {
    for (const account of file.accounts) {
      if (!account.email || !account.name || !account.role || !account.passwordHash) {
        throw new Error("Every account needs email, name, role and passwordHash");
      }
      if (account.role === "operator" && !account.operatorIndex) {
        throw new Error(`Operator account ${account.email} needs an operatorIndex`);
      }
      this.byEmail.set(account.email.toLowerCase(), account);
    }
    // Without a configured secret, sessions end when the server restarts.
    this.secret = file.sessionSecret ? Buffer.from(file.sessionSecret) : randomBytes(32);
  }

  static fromEnvironment(): Accounts | undefined {
    const path = process.env.TAVRYN_ACCOUNTS_FILE?.trim();
    if (!path) return undefined;
    return new Accounts(JSON.parse(readFileSync(path, "utf8")) as AccountsFile);
  }

  signIn(email: string, password: string): { account: PublicAccount; token: string } | undefined {
    const account = this.byEmail.get(email.trim().toLowerCase());
    if (!account || !verifyPassword(password, account.passwordHash)) return undefined;
    const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const payload = `${Buffer.from(account.email.toLowerCase()).toString("base64url")}.${expires}`;
    return { account: publicAccount(account), token: `${payload}.${this.sign(payload)}` };
  }

  fromToken(token: string | undefined): PublicAccount | undefined {
    if (!token) return undefined;
    const [email, expires, signature] = token.split(".");
    if (!email || !expires || !signature) return undefined;
    const expected = Buffer.from(this.sign(`${email}.${expires}`));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
    if (Number(expires) < Date.now() / 1000) return undefined;
    const account = this.byEmail.get(Buffer.from(email, "base64url").toString());
    return account ? publicAccount(account) : undefined;
  }

  demoAccounts(): Array<PublicAccount & { password: string }> {
    return [...this.byEmail.values()]
      .filter((account) => account.demoPassword)
      .map((account) => ({ ...publicAccount(account), password: account.demoPassword as string }));
  }

  sessionSeconds(): number {
    return SESSION_SECONDS;
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }
}

function publicAccount(account: Account): PublicAccount {
  return {
    email: account.email,
    name: account.name,
    role: account.role,
    ...(account.operatorIndex ? { operatorIndex: account.operatorIndex } : {}),
  };
}

export function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
