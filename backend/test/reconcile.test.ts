import assert from "node:assert/strict";
import { test } from "node:test";

import { reconcileDecision } from "../src/reconcile.js";

const lockedAt = new Date("2026-10-05T12:00:00Z");
const at = (seconds: number) => new Date(lockedAt.getTime() + seconds * 1000);

test("a found transfer always completes", () => {
  assert.equal(
    reconcileDecision({ transferFound: true, lockedAt, now: at(10_000), transferExpirySeconds: 300 }),
    "complete",
  );
});

test("no transfer before expiry plus margin stays pending", () => {
  assert.equal(
    reconcileDecision({ transferFound: false, lockedAt, now: at(300 + 59), transferExpirySeconds: 300 }),
    "pending",
  );
});

test("no transfer after expiry plus margin cancels", () => {
  assert.equal(
    reconcileDecision({ transferFound: false, lockedAt, now: at(300 + 61), transferExpirySeconds: 300 }),
    "cancel",
  );
});
