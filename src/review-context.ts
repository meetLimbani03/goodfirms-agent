import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AppConfig } from "./config.js";
import { loadReviewerAccountContext, type ReviewerAccountRecord } from "./mysql.js";
import {
  loadSoftwareCategoryNames,
  loadSoftwareNamesByIds,
  loadSoftwareReviewById,
  loadSoftwareReviewRequestContext,
} from "./mongo.js";
import { normalizeReview } from "./normalize.js";
import type {
  NormalizedSoftwareReview,
  SoftwareReviewDocument,
  SoftwareReviewRequestDocument,
} from "./types.js";
import {
  extractEmailDomain,
  extractUrlHost,
  nowIso,
  nullableText,
  postingPreferenceText,
  stringsEqualLoose,
  unixSecondsToIso,
} from "./utils.js";

export type ReviewContextProjection = "agent" | "audit" | "evaluation";
export type InferredLoginMethod = "google" | "linkedin" | "email_legacy" | "unknown";

export interface ReviewContext {
  contextVersion: string;
  generatedAt: string;
  reviewType: "software";
  reviewId: string;
  reviewRecord: {
    mongoId: string;
    statusCode: number | null;
    statusLabel: string;
    step: number | null;
    rejectionReason: string | null;
    response: string | null;
    requestToken: string | null;
    submittedBy: number | null;
    publishDateUnix: number | null;
    publishDateIso: string | null;
    createdAtUnix: number | null;
    createdAtIso: string | null;
    updatedAtUnix: number | null;
    updatedAtIso: string | null;
  };
  software: {
    softwareId: string;
    name: string;
    slug: string;
    categories: string[];
  };
  usage: {
    durationValue: number | null;
    durationUnit: string | null;
    frequency: string | null;
    pricing: string | null;
    integratedOtherSoftware: string | null;
    integratedSoftware: string[];
    switchedFromOtherSoftware: string | null;
    usedSoftwareBeforeSwitch: string[];
  };
  reviewContent: {
    title: string;
    summary: string;
    strength: string;
    weakness: string;
    ratings: {
      easeOfUse: number | null;
      featuresFunctionality: number | null;
      customerSupport: number | null;
      overall: number | null;
    };
  };
  reviewerProfile: {
    name: string;
    email: string;
    emailDomain: string | null;
    companyName: string | null;
    position: string | null;
    location: string | null;
    postingPreferenceCode: string | null;
    postingPreferenceLabel: string | null;
    companyWebsite: string | null;
    companyWebsiteHost: string | null;
    profileLink: string | null;
    profileLinkHost: string | null;
  };
  accountContext: {
    userId: string;
    accountFound: boolean;
    account: null | {
      id: number;
      type: string | null;
      name: string | null;
      email: string;
      emailDomain: string | null;
      position: string | null;
      location: string | null;
      companyName: string | null;
      companyWebsite: string | null;
      companyWebsiteHost: string | null;
      publicUrl: string | null;
      publicUrlHost: string | null;
      totalReviews: number | null;
      mergeReviewer: number;
      isGoodfirmsRegistered: boolean;
      isSpam: boolean;
      emailVerifiedAt: string | null;
      emailResult: string;
      emailReason: string | null;
      emailCheckedAt: string | null;
      googleIdPresent: boolean;
      socialIdPresent: boolean;
      inferredLoginMethod: InferredLoginMethod;
      createdAt: string;
      updatedAt: string;
    };
    pendingEmailVerificationRecords: Array<{
      id: number;
      email: string;
      token: string;
      createdAt: string;
      updatedAt: string;
    }>;
  };
  requestContext: {
    found: boolean;
    request: null | {
      token: string | null;
      name: string | null;
      email: string | null;
      phone: string | null;
      adminRequest: number | null;
      event: string | null;
      error: string | null;
      requestSentUnix: number | null;
      requestSentIso: string | null;
      createdAtUnix: number | null;
      createdAtIso: string | null;
      updatedAtUnix: number | null;
      updatedAtIso: string | null;
    };
  };
  derivedSignals: {
    inferredLoginMethod: InferredLoginMethod;
    authEvidence: string[];
    reviewEmailMatchesAccountEmail: boolean | null;
    reviewNameMatchesAccountName: boolean | null;
    reviewCompanyMatchesAccountCompany: boolean | null;
    vendorConflictHints: string[];
    trustSignals: string[];
    riskHints: string[];
  };
  groundTruth: {
    statusLabel: string;
    rejectionReason: string | null;
    isPending: boolean;
    isPublished: boolean;
    isRejected: boolean;
  };
  provenance: {
    mongoCollection: "software-reviews";
    relatedMongoCollections: string[];
    mySqlDatabase: string;
    notes: string[];
  };
}

export async function buildReviewContext(
  config: AppConfig,
  reviewId: string,
): Promise<ReviewContext> {
  const rawReview = await loadSoftwareReviewById(config.mongoUri, reviewId);
  if (!rawReview) {
    throw new Error(`Software review not found: ${reviewId}`);
  }

  return buildReviewContextFromDocument(config, rawReview);
}

export async function buildReviewContextFromDocument(
  config: AppConfig,
  rawReview: SoftwareReviewDocument,
): Promise<ReviewContext> {
  const normalizedReview = normalizeReview(rawReview);
  const requestToken = readNullableRawText(rawReview.requesttoken);

  const [requestRecord, reviewerAccountContext, categoryNames, softwareNamesById] = await Promise.all([
    loadSoftwareReviewRequestContext(config.mongoUri, normalizedReview.id, requestToken),
    loadReviewerAccountContext(config.mySql, normalizedReview.userId),
    loadSoftwareCategoryNames(config.mongoUri, normalizedReview.categories),
    loadSoftwareNamesByIds(config.mongoUri, [
      ...normalizedReview.integrateSoftware,
      ...normalizedReview.usedSoftware,
    ]),
  ]);

  const account = reviewerAccountContext.account;
  const inferredLoginMethod = account
    ? inferLoginMethod(Boolean(account.googleId), Boolean(account.socialId))
    : "unknown";
  const vendorConflictHints = buildVendorConflictHints(normalizedReview, account);
  const trustSignals = buildTrustSignals(normalizedReview, account, requestRecord);
  const riskHints = buildRiskHints(normalizedReview, account, reviewerAccountContext.unverifiedEmails);

  return {
    contextVersion: "2026-03-08",
    generatedAt: nowIso(),
    reviewType: "software",
    reviewId: normalizedReview.id,
    reviewRecord: {
      mongoId: normalizedReview.id,
      statusCode: normalizedReview.isActive,
      statusLabel: statusLabel(normalizedReview.isActive),
      step: normalizedReview.step,
      rejectionReason: readNullableRawText(rawReview.reason),
      response: readNullableRawText(rawReview.response),
      requestToken,
      submittedBy: readNullableRawNumber(rawReview.submitted_by),
      publishDateUnix: readNullableRawNumber(rawReview.publish_date),
      publishDateIso: unixSecondsToIso(readNullableRawNumber(rawReview.publish_date)),
      createdAtUnix: normalizedReview.createdAt,
      createdAtIso: unixSecondsToIso(normalizedReview.createdAt),
      updatedAtUnix: normalizedReview.updatedAt,
      updatedAtIso: unixSecondsToIso(normalizedReview.updatedAt),
    },
    software: {
      softwareId: normalizedReview.softwareId,
      name: normalizedReview.softwareName,
      slug: normalizedReview.softwareSlug,
      categories: categoryNames.length > 0 ? categoryNames : normalizedReview.categories,
    },
    usage: {
      durationValue: normalizedReview.useInTime,
      durationUnit: nullableText(normalizedReview.useTimeFormat),
      frequency: nullableText(normalizedReview.frequentUse),
      pricing: nullableText(normalizedReview.softwarePricing),
      integratedOtherSoftware: nullableText(normalizedReview.isIntegrated),
      integratedSoftware: replaceIdsWithNames(normalizedReview.integrateSoftware, softwareNamesById),
      switchedFromOtherSoftware: nullableText(normalizedReview.switchedFrom),
      usedSoftwareBeforeSwitch: replaceIdsWithNames(normalizedReview.usedSoftware, softwareNamesById),
    },
    reviewContent: {
      title: normalizedReview.title,
      summary: normalizedReview.summary,
      strength: normalizedReview.strength,
      weakness: normalizedReview.weakness,
      ratings: {
        easeOfUse: normalizedReview.easeOfUse,
        featuresFunctionality: normalizedReview.featuresFunctionality,
        customerSupport: normalizedReview.customerSupport,
        overall: normalizedReview.overall,
      },
    },
    reviewerProfile: {
      name: normalizedReview.clientName,
      email: normalizedReview.clientEmail,
      emailDomain: extractEmailDomain(normalizedReview.clientEmail),
      companyName: nullableText(normalizedReview.clientCompanyName),
      position: nullableText(normalizedReview.position),
      location: nullableText(normalizedReview.location),
      postingPreferenceCode: nullableText(normalizedReview.hiddenIdentity),
      postingPreferenceLabel: nullableText(postingPreferenceText(normalizedReview.hiddenIdentity)),
      companyWebsite: nullableText(normalizedReview.clientCompanyWebsite),
      companyWebsiteHost: extractUrlHost(normalizedReview.clientCompanyWebsite),
      profileLink: nullableText(normalizedReview.clientProfileLink),
      profileLinkHost: extractUrlHost(normalizedReview.clientProfileLink),
    },
    accountContext: {
      userId: normalizedReview.userId,
      accountFound: account !== null,
      account: account
        ? {
            id: account.id,
            type: account.type,
            name: account.name,
            email: account.email,
            emailDomain: extractEmailDomain(account.email),
            position: account.position,
            location: account.location,
            companyName: account.companyName,
            companyWebsite: account.companyWebsite,
            companyWebsiteHost: extractUrlHost(account.companyWebsite ?? ""),
            publicUrl: account.publicUrl,
            publicUrlHost: extractUrlHost(account.publicUrl ?? ""),
            totalReviews: account.totalReviews,
            mergeReviewer: account.mergeReviewer,
            isGoodfirmsRegistered: account.isGoodfirmsRegistered,
            isSpam: account.isSpam,
            emailVerifiedAt: account.emailVerifiedAt,
            emailResult: account.emailResult,
            emailReason: account.emailReason,
            emailCheckedAt: account.emailCheckedAt,
            googleIdPresent: Boolean(account.googleId),
            socialIdPresent: Boolean(account.socialId),
            inferredLoginMethod: inferLoginMethod(Boolean(account.googleId), Boolean(account.socialId)),
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
          }
        : null,
      pendingEmailVerificationRecords: reviewerAccountContext.unverifiedEmails.map((entry) => ({
        id: entry.id,
        email: entry.email,
        token: entry.token,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
    },
    requestContext: {
      found: requestRecord !== null,
      request: requestRecord ? buildRequestSummary(requestRecord) : null,
    },
    derivedSignals: {
      inferredLoginMethod,
      authEvidence: buildAuthEvidence(account),
      reviewEmailMatchesAccountEmail: account
        ? normalizedReview.clientEmail.toLowerCase() === account.email.toLowerCase()
        : null,
      reviewNameMatchesAccountName: account?.name
        ? stringsEqualLoose(normalizedReview.clientName, account.name)
        : null,
      reviewCompanyMatchesAccountCompany:
        normalizedReview.clientCompanyName && account?.companyName
          ? stringsEqualLoose(normalizedReview.clientCompanyName, account.companyName)
          : null,
      vendorConflictHints,
      trustSignals,
      riskHints,
    },
    groundTruth: {
      statusLabel: statusLabel(normalizedReview.isActive),
      rejectionReason: readNullableRawText(rawReview.reason),
      isPending: normalizedReview.isActive === 0,
      isPublished: normalizedReview.isActive === 1,
      isRejected: normalizedReview.isActive === 2,
    },
    provenance: {
      mongoCollection: "software-reviews",
      relatedMongoCollections: requestRecord ? ["software-review-request"] : [],
      mySqlDatabase: config.mySql.database,
      notes: [
        "Review content comes from MongoDB goodfirms.software-reviews.",
        "Reviewer account enrichment comes from local MySQL GoodFirms snapshot/database.",
        "Ground truth is separated so it can be excluded from agent-facing projections.",
      ],
    },
  };
}

export function projectReviewContext(
  context: ReviewContext,
  projection: ReviewContextProjection,
): Record<string, unknown> {
  const baseProjection = {
    context_version: context.contextVersion,
    review_type: context.reviewType,
    review_id: context.reviewId,
    software: context.software,
    usage: context.usage,
    review: context.reviewContent,
    reviewer: context.reviewerProfile,
    account_context: {
      user_id: context.accountContext.userId,
      account_found: context.accountContext.accountFound,
      account: context.accountContext.account
        ? {
            type: context.accountContext.account.type,
            name: context.accountContext.account.name,
            email: context.accountContext.account.email,
            email_domain: context.accountContext.account.emailDomain,
            position: context.accountContext.account.position,
            location: context.accountContext.account.location,
            company_name: context.accountContext.account.companyName,
            company_website: context.accountContext.account.companyWebsite,
            public_url: context.accountContext.account.publicUrl,
            total_reviews: context.accountContext.account.totalReviews,
            is_goodfirms_registered: context.accountContext.account.isGoodfirmsRegistered,
            inferred_login_method: context.accountContext.account.inferredLoginMethod,
          }
        : null,
    },
    request_context: {
      found: context.requestContext.found,
      request: context.requestContext.request
        ? {
            admin_request: context.requestContext.request.adminRequest,
            event: context.requestContext.request.event,
            email: context.requestContext.request.email,
            name: context.requestContext.request.name,
          }
        : null,
    },
    derived_signals: context.derivedSignals,
  };

  if (projection === "agent") {
    return baseProjection;
  }

  if (projection === "evaluation") {
    return {
      ...baseProjection,
      ground_truth: context.groundTruth,
      review_record: context.reviewRecord,
    };
  }

  return {
    ...baseProjection,
    review_record: context.reviewRecord,
    ground_truth: context.groundTruth,
    provenance: context.provenance,
    account_context: context.accountContext,
    request_context: context.requestContext,
  };
}

export function renderReviewContextMarkdown(
  context: ReviewContext,
  projection: ReviewContextProjection,
): string {
  const projected = projectReviewContext(context, projection);
  const lines: string[] = [
    `# Software Review Context`,
    "",
    "## Internal Only Metadata",
    `- Projection: \`${projection}\``,
    `- Review ID: \`${context.reviewId}\``,
    `- Generated At: \`${context.generatedAt}\``,
    `- Status: ${context.reviewRecord.statusLabel} (${context.reviewRecord.statusCode ?? "unknown"})`,
    `- Step: ${context.reviewRecord.step ?? "unknown"}`,
    `- Rejection Reason: ${context.reviewRecord.rejectionReason ?? "none"}`,
    `- Request Token: ${context.reviewRecord.requestToken ?? "none"}`,
    `- Created: ${context.reviewRecord.createdAtIso ?? "unknown"}`,
    `- Updated: ${context.reviewRecord.updatedAtIso ?? "unknown"}`,
    "",
    "## Agent-Visible Summary",
    "",
    "### Software",
    `- Name: ${context.software.name}`,
    `- Slug: ${context.software.slug}`,
    `- Categories: ${context.software.categories.join(", ") || "none"}`,
    "",
    "### Usage",
    `- Duration: ${formatDuration(context.usage.durationValue, context.usage.durationUnit)}`,
    `- Frequency: ${context.usage.frequency ?? "unknown"}`,
    `- Pricing: ${context.usage.pricing ?? "unknown"}`,
    `- Integrated Other Software: ${context.usage.integratedOtherSoftware ?? "unknown"}`,
    `- Integrated Software: ${context.usage.integratedSoftware.join(", ") || "none"}`,
    `- Switched From Other Software: ${context.usage.switchedFromOtherSoftware ?? "unknown"}`,
    `- Used Software Before Switch: ${context.usage.usedSoftwareBeforeSwitch.join(", ") || "none"}`,
    "",
    "### Review Content",
    `- Title: ${context.reviewContent.title || "empty"}`,
    `- Summary: ${context.reviewContent.summary || "empty"}`,
    `- Strength: ${context.reviewContent.strength || "empty"}`,
    `- Weakness: ${context.reviewContent.weakness || "empty"}`,
    `- Ratings: ease_of_use=${context.reviewContent.ratings.easeOfUse ?? "unknown"}, features_functionality=${context.reviewContent.ratings.featuresFunctionality ?? "unknown"}, customer_support=${context.reviewContent.ratings.customerSupport ?? "unknown"}, overall=${context.reviewContent.ratings.overall ?? "unknown"}`,
    "",
    "### Reviewer Profile",
    `- Name: ${context.reviewerProfile.name || "empty"}`,
    `- Email: ${context.reviewerProfile.email || "empty"}`,
    `- Email Domain: ${context.reviewerProfile.emailDomain ?? "unknown"}`,
    `- Company: ${context.reviewerProfile.companyName ?? "empty"}`,
    `- Position: ${context.reviewerProfile.position ?? "empty"}`,
    `- Location: ${context.reviewerProfile.location ?? "empty"}`,
    `- Posting Preference: ${context.reviewerProfile.postingPreferenceLabel ?? "empty"}`,
    `- Company Website: ${context.reviewerProfile.companyWebsite ?? "none"}`,
    `- LinkedIn/Profile Link: ${context.reviewerProfile.profileLink ?? "none"}`,
    "",
    "### Account Context",
    `- User ID: ${context.accountContext.userId || "empty"}`,
    `- Account Found: ${context.accountContext.accountFound ? "yes" : "no"}`,
    `- Inferred Login Method: ${context.derivedSignals.inferredLoginMethod}`,
    `- Trust Signals: ${context.derivedSignals.trustSignals.join("; ") || "none"}`,
    `- Risk Hints: ${context.derivedSignals.riskHints.join("; ") || "none"}`,
    `- Vendor Conflict Hints: ${context.derivedSignals.vendorConflictHints.join("; ") || "none"}`,
    "",
    "## Agent Payload Projection",
    "```json",
    JSON.stringify(projected, null, 2),
    "```",
  ];

  if (projection !== "agent") {
    lines.push(
      "",
      "## Ground Truth",
      `- Status: ${context.groundTruth.statusLabel}`,
      `- Rejection Reason: ${context.groundTruth.rejectionReason ?? "none"}`,
    );
  }

  return lines.join("\n");
}

export async function writeReviewContextMarkdown(
  context: ReviewContext,
  projection: ReviewContextProjection,
  outputDir: string,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });
  const filePath = path.join(outputDir, `${context.reviewId}.${projection}.md`);
  await writeFile(filePath, renderReviewContextMarkdown(context, projection), "utf8");
  return filePath;
}

function buildRequestSummary(request: SoftwareReviewRequestDocument) {
  const requestSentUnix = readNullableRawNumber(request.request_sent);
  const createdAtUnix = readNullableRawNumber(request.created);
  const updatedAtUnix = readNullableRawNumber(request.updated);

  return {
    token: readNullableRawText(request.token),
    name: readNullableRawText(request.name),
    email: readNullableRawText(request.email),
    phone: readNullableRawText(request.phone),
    adminRequest: readNullableRawNumber(request.admin_request),
    event: readNullableRawText(request.event),
    error: readNullableRawText(request.error),
    requestSentUnix,
    requestSentIso: unixSecondsToIso(requestSentUnix),
    createdAtUnix,
    createdAtIso: unixSecondsToIso(createdAtUnix),
    updatedAtUnix,
    updatedAtIso: unixSecondsToIso(updatedAtUnix),
  };
}

function buildAuthEvidence(account: ReviewerAccountRecord | null): string[] {
  if (!account) {
    return ["MySQL reviewer account not found"];
  }

  const evidence: string[] = [];
  if (account.googleId) {
    evidence.push("google_id present");
  }
  if (account.socialId) {
    evidence.push("social_id present");
  }
  if (account.emailVerifiedAt) {
    evidence.push(`email_verified_at=${account.emailVerifiedAt}`);
  }
  if (!account.googleId && !account.socialId) {
    evidence.push("no OAuth ids present; likely legacy email login");
  }

  return evidence;
}

function buildTrustSignals(
  review: NormalizedSoftwareReview,
  account: ReviewerAccountRecord | null,
  request: SoftwareReviewRequestDocument | null,
): string[] {
  const signals: string[] = [];
  if (account?.isGoodfirmsRegistered) {
    signals.push("user is_goodfirms_registered=1");
  }
  if (account?.emailVerifiedAt) {
    signals.push("user email_verified_at present");
  }
  if (request && readNullableRawNumber(request.admin_request) === 1) {
    signals.push("review linked to admin_request invite");
  }
  if (review.clientProfileLink.trim()) {
    signals.push("review includes profile link");
  }
  if (review.clientCompanyWebsite.trim()) {
    signals.push("review includes company website");
  }

  return signals;
}

function buildRiskHints(
  review: NormalizedSoftwareReview,
  account: ReviewerAccountRecord | null,
  unverifiedEmails: Array<{ email: string }>,
): string[] {
  const hints: string[] = [];
  if (!account) {
    hints.push("review user_id does not resolve to a MySQL user row");
  }
  if (unverifiedEmails.length > 0) {
    hints.push(`user has ${unverifiedEmails.length} pending/legacy unverified email record(s)`);
  }
  if (!review.clientProfileLink.trim()) {
    hints.push("review missing LinkedIn/profile link");
  }
  if (!review.clientCompanyWebsite.trim()) {
    hints.push("review missing company website");
  }
  if (!review.clientCompanyName.trim()) {
    hints.push("review missing company name");
  }

  return hints;
}

function buildVendorConflictHints(
  review: NormalizedSoftwareReview,
  account: ReviewerAccountRecord | null,
): string[] {
  const hints: string[] = [];

  if (review.clientCompanyName.trim() && stringsEqualLoose(review.clientCompanyName, review.softwareName)) {
    hints.push("review client_company_name matches reviewed software name");
  }

  if (account?.companyName && stringsEqualLoose(account.companyName, review.softwareName)) {
    hints.push("MySQL account company_name matches reviewed software name");
  }

  const reviewWebsiteHost = extractUrlHost(review.clientCompanyWebsite);
  if (reviewWebsiteHost && review.softwareSlug && reviewWebsiteHost.includes(review.softwareSlug.toLowerCase())) {
    hints.push("review company website host contains software slug");
  }

  return hints;
}

function inferLoginMethod(googleIdPresent: boolean, socialIdPresent: boolean): InferredLoginMethod {
  if (googleIdPresent) {
    return "google";
  }
  if (socialIdPresent) {
    return "linkedin";
  }

  return "email_legacy";
}

function replaceIdsWithNames(values: string[], namesById: Record<string, string>): string[] {
  return values.map((value) => namesById[value] ?? value);
}

function formatDuration(value: number | null, unit: string | null): string {
  if (value === null && !unit) {
    return "unknown";
  }
  if (value === null) {
    return unit ?? "unknown";
  }

  return `${value} ${unit ?? ""}`.trim();
}

function statusLabel(statusCode: number | null): string {
  switch (statusCode) {
    case 0:
      return "Pending";
    case 1:
      return "Published";
    case 2:
      return "Rejected";
    default:
      return "Unknown";
  }
}

function readNullableRawText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function readNullableRawNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}
