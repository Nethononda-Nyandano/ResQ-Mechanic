import assert from "node:assert/strict";
import test from "node:test";
import { getActionErrorMessage } from "./actionErrorMessage.ts";

test("uses an available provider error message", () => {
  assert.equal(getActionErrorMessage(new Error("Request failed"), "Try again."), "Request failed");
  assert.equal(getActionErrorMessage({ message: "Offline" }, "Try again."), "Offline");
  assert.equal(getActionErrorMessage("Unavailable", "Try again."), "Unavailable");
});

test("uses the fallback when the error has no readable message", () => {
  assert.equal(getActionErrorMessage(null, "Try again."), "Try again.");
  assert.equal(getActionErrorMessage({ message: "  " }, "Try again."), "Try again.");
});