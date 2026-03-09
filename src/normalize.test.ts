import test from "node:test";
import assert from "node:assert/strict";

import { normalizeReview } from "./normalize.js";

test("normalizeReview coerces mixed types into deterministic values", () => {
  const normalized = normalizeReview({
    _id: "abc123",
    is_active: "0",
    step: "3",
    software_id: "507f1f77bcf86cd799439011",
    software_name: "  D5 Render ",
    software_slug: " d5-render ",
    user_id: " 42 ",
    features: { category: [" Rendering ", "  "] },
    use_in_time: "10",
    use_time_format: "Months",
    frequent_use: "Monthly",
    software_pricing: "Mid Tier",
    is_integrated: "I don't know",
    switched_from: "No",
    integrate_software: [" Slack "],
    used_software: [],
    title: " Nice ",
    summary: "  Useful review text  ",
    strength: [" Fast ", " Stable "],
    weakness: { first: "Few assets" },
    ease_of_use: "5",
    features_functionality: 4,
    customer_support: "3",
    overall: "4",
    client_name: " Jane Doe ",
    client_email: " Jane@Example.com ",
    client_company_name: " Acme ",
    position: " Manager ",
    location: " US ",
    hidden_identity: 2,
  });

  assert.equal(normalized.isActive, 0);
  assert.equal(normalized.step, 3);
  assert.equal(normalized.useTimeFormat, "months");
  assert.equal(normalized.frequentUse, "monthly");
  assert.equal(normalized.softwarePricing, "mid-tier");
  assert.equal(normalized.isIntegrated, "other");
  assert.equal(normalized.switchedFrom, "no");
  assert.deepEqual(normalized.categories, ["Rendering"]);
  assert.equal(normalized.strength, "Fast, Stable");
  assert.equal(normalized.weakness, "Few assets");
  assert.equal(normalized.clientEmail, "jane@example.com");
  assert.equal(normalized.hiddenIdentity, "2");
});
