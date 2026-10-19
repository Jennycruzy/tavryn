import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from "node:crypto";

// Sign in with a Canton wallet (CIP-103 `signMessage`, or Loop's own SDK).
//
// The server issues a one-time message naming the wallet's party. The wallet signs it.
// The server then checks two things with no outside service:
//   1. the signature is valid for the public key the wallet reported, and
//   2. that key is the party's own: a Canton party ID ends with the fingerprint of its
//      namespace key, "1220" + SHA-256(00 00 00 0C || key bytes), the same rule the
//      Canton wallet SDK uses.
// CIP-103 does not fix the encodings, so hex and base64, raw and DER keys are accepted.

const CHALLENGE_SECONDS = 300;
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export class WalletProofError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

export class WalletAuth {
  private readonly used = new Map<string, number>();

  constructor(private readonly secret: Buffer) {}

  challenge(partyId: string): { message: string } {
    assertPartyId(partyId);
    const issued = Math.floor(Date.now() / 1000);
    const nonce = randomBytes(12).toString("hex");
    const tag = this.tag(partyId, issued, nonce);
    return {
      message: [
        "Sign in to Tavryn",
        `Wallet: ${partyId}`,
        `Issued: ${new Date(issued * 1000).toISOString()}`,
        `Nonce: ${issued}.${nonce}.${tag}`,
      ].join("\n"),
    };
  }

  // Returns the party the wallet proved it controls.
  verify(proof: { partyId: string; publicKey: string; signature: string; message: string }): string {
    const { partyId, publicKey, signature, message } = proof;
    assertPartyId(partyId);
    const lines = message.split("\n");
    if (lines[0] !== "Sign in to Tavryn" || lines[1] !== `Wallet: ${partyId}`) {
      throw new WalletProofError("This sign-in message was not issued for that wallet.", "WALLET_PROOF_INVALID");
    }
    const [issuedText, nonce, tag] = (lines[3] ?? "").replace(/^Nonce: /, "").split(".");
    const issued = Number(issuedText);
    const expected = Buffer.from(this.tag(partyId, issued, nonce ?? ""));
    const given = Buffer.from(tag ?? "");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new WalletProofError("This sign-in message was not issued by Tavryn.", "WALLET_PROOF_INVALID");
    }
    const now = Date.now() / 1000;
    if (!(issued <= now + 5 && now - issued <= CHALLENGE_SECONDS)) {
      throw new WalletProofError("The sign-in request expired. Try again.", "WALLET_PROOF_EXPIRED");
    }
    if (this.used.has(nonce)) {
      throw new WalletProofError("This sign-in message was already used.", "WALLET_PROOF_REUSED");
    }

    const key = rawEd25519Key(publicKey);
    if (!key) throw new WalletProofError("The wallet's public key could not be read.", "WALLET_PROOF_INVALID");
    const namespace = partyId.slice(partyId.indexOf("::") + 2);
    const candidates = [key, Buffer.concat([ED25519_SPKI_PREFIX, key])].map(fingerprint);
    if (!candidates.includes(namespace)) {
      throw new WalletProofError("That public key does not belong to this wallet's party.", "WALLET_KEY_MISMATCH");
    }
    const keyObject = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, key]), format: "der", type: "spki" });
    const signed = messageForms(message).some((bytes) =>
      signatureForms(signature).some((sig) => {
        try {
          return verify(null, bytes, keyObject, sig);
        } catch {
          return false;
        }
      }),
    );
    if (!signed) throw new WalletProofError("The wallet's signature did not match.", "WALLET_SIGNATURE_INVALID");

    this.used.set(nonce, issued);
    for (const [old, at] of this.used) if (now - at > CHALLENGE_SECONDS * 2) this.used.delete(old);
    return partyId;
  }

  private tag(partyId: string, issued: number, nonce: string): string {
    return createHmac("sha256", this.secret).update(`wallet|${partyId}|${issued}|${nonce}`).digest("base64url");
  }
}

export function fingerprint(keyBytes: Buffer): string {
  const digest = createHash("sha256").update(Buffer.concat([Buffer.from([0, 0, 0, 12]), keyBytes])).digest("hex");
  return `1220${digest}`;
}

function assertPartyId(partyId: string): void {
  if (!/^[^:\s]{1,185}::1220[0-9a-f]{64}$/.test(partyId)) {
    throw new WalletProofError("That is not a Canton party ID.", "WALLET_PARTY_INVALID");
  }
}

function decodeBytes(text: string): Buffer[] {
  const value = text.trim().replace(/^0x/, "");
  const forms: Buffer[] = [];
  if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) forms.push(Buffer.from(value, "hex"));
  if (/^[A-Za-z0-9+/_-]+=*$/.test(value)) forms.push(Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
  return forms;
}

function rawEd25519Key(text: string): Buffer | undefined {
  for (const bytes of decodeBytes(text)) {
    if (bytes.length === 32) return bytes;
    if (bytes.length === 44 && bytes.subarray(0, 12).equals(ED25519_SPKI_PREFIX)) return bytes.subarray(12);
  }
  return undefined;
}

function signatureForms(text: string): Buffer[] {
  return decodeBytes(text).filter((bytes) => bytes.length === 64);
}

// Wallets differ in what they sign: the text itself, or its SHA-256 hash.
function messageForms(message: string): Buffer[] {
  const text = Buffer.from(message, "utf8");
  return [text, createHash("sha256").update(text).digest()];
}
