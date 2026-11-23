import assert from "node:assert/strict";
import test from "node:test";
import { createDrivingRouteEstimate } from "./routeEstimate.ts";

const routeCoordinates = [[28.04, -26.20], [28.05, -26.21]];

test("accepts measured road metrics and rounds to useful display precision", () => {
  assert.deepEqual(
    createDrivingRouteEstimate({
      coordinates: routeCoordinates,
      distanceMeters: 2480,
      durationSeconds: 421,
      provider: "google",
      trafficAware: true,
    }),
    {
      coordinates: routeCoordinates,
      distanceKm: 2.5,
      durationMinutes: 7,
      provider: "google",
      trafficAware: true,
    },
  );
});

test("rejects missing route geometry or invalid measured metrics", () => {
  assert.equal(
    createDrivingRouteEstimate({
      coordinates: [],
      distanceMeters: 1000,
      durationSeconds: 60,
      provider: "osrm",
      trafficAware: false,
    }),
    null,
  );
  assert.equal(
    createDrivingRouteEstimate({
      coordinates: routeCoordinates,
      distanceMeters: 1000,
      durationSeconds: 0,
      provider: "osrm",
      trafficAware: false,
    }),
    null,
  );
});