import assert from "node:assert/strict";
import test from "node:test";
import { getDiagnosisFunctionErrorMessage } from "./diagnosisFunctionErrors.ts";

const responseError = (status, body) => ({
  message: "Edge Function returned a non-2xx status code",
  context: {
    status,
    clone() {
      return { json: async () => body };
    },
  },
});

test("explains missing deployment and authentication failures", async () => {
  assert.match(
    await getDiagnosisFunctionErrorMessage(responseError(404, { code: "NOT_FOUND" })),
    /not deployed/i,
  );
  assert.match(
    await getDiagnosisFunctionErrorMessage(responseError(401, { error: "Token expired" })),
    /Token expired/,
  );
});

test("preserves server safety warnings and has a useful malformed-response fallback", async () => {
  assert.match(
    await getDiagnosisFunctionErrorMessage(responseError(503, {
      error: "Temporarily offline",
      urgentWarning: "Stop driving and move away from traffic.",
    })),
    /Temporarily offline[\s\S]*Safety warning: Stop driving/,
  );
  assert.match(
    await getDiagnosisFunctionErrorMessage(responseError(500, null)),
    /temporarily unavailable/i,
  );
});