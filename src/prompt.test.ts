import test from "node:test";
import assert from "node:assert/strict";

import { buildAnalysisPrompt } from "./prompt.js";
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

test("buildAnalysisPrompt includes instructions and normalized review payload", () => {
  const prompt = buildAnalysisPrompt(makeReview());

  assert.match(prompt, /Instructions:/);
  assert.match(prompt, /gibberish, authenticity, spam, pii, safety, consistency, specificity/);
  assert.match(prompt, /"review_type": "software"/);
  assert.match(prompt, /"posting_preference": "Only display my name with the review"/);
});
