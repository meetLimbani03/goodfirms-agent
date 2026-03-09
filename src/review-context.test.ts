import test from "node:test";
import assert from "node:assert/strict";

import {
  projectReviewContext,
  renderReviewContextMarkdown,
  type ReviewContext,
} from "./review-context.js";

function makeContext(): ReviewContext {
  return {
    contextVersion: "2026-03-08",
    generatedAt: "2026-03-08T00:00:00.000Z",
    reviewType: "software",
    reviewId: "507f1f77bcf86cd799439011",
    reviewRecord: {
      mongoId: "507f1f77bcf86cd799439011",
      statusCode: 2,
      statusLabel: "Rejected",
      step: 3,
      rejectionReason: "Unable to verify the reviewer",
      response: null,
      requestToken: null,
      submittedBy: null,
      publishDateUnix: null,
      publishDateIso: null,
      createdAtUnix: 1700000000,
      createdAtIso: "2023-11-14T22:13:20.000Z",
      updatedAtUnix: 1700003600,
      updatedAtIso: "2023-11-14T23:13:20.000Z",
    },
    software: {
      softwareId: "soft-1",
      name: "D5 Render",
      slug: "d5-render",
      categories: ["Rendering"],
    },
    usage: {
      durationValue: 6,
      durationUnit: "months",
      frequency: "daily",
      pricing: "mid-tier",
      integratedOtherSoftware: "yes",
      integratedSoftware: ["Slack"],
      switchedFromOtherSoftware: "no",
      usedSoftwareBeforeSwitch: [],
    },
    reviewContent: {
      title: "Useful software",
      summary: "It saves us time.",
      strength: "Fast",
      weakness: "Limited library",
      ratings: {
        easeOfUse: 4,
        featuresFunctionality: 4,
        customerSupport: 4,
        overall: 4,
      },
    },
    reviewerProfile: {
      name: "Jane Doe",
      email: "jane@example.com",
      emailDomain: "example.com",
      companyName: "Acme",
      position: "Designer",
      location: "us",
      postingPreferenceCode: "2",
      postingPreferenceLabel: "Only display my name with the review",
      companyWebsite: "https://acme.test",
      companyWebsiteHost: "acme.test",
      profileLink: "https://linkedin.com/in/jane",
      profileLinkHost: "linkedin.com",
    },
    accountContext: {
      userId: "42",
      accountFound: true,
      account: {
        id: 42,
        type: "company",
        name: "Jane Doe",
        email: "jane@example.com",
        emailDomain: "example.com",
        position: "Designer",
        location: "us",
        companyName: "Acme",
        companyWebsite: "https://acme.test",
        companyWebsiteHost: "acme.test",
        publicUrl: "https://linkedin.com/in/jane",
        publicUrlHost: "linkedin.com",
        totalReviews: 1,
        mergeReviewer: 0,
        isGoodfirmsRegistered: true,
        isSpam: false,
        emailVerifiedAt: "2026-02-01 00:00:00",
        emailResult: "accepted_email",
        emailReason: null,
        emailCheckedAt: "2026-02-01 00:00:00",
        googleIdPresent: true,
        socialIdPresent: false,
        inferredLoginMethod: "google",
        createdAt: "2026-02-01 00:00:00",
        updatedAt: "2026-02-01 00:00:00",
      },
      pendingEmailVerificationRecords: [],
    },
    requestContext: {
      found: false,
      request: null,
    },
    derivedSignals: {
      inferredLoginMethod: "google",
      authEvidence: ["google_id present"],
      reviewEmailMatchesAccountEmail: true,
      reviewNameMatchesAccountName: true,
      reviewCompanyMatchesAccountCompany: true,
      vendorConflictHints: [],
      trustSignals: ["user is_goodfirms_registered=1"],
      riskHints: [],
    },
    groundTruth: {
      statusLabel: "Rejected",
      rejectionReason: "Unable to verify the reviewer",
      isPending: false,
      isPublished: false,
      isRejected: true,
    },
    provenance: {
      mongoCollection: "software-reviews",
      relatedMongoCollections: [],
      mySqlDatabase: "GoodFirms",
      notes: ["test"],
    },
  };
}

test("agent projection omits ground truth", () => {
  const projection = projectReviewContext(makeContext(), "agent");
  assert.equal("ground_truth" in projection, false);
  assert.equal("review_record" in projection, false);
});

test("audit markdown includes projected payload and ground truth", () => {
  const markdown = renderReviewContextMarkdown(makeContext(), "audit");
  assert.match(markdown, /# Software Review Context/);
  assert.match(markdown, /## Agent Payload Projection/);
  assert.match(markdown, /## Ground Truth/);
  assert.match(markdown, /Unable to verify the reviewer/);
});
