import assert from "node:assert/strict";
import test from "node:test";
import { isValidRescueStatusTransition } from "./rescueStatus.ts";

test("allows the mechanic workflow transitions", () => {
  assert.equal(isValidRescueStatusTransition("en_route", "arrived"), true);
  assert.equal(isValidRescueStatusTransition("arrived", "in_progress"), true);
  assert.equal(isValidRescueStatusTransition("in_progress", "completed"), true);
});

test("allows cancelling an active job", () => {
  for (const status of ["assigned", "en_route", "arrived", "in_progress"]) {
    assert.equal(isValidRescueStatusTransition(status, "cancelled"), true);
  }
});

test("rejects stale, repeated, and out-of-order transitions", () => {
  assert.equal(isValidRescueStatusTransition("pending", "arrived"), false);
  assert.equal(isValidRescueStatusTransition("en_route", "completed"), false);
  assert.equal(isValidRescueStatusTransition("completed", "completed"), false);
  assert.equal(isValidRescueStatusTransition("cancelled", "arrived"), false);
});