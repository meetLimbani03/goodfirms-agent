import { ReviewData, DailyRun, StatusType, ValidationCheck } from '../types';

export const sampleReview: ReviewData = {
  internalMetadata: {
    projection: 'audit',
    reviewId: '697ef9846787f99046066d12',
    generatedAt: '2026-03-08T14:38:58.944Z',
    status: 'Published (1)',
    statusCode: 1,
    step: 2,
    rejectionReason: null,
    requestToken: null,
    createdAt: '2026-02-01T07:00:54.000Z',
    updatedAt: '2026-02-02T09:51:55.000Z',
  },
  software: {
    softwareId: '6138504701a61606f4286114',
    name: 'D5 Render',
    slug: 'd5-render',
    categories: ['3D Rendering Software'],
  },
  usage: {
    durationValue: 2,
    durationUnit: 'years',
    frequency: 'daily',
    pricing: 'mid-tier',
    integratedOtherSoftware: 'no',
    integratedSoftware: [],
    switchedFromOtherSoftware: 'no',
    usedSoftwareBeforeSwitch: [],
  },
  review: {
    title: 'Easy to work with',
    summary: 'D5 Render has transformed my workflow with fast real-time rendering and stunning visuals. The intuitive interface and rich asset library make it easy to create cinematic presentations that impress clients every time',
    strength: 'What I liked most about D5 Render is its real-time rendering speed combined with cinematic quality. It saves me hours while still delivering visuals that impress clients and make presentations more engaging.',
    weakness: '- I noticed that rendering very heavy scenes can take longer than expected, and occasional crashes disrupt the workflow. Stability improvements would make the experience even better.',
    ratings: {
      easeOfUse: 5,
      featuresFunctionality: 4,
      customerSupport: 4,
      overall: 5,
    },
  },
  reviewer: {
    name: 'Cinno',
    email: 'markedreamer@gmail.com',
    emailDomain: 'gmail.com',
    companyName: null,
    position: null,
    location: null,
    postingPreferenceCode: '1',
    postingPreferenceLabel: 'Display both my name and the company\'s name with the review',
    companyWebsite: null,
    companyWebsiteHost: null,
    profileLink: null,
    profileLinkHost: null,
  },
  accountContext: {
    userId: '435883',
    accountFound: true,
    account: {
      id: 435883,
      type: 'none',
      name: 'Cinno',
      email: 'markedreamer@gmail.com',
      emailDomain: 'gmail.com',
      position: null,
      location: null,
      companyName: null,
      companyWebsite: null,
      companyWebsiteHost: null,
      publicUrl: null,
      publicUrlHost: null,
      totalReviews: 1,
      mergeReviewer: 0,
      isGoodfirmsRegistered: false,
      isSpam: false,
      emailVerifiedAt: 'Sun Feb 01 2026 06:55:50 GMT+0530 (India Standard Time)',
      emailResult: 'pending',
      emailReason: null,
      emailCheckedAt: null,
      googleIdPresent: true,
      socialIdPresent: false,
      inferredLoginMethod: 'google',
      createdAt: 'Sun Feb 01 2026 06:55:50 GMT+0530 (India Standard Time)',
      updatedAt: 'Mon Feb 02 2026 15:21:55 GMT+0530 (India Standard Time)',
    },
    pendingEmailVerificationRecords: [],
  },
  derivedSignals: {
    inferredLoginMethod: 'google',
    authEvidence: [
      'google_id present',
      'email_verified_at=Sun Feb 01 2026 06:55:50 GMT+0530 (India Standard Time)',
    ],
    reviewEmailMatchesAccountEmail: true,
    reviewNameMatchesAccountName: true,
    reviewCompanyMatchesAccountCompany: null,
    vendorConflictHints: [],
    trustSignals: [
      'user email_verified_at present',
    ],
    riskHints: [
      'review missing LinkedIn/profile link',
      'review missing company website',
      'review missing company name',
    ],
  },
  groundTruth: {
    statusLabel: 'Published',
    rejectionReason: null,
    isPending: false,
    isPublished: true,
    isRejected: false,
  },
  provenance: {
    mongoCollection: 'software-reviews',
    relatedMongoCollections: [],
    mySqlDatabase: 'GoodFirms',
    notes: [
      'Review content comes from MongoDB goodfirms.software-reviews.',
      'Reviewer account enrichment comes from local MySQL GoodFirms snapshot/database.',
      'Ground truth is separated so it can be excluded from agent-facing projections.',
    ],
  },
  reviewRecord: {
    mongoId: '697ef9846787f99046066d12',
    statusCode: 1,
    statusLabel: 'Published',
    step: 2,
    rejectionReason: null,
    response: null,
    requestToken: null,
    submittedBy: 1,
    publishDateUnix: 1770025915,
    publishDateIso: '2026-02-02T09:51:55.000Z',
    createdAtUnix: 1769929254,
    createdAtIso: '2026-02-01T07:00:54.000Z',
    updatedAtUnix: 1770025915,
    updatedAtIso: '2026-02-02T09:51:55.000Z',
  },
};

export const additionalReviews: ReviewData[] = [
  {
    ...sampleReview,
    internalMetadata: {
      ...sampleReview.internalMetadata,
      reviewId: '797ef9846787f99046066d13',
      status: 'Pending (0)',
      statusCode: 0,
    },
    software: {
      ...sampleReview.software,
      name: 'Blender',
      slug: 'blender',
      categories: ['3D Modeling Software', 'Animation Software'],
    },
    reviewer: {
      ...sampleReview.reviewer,
      name: 'Alex Johnson',
      email: 'alex.j@example.com',
    },
    groundTruth: {
      ...sampleReview.groundTruth,
      statusLabel: 'Pending',
      isPending: true,
      isPublished: false,
    },
    reviewRecord: {
      ...sampleReview.reviewRecord,
      mongoId: '797ef9846787f99046066d13',
      statusCode: 0,
      statusLabel: 'Pending',
    },
  },
  {
    ...sampleReview,
    internalMetadata: {
      ...sampleReview.internalMetadata,
      reviewId: '897ef9846787f99046066d14',
      status: 'Rejected (2)',
      statusCode: 2,
      rejectionReason: 'Insufficient detail in review',
    },
    software: {
      ...sampleReview.software,
      name: 'SketchUp',
      slug: 'sketchup',
      categories: ['3D Modeling Software'],
    },
    reviewer: {
      ...sampleReview.reviewer,
      name: 'Sarah Chen',
      email: 'sarah.chen@company.com',
    },
    groundTruth: {
      ...sampleReview.groundTruth,
      statusLabel: 'Rejected',
      isPending: false,
      isPublished: false,
      isRejected: true,
      rejectionReason: 'Insufficient detail in review',
    },
    reviewRecord: {
      ...sampleReview.reviewRecord,
      mongoId: '897ef9846787f99046066d14',
      statusCode: 2,
      statusLabel: 'Rejected',
      rejectionReason: 'Insufficient detail in review',
    },
  },
  {
    ...sampleReview,
    internalMetadata: {
      ...sampleReview.internalMetadata,
      reviewId: '997ef9846787f99046066d15',
      status: 'Not Eligible',
      statusCode: -1,
    },
    software: {
      ...sampleReview.software,
      name: 'AutoCAD',
      slug: 'autocad',
      categories: ['CAD Software'],
    },
    reviewer: {
      ...sampleReview.reviewer,
      name: 'Mike Ross',
      email: 'mike.ross@design.net',
    },
    groundTruth: {
      ...sampleReview.groundTruth,
      statusLabel: 'Not Eligible',
      isPending: false,
      isPublished: false,
      isRejected: false,
    },
    reviewRecord: {
      ...sampleReview.reviewRecord,
      mongoId: '997ef9846787f99046066d15',
      statusCode: -1,
      statusLabel: 'Not Eligible',
    },
  },
];

export const getStatusType = (review: ReviewData): StatusType => {
  if (review.groundTruth.isPublished) return 'APPROVED';
  if (review.groundTruth.isRejected) return 'REJECTED';
  if (review.groundTruth.isPending) return 'PENDING';
  return 'NOT_ELIGIBLE';
};

export const getStatusColor = (status: StatusType): string => {
  switch (status) {
    case 'APPROVED':
      return 'bg-[#4CAF50]/20 text-[#4CAF50] border-[#4CAF50]/30';
    case 'REJECTED':
      return 'bg-[#F44336]/20 text-[#F44336] border-[#F44336]/30';
    case 'PENDING':
      return 'bg-[#FFC107]/20 text-[#FFC107] border-[#FFC107]/30';
    case 'NOT_ELIGIBLE':
      return 'bg-[#888888]/20 text-[#888888] border-[#888888]/30';
    default:
      return 'bg-[#888888]/20 text-[#888888] border-[#888888]/30';
  }
};

export const dailyRuns: DailyRun[] = [
  {
    id: 'run-2026-03-08',
    date: '2026-03-08',
    totalReviews: 4,
    newCount: 12,
    eligibleCount: 8,
    approvedCount: 1,
    rejectedCount: 1,
    reviews: [sampleReview, ...additionalReviews],
  },
  {
    id: 'run-2026-03-07',
    date: '2026-03-07',
    totalReviews: 6,
    newCount: 15,
    eligibleCount: 10,
    approvedCount: 3,
    rejectedCount: 2,
    reviews: [additionalReviews[0], additionalReviews[1]],
  },
  {
    id: 'run-2026-03-06',
    date: '2026-03-06',
    totalReviews: 3,
    newCount: 8,
    eligibleCount: 5,
    approvedCount: 2,
    rejectedCount: 1,
    reviews: [additionalReviews[2]],
  },
];

export const getValidationChecks = (review: ReviewData): ValidationCheck[] => [
  { name: 'Email Verification', status: review.accountContext.account.emailVerifiedAt ? 'PASS' : 'FAIL', details: review.accountContext.account.emailVerifiedAt || 'Not verified' },
  { name: 'Account Match', status: review.derivedSignals.reviewEmailMatchesAccountEmail ? 'PASS' : 'FLAG', details: review.derivedSignals.reviewEmailMatchesAccountEmail ? 'Email matches account' : 'Email mismatch' },
  { name: 'Name Match', status: review.derivedSignals.reviewNameMatchesAccountName ? 'PASS' : 'FLAG', details: review.derivedSignals.reviewNameMatchesAccountName ? 'Name matches account' : 'Name mismatch' },
  { name: 'Vendor Conflict', status: review.derivedSignals.vendorConflictHints.length === 0 ? 'PASS' : 'FAIL', details: review.derivedSignals.vendorConflictHints.length === 0 ? 'No conflicts detected' : review.derivedSignals.vendorConflictHints.join(', ') },
  { name: 'Trust Signals', status: review.derivedSignals.trustSignals.length > 0 ? 'PASS' : 'FLAG', details: review.derivedSignals.trustSignals.join(', ') || 'No trust signals' },
];

export const getPrechecks = (review: ReviewData): ValidationCheck[] => [
  { name: 'Content Length', status: review.review.summary.length > 50 ? 'PASS' : 'FLAG', details: `${review.review.summary.length} characters` },
  { name: 'Has Strengths', status: review.review.strength.length > 20 ? 'PASS' : 'FLAG', details: review.review.strength.substring(0, 50) + '...' },
  { name: 'Has Weaknesses', status: review.review.weakness.length > 20 ? 'PASS' : 'FLAG', details: review.review.weakness.substring(0, 50) + '...' },
  { name: 'Valid Ratings', status: review.review.ratings.overall > 0 ? 'PASS' : 'FAIL', details: `Overall: ${review.review.ratings.overall}/5` },
];
