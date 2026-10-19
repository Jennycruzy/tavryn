import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";

import { WalletAuth, fingerprint } from "../src/wallet-auth.js";

function wallet(hint = "judge") {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(12);
  return { party: `${hint}::${fingerprint(raw)}`, raw, privateKey };
}

const auth = () => new WalletAuth(Buffer.from("test-secret-test-secret"));

test("a wallet that signs its challenge proves its party", () => {
  const w = wallet();
  const server = auth();
  const { message } = server.challenge(w.party);
  const signature = sign(null, Buffer.from(message), w.privateKey);
  assert.equal(server.verify({ partyId: w.party, publicKey: w.raw.toString("base64"), signature: signature.toString("base64"), message }), w.party);
});

test("hex encodings and hash-signing wallets are accepted", () => {
  const w = wallet();
  const server = auth();
  const { message } = server.challenge(w.party);
  const signature = sign(null, createHash("sha256").update(message).digest(), w.privateKey);
  assert.equal(server.verify({ partyId: w.party, publicKey: w.raw.toString("hex"), signature: signature.toString("hex"), message }), w.party);
});

test("a challenge works once", () => {
  const w = wallet();
  const server = auth();
  const { message } = server.challenge(w.party);
  const proof = { partyId: w.party, publicKey: w.raw.toString("base64"), signature: sign(null, Buffer.from(message), w.privateKey).toString("base64"), message };
  server.verify(proof);
  assert.throws(() => server.verify(proof), { code: "WALLET_PROOF_REUSED" });
});

test("a key that is not the party's own is refused, even with a valid signature", () => {
  const owner = wallet("lender");
  const attacker = wallet("attacker");
  const server = auth();
  const { message } = server.challenge(owner.party);
  const signature = sign(null, Buffer.from(message), attacker.privateKey).toString("base64");
  assert.throws(
    () => server.verify({ partyId: owner.party, publicKey: attacker.raw.toString("base64"), signature, message }),
    { code: "WALLET_KEY_MISMATCH" },
  );
});

test("a wrong signature is refused", () => {
  const w = wallet();
  const server = auth();
  const { message } = server.challenge(w.party);
  const signature = sign(null, Buffer.from(`${message}x`), w.privateKey).toString("base64");
  assert.throws(() => server.verify({ partyId: w.party, publicKey: w.raw.toString("base64"), signature, message }), { code: "WALLET_SIGNATURE_INVALID" });
});

test("a message Tavryn did not issue is refused", () => {
  const w = wallet();
  const server = auth();
  const forged = `Sign in to Tavryn\nWallet: ${w.party}\nIssued: now\nNonce: ${Math.floor(Date.now() / 1000)}.abcd.forged`;
  const signature = sign(null, Buffer.from(forged), w.privateKey).toString("base64");
  assert.throws(() => server.verify({ partyId: w.party, publicKey: w.raw.toString("base64"), signature, message: forged }), { code: "WALLET_PROOF_INVALID" });
});

test("another wallet's challenge cannot be reused", () => {
  const a = wallet("a");
  const b = wallet("b");
  const server = auth();
  const { message } = server.challenge(a.party);
  const signature = sign(null, Buffer.from(message), b.privateKey).toString("base64");
  assert.throws(() => server.verify({ partyId: b.party, publicKey: b.raw.toString("base64"), signature, message }), { code: "WALLET_PROOF_INVALID" });
});
