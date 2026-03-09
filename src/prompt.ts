import type { NormalizedSoftwareReview } from "./types.js";
import { postingPreferenceText } from "./utils.js";

export const ANALYSIS_SYSTEM_PROMPT = [
  "You are a GoodFirms software review analysis model.",
  "Your job is to evaluate whether a normalized review is safe, coherent, authentic-looking, and suitable for enhancement.",
  "Use only the supplied review data.",
  "Do not invent facts, do not rewrite the review, and do not accuse the reviewer of fraud with certainty.",
  "When evidence is partial, prefer FLAGGED instead of a hard rejection.",
  "Return only valid JSON matching the requested schema.",
].join(" ");

const ANALYSIS_INSTRUCTIONS = [
  "Evaluate these checks: gibberish, authenticity, spam, pii, safety, consistency, specificity.",
  "Use check statuses strictly as pass, flag, or fail.",
  "Mark gibberish as fail only when the review text is mostly meaningless, random, or not interpretable as a real review.",
  "Mark authenticity as flag when the review feels exaggerated, suspiciously generic, or weakly supported. Use fail only for strong internal evidence of fabrication or deception in the supplied data.",
  "Mark spam as flag or fail when the text reads like promotion, solicitation, keyword stuffing, or template spam rather than a genuine review.",
  "Mark pii as flag or fail when the review text exposes personal contact details or sensitive identifying information beyond normal reviewer metadata.",
  "Mark safety as fail for abusive, hateful, harassing, threatening, or otherwise unsafe review text.",
  "Mark consistency as flag or fail when the narrative strongly conflicts with the title, strengths, weaknesses, or numeric ratings.",
  "Mark specificity as flag or fail when the review is too generic, vague, or low-information to be useful.",
  "Do not treat duplicate detection as confirmed unless direct comparison evidence is provided. At most, use the spam/authenticity checks to flag templated language.",
  "Choose overall_decision from: PENDING, PROCESSING, APPROVED, PUBLISHED, REJECTED, FLAGGED.",
  "Use PENDING only when the review should wait for a later pass before agent analysis is complete.",
  "Use PROCESSING only when the review is actively being worked and more agent/tool work is still required.",
  "Use APPROVED when the agent accepts the review for progression.",
  "Use PUBLISHED only when the review is already in a final published state.",
  "Use REJECTED when the review should be rejected by the agent.",
  "Use FLAGGED when the review needs human review or the evidence is too mixed for approval.",
  "Set can_enhance to true only when the chosen overall_decision supports safe progression without likely changing facts or legitimizing disallowed content.",
  "Keep reasons concise and evidence-based.",
].join("\n");

export function buildAnalysisPrompt(review: NormalizedSoftwareReview): string {
  const reviewPayload = {
    review_type: "software",
    software: {
      name: review.softwareName,
      slug: review.softwareSlug,
      categories: review.categories,
    },
    usage: {
      duration_value: review.useInTime,
      duration_unit: review.useTimeFormat,
      frequency: review.frequentUse,
      pricing: review.softwarePricing,
      integrated_other_software: review.isIntegrated,
      integrated_software: review.integrateSoftware,
      switched_from_other_software: review.switchedFrom,
      used_software_before_switch: review.usedSoftware,
    },
    review: {
      title: review.title,
      summary: review.summary,
      strength: review.strength,
      weakness: review.weakness,
      ratings: {
        ease_of_use: review.easeOfUse,
        features_functionality: review.featuresFunctionality,
        customer_support: review.customerSupport,
        overall: review.overall,
      },
    },
    reviewer: {
      name: review.clientName,
      email: review.clientEmail,
      company_name: review.clientCompanyName,
      position: review.position,
      location: review.location,
      posting_preference: postingPreferenceText(review.hiddenIdentity),
      company_website: review.clientCompanyWebsite || null,
      profile_link: review.clientProfileLink || null,
    },
    meta: {
      submitted_at_unix: review.createdAt,
      updated_at_unix: review.updatedAt,
    },
  };

  return [
    "Instructions:",
    ANALYSIS_INSTRUCTIONS,
    "",
    "Review data:",
    JSON.stringify(reviewPayload, null, 2),
  ].join("\n");
}
