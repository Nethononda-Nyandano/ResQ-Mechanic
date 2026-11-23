import assert from "node:assert/strict";
import test from "node:test";
import { claimNotificationEvent } from "./notificationEvents.ts";

test("claims a new event once even when realtime and polling both observe it", () => {
  const seen = new Set();
  assert.equal(claimNotificationEvent(seen, "request-1"), true);
  assert.equal(claimNotificationEvent(seen, "request-1"), false);
});

test("ignores missing event identifiers", () => {
  assert.equal(claimNotificationEvent(new Set(), null), false);
});