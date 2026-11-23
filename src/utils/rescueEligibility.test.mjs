import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleForRescueRequest } from "./rescueEligibility.ts";

const mechanicServices = ["tow", "diagnostics"];

test("offers a registered request to an available mechanic", () => {
  assert.equal(isEligibleForRescueRequest({
    rescueType: "diagnostics",
    serviceTypes: mechanicServices,
    mechanicStatus: "online",
    hasActiveJob: false,
  }), true);
});

test("does not offer services the mechanic did not register for", () => {
  assert.equal(isEligibleForRescueRequest({
    rescueType: "fuel",
    serviceTypes: mechanicServices,
    mechanicStatus: "online",
    hasActiveJob: false,
  }), false);
});

test("does not offer work while offline, busy, or already on a job", () => {
  for (const mechanicStatus of ["offline", "busy"]) {
    assert.equal(isEligibleForRescueRequest({
      rescueType: "tow",
      serviceTypes: mechanicServices,
      mechanicStatus,
      hasActiveJob: false,
    }), false);
  }
  assert.equal(isEligibleForRescueRequest({
    rescueType: "tow",
    serviceTypes: mechanicServices,
    mechanicStatus: "online",
    hasActiveJob: true,
  }), false);
});