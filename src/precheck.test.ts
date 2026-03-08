import test from "node:test";
import assert from "node:assert/strict";

import { runPrechecks } from "./precheck.js";
import type { NormalizedSoftwareReview } from "./types.js";

function makeReview(overrides: Partial<NormalizedSoftwareReview> = {}): NormalizedSoftwareReview {
  return {
    id: "abc123",
    isActive: 0,
    step: 3,
    softwareId: "507f1f77bcf86cd799439011",
    softwareName: "D5 Render",
    softwareSlug: "d5-render",
    userId: "42",
    categories: ["Rendering"],
    useInTime: 10,
    useTimeFormat: "months",
    frequentUse: "monthly",
    softwarePricing: "mid-tier",
    isIntegrated: "no",
    switchedFrom: "no",
    integrateSoftware: [],
    usedSoftware: [],
    title: "Reliable rendering tool",
    summary: "It helps me produce client visuals quickly and consistently.",
    strength: "Fast renders and solid asset quality.",
    weakness: "The free library is limited.",
    easeOfUse: 4,
    featuresFunctionality: 4,
    customerSupport: 4,
    overall: 4,
    clientName: "Jane Doe",
    clientEmail: "jane@example.com",
    clientCompanyName: "Acme Studio",
    position: "Designer",
    location: "us",
    hiddenIdentity: "2",
    clientCompanyWebsite: "",
    clientProfileLink: "",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

test("runPrechecks accepts a valid normalized review", () => {
  const result = runPrechecks(makeReview());
  assert.equal(result.eligible, true);
  assert.equal(result.failed.length, 0);
});

test("runPrechecks rejects non-pending reviews in normal mode", () => {
  const result = runPrechecks(makeReview({ isActive: 2 }));
  assert.equal(result.eligible, false);
  assert.ok(result.failed.includes("review is pending"));
});

test("runPrechecks skips only the status gate in test mode", () => {
  const result = runPrechecks(makeReview({ isActive: 2 }), { skipStatusCheck: true });
  assert.equal(result.eligible, true);
  assert.ok(result.passed.includes("review status gate skipped in test mode"));
});

test("runPrechecks rejects obvious placeholders in required identity fields", () => {
  const result = runPrechecks(makeReview({ clientCompanyName: "n/a" }));
  assert.equal(result.eligible, false);
  assert.ok(result.failed.includes("client_company_name is present and plausible"));
});

test("runPrechecks enforces conditional integration arrays", () => {
  const result = runPrechecks(makeReview({ isIntegrated: "yes", integrateSoftware: [] }));
  assert.equal(result.eligible, false);
  assert.ok(result.failed.includes("integrate_software exists when integration is yes"));
});
