import type { NormalizedSoftwareReview, SoftwareReviewDocument } from "./types.js";
import {
  normalizeEnum,
  normalizeInteger,
  normalizeLooseStringArray,
  normalizeLooseText,
  normalizeMultiValueText,
  normalizeStringArray,
  normalizeText,
} from "./utils.js";

const USE_TIME_FORMAT_MAP: Record<string, string> = {
  day: "days",
  days: "days",
  week: "week",
  weeks: "week",
  month: "months",
  months: "months",
  year: "years",
  years: "years",
};

const FREQUENT_USE_MAP: Record<string, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly",
};

const SOFTWARE_PRICING_MAP: Record<string, string> = {
  inexpensive: "inexpensive",
  "mid tier": "mid-tier",
  "mid-tier": "mid-tier",
  expensive: "expensive",
};

const YES_NO_OTHER_MAP: Record<string, string> = {
  yes: "yes",
  no: "no",
  other: "other",
  "i don't know": "other",
  "dont know": "other",
  "do not know": "other",
};

const HIDDEN_IDENTITY_MAP: Record<string, string> = {
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
};

export function normalizeReview(document: SoftwareReviewDocument): NormalizedSoftwareReview {
  const features = document.features as { category?: unknown } | undefined;

  // Normalize mixed review field types early so every downstream check can stay deterministic.
  return {
    id: String(document._id ?? ""),
    isActive: normalizeInteger(document.is_active),
    step: normalizeInteger(document.step),
    softwareId: normalizeLooseText(document.software_id),
    softwareName: normalizeText(document.software_name),
    softwareSlug: normalizeText(document.software_slug),
    userId: normalizeText(document.user_id),
    categories: normalizeLooseStringArray(features?.category),
    useInTime: normalizeInteger(document.use_in_time),
    useTimeFormat: normalizeEnum(document.use_time_format, USE_TIME_FORMAT_MAP),
    frequentUse: normalizeEnum(document.frequent_use, FREQUENT_USE_MAP),
    softwarePricing: normalizeEnum(document.software_pricing, SOFTWARE_PRICING_MAP),
    isIntegrated: normalizeEnum(document.is_integrated, YES_NO_OTHER_MAP),
    switchedFrom: normalizeEnum(document.switched_from, YES_NO_OTHER_MAP),
    integrateSoftware: normalizeLooseStringArray(document.integrate_software),
    usedSoftware: normalizeLooseStringArray(document.used_software),
    title: normalizeText(document.title),
    summary: normalizeText(document.summary),
    strength: normalizeMultiValueText(document.strength),
    weakness: normalizeMultiValueText(document.weakness),
    easeOfUse: normalizeInteger(document.ease_of_use),
    featuresFunctionality: normalizeInteger(document.features_functionality),
    customerSupport: normalizeInteger(document.customer_support),
    overall: normalizeInteger(document.overall),
    clientName: normalizeText(document.client_name),
    clientEmail: normalizeText(document.client_email).toLowerCase(),
    clientCompanyName: normalizeText(document.client_company_name),
    position: normalizeText(document.position),
    location: normalizeText(document.location).toLowerCase(),
    hiddenIdentity: normalizeEnum(document.hidden_identity, HIDDEN_IDENTITY_MAP),
    clientCompanyWebsite: normalizeText(document.client_company_website),
    clientProfileLink: normalizeText(document.client_profile_link),
    createdAt: normalizeInteger(document.created),
    updatedAt: normalizeInteger(document.updated),
  };
}
