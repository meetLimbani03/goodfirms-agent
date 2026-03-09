import type { NormalizedSoftwareReview, PrecheckOptions, PrecheckResult } from "./types.js";

const REQUIRED_TIME_FORMATS = new Set(["days", "week", "months", "years"]);
const REQUIRED_USAGE_FREQUENCIES = new Set(["daily", "weekly", "monthly", "yearly"]);
const REQUIRED_PRICING = new Set(["inexpensive", "mid-tier", "expensive"]);
const REQUIRED_YES_NO_OTHER = new Set(["yes", "no", "other"]);
const REQUIRED_HIDDEN_IDENTITY = new Set(["1", "2", "3", "4"]);

const PLACEHOLDER_WORDS = new Set([
  "n/a",
  "na",
  "none",
  "null",
  "test",
  "testing",
  "sample",
  "dummy",
  "-",
  "--",
]);

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isRepeatedToken(value: string): boolean {
  return /^(\w+)(\s+\1){2,}$/i.test(value);
}

function isJunkPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (PLACEHOLDER_WORDS.has(normalized)) {
    return true;
  }

  if (/^[\W_]+$/.test(normalized)) {
    return true;
  }

  if (/(.)\1{5,}/.test(normalized) || isRepeatedToken(normalized)) {
    return true;
  }

  return false;
}

function addCheck(result: PrecheckResult, label: string, passed: boolean): void {
  if (passed) {
    result.passed.push(label);
    return;
  }

  result.failed.push(label);
}

export function runPrechecks(
  review: NormalizedSoftwareReview,
  options: PrecheckOptions = {},
): PrecheckResult {
  const result: PrecheckResult = {
    eligible: false,
    passed: [],
    failed: [],
  };

  // Test mode only bypasses the lifecycle-status gate; every other validation still runs.
  if (options.skipStatusCheck) {
    result.passed.push("review status gate skipped in test mode");
  } else {
    addCheck(result, "review is pending", review.isActive === 0);
  }
  addCheck(result, "review step is at least 2", (review.step ?? 0) >= 2);
  addCheck(result, "software name is present", review.softwareName.length > 0);
  addCheck(result, "software slug is present", review.softwareSlug.length > 0);
  addCheck(result, "user id is present", review.userId.length > 0);
  addCheck(result, "at least one category exists", review.categories.length > 0);
  addCheck(result, "use_in_time is > 0", (review.useInTime ?? 0) > 0);
  addCheck(result, "use_time_format is valid", REQUIRED_TIME_FORMATS.has(review.useTimeFormat));
  addCheck(result, "frequent_use is valid", REQUIRED_USAGE_FREQUENCIES.has(review.frequentUse));
  addCheck(result, "software_pricing is valid", REQUIRED_PRICING.has(review.softwarePricing));
  addCheck(result, "is_integrated is valid", REQUIRED_YES_NO_OTHER.has(review.isIntegrated));
  addCheck(result, "switched_from is valid", REQUIRED_YES_NO_OTHER.has(review.switchedFrom));

  // Conditional arrays must be enforced next to their source enums so failures stay obvious in logs.
  addCheck(
    result,
    "integrate_software exists when integration is yes",
    review.isIntegrated !== "yes" || review.integrateSoftware.length > 0,
  );
  addCheck(
    result,
    "used_software exists when switched_from is yes",
    review.switchedFrom !== "yes" || review.usedSoftware.length > 0,
  );

  addCheck(result, "title is present", review.title.length > 0 && !isJunkPlaceholder(review.title));
  addCheck(result, "summary is present", review.summary.length > 0 && !isJunkPlaceholder(review.summary));
  addCheck(result, "strength is present", review.strength.length > 0 && !isJunkPlaceholder(review.strength));
  addCheck(result, "weakness is present", review.weakness.length > 0 && !isJunkPlaceholder(review.weakness));

  addCheck(result, "ease_of_use is between 1 and 5", isRating(review.easeOfUse));
  addCheck(result, "features_functionality is between 1 and 5", isRating(review.featuresFunctionality));
  addCheck(result, "customer_support is between 1 and 5", isRating(review.customerSupport));
  addCheck(result, "overall is between 1 and 5", isRating(review.overall));

  addCheck(
    result,
    "client_name is present and plausible",
    review.clientName.length > 0 && !isJunkPlaceholder(review.clientName),
  );
  addCheck(result, "client_email is valid", review.clientEmail.length > 0 && isEmail(review.clientEmail));
  addCheck(
    result,
    "client_company_name is present and plausible",
    review.clientCompanyName.length > 0 && !isJunkPlaceholder(review.clientCompanyName),
  );
  addCheck(
    result,
    "position is present and plausible",
    review.position.length > 0 && !isJunkPlaceholder(review.position),
  );
  addCheck(
    result,
    "location is present and plausible",
    review.location.length > 0 && !isJunkPlaceholder(review.location),
  );
  addCheck(result, "hidden_identity is valid", REQUIRED_HIDDEN_IDENTITY.has(review.hiddenIdentity));

  result.eligible = result.failed.length === 0;
  return result;
}

function isRating(value: number | null): boolean {
  return value !== null && value >= 1 && value <= 5;
}
