import {
  DailyRun,
  ReviewData,
  ReviewType,
  StatusType,
  ValidationCheck,
} from '../types';

const createBaseReview = (
  reviewType: ReviewType,
  overrides: Partial<ReviewData>
): ReviewData => ({
  reviewType,
  internalMetadata: {
    projection: 'audit',
    reviewId: '697ef9846787f99046066d12',
    generatedAt: '2026-03-08T14:38:58.944Z',
    status: 'Published',
    statusCode: 1,
    step: 2,
    rejectionReason: null,
    requestToken: null,
    createdAt: '2026-02-01T07:00:54.000Z',
    updatedAt: '2026-02-02T09:51:55.000Z',
    ...overrides.internalMetadata,
  },
  subject: {
    subjectId: '6138504701a61606f4286114',
    name: 'D5 Render',
    slug: 'd5-render',
    categories: ['3D Rendering Software'],
    ...overrides.subject,
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
    ...overrides.usage,
  },
  review: {
    title: 'Easy to work with',
    summary:
      'D5 Render has transformed my workflow with fast real-time rendering and stunning visuals. The intuitive interface and rich asset library make it easy to create cinematic presentations that impress clients every time',
    strength:
      'What I liked most about D5 Render is its real-time rendering speed combined with cinematic quality. It saves me hours while still delivering visuals that impress clients and make presentations more engaging.',
    weakness:
      '- I noticed that rendering very heavy scenes can take longer than expected, and occasional crashes disrupt the workflow. Stability improvements would make the experience even better.',
    ratings: {
      easeOfUse: 5,
      featuresFunctionality: 4,
      customerSupport: 4,
      overall: 5,
    },
    ...overrides.review,
  },
  reviewer: {
    name: 'Cinno',
    email: 'markedreamer@gmail.com',
    emailDomain: 'gmail.com',
    companyName: null,
    position: null,
    location: null,
    postingPreferenceCode: '1',
    postingPreferenceLabel: "Display both my name and the company's name with the review",
    companyWebsite: null,
    companyWebsiteHost: null,
    profileLink: null,
    profileLinkHost: null,
    ...overrides.reviewer,
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
      ...overrides.accountContext?.account,
    },
    pendingEmailVerificationRecords:
      overrides.accountContext?.pendingEmailVerificationRecords ?? [],
    ...overrides.accountContext,
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
    trustSignals: ['user email_verified_at present'],
    riskHints: [
      'review missing LinkedIn/profile link',
      'review missing company website',
      'review missing company name',
    ],
    ...overrides.derivedSignals,
  },
  groundTruth: {
    statusLabel: 'Published',
    rejectionReason: null,
    agentStatus: 'PUBLISHED',
    ...overrides.groundTruth,
  },
  provenance: {
    mongoCollection: reviewType === 'SOFTWARE' ? 'software-reviews' : 'service-reviews',
    relatedMongoCollections: [],
    mySqlDatabase: 'GoodFirms',
    notes: [
      `Review content comes from MongoDB goodfirms.${
        reviewType === 'SOFTWARE' ? 'software-reviews' : 'service-reviews'
      }.`,
      'Reviewer account enrichment comes from local MySQL GoodFirms snapshot/database.',
      'Ground truth is separated so it can be excluded from agent-facing projections.',
    ],
    ...overrides.provenance,
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
    ...overrides.reviewRecord,
  },
});

export const getReviewTypeLabel = (reviewType: ReviewType): string =>
  reviewType === 'SOFTWARE' ? 'Software' : 'Service';

export const AGENT_REJECTION_REASONS = [
  'Unable to verify the reviewer',
  'Reviews are accepted only from clients of the company',
  'Reviews are not accepted from former employees',
  'Review has already been published before (edited)',
] as const;

export const sampleSoftwareReview = createBaseReview('SOFTWARE', {});

export const softwareReviews: ReviewData[] = [
  sampleSoftwareReview,
  createBaseReview('SOFTWARE', {
    internalMetadata: {
      reviewId: '707ef9846787f99046066d16',
      status: 'Approved',
      statusCode: 1,
    },
    subject: {
      name: 'Figma',
      slug: 'figma',
      categories: ['Design Software', 'Collaboration Tools'],
    },
    reviewer: {
      name: 'Priya Singh',
      email: 'priya@northgrid.io',
      emailDomain: 'northgrid.io',
      companyName: 'Northgrid',
      position: 'Design Manager',
    },
    groundTruth: {
      statusLabel: 'Approved',
      agentStatus: 'APPROVED',
    },
    reviewRecord: {
      mongoId: '707ef9846787f99046066d16',
      statusCode: 1,
      statusLabel: 'Approved',
    },
  }),
  createBaseReview('SOFTWARE', {
    internalMetadata: {
      reviewId: '797ef9846787f99046066d13',
      status: 'Pending',
      statusCode: 0,
    },
    subject: {
      name: 'Blender',
      slug: 'blender',
      categories: ['3D Modeling Software', 'Animation Software'],
    },
    reviewer: {
      name: 'Alex Johnson',
      email: 'alex.j@example.com',
    },
    groundTruth: {
      statusLabel: 'Pending',
      agentStatus: 'PENDING',
    },
    reviewRecord: {
      mongoId: '797ef9846787f99046066d13',
      statusCode: 0,
      statusLabel: 'Pending',
    },
  }),
  createBaseReview('SOFTWARE', {
    internalMetadata: {
      reviewId: '807ef9846787f99046066d17',
      status: 'Processing',
      statusCode: 3,
    },
    subject: {
      name: 'Notion',
      slug: 'notion',
      categories: ['Knowledge Base Software', 'Productivity Software'],
    },
    reviewer: {
      name: 'Jared Mills',
      email: 'jared@relayops.com',
      emailDomain: 'relayops.com',
      companyName: 'RelayOps',
      position: 'Operations Lead',
    },
    groundTruth: {
      statusLabel: 'Processing',
      agentStatus: 'PROCESSING',
    },
    reviewRecord: {
      mongoId: '807ef9846787f99046066d17',
      statusCode: 3,
      statusLabel: 'Processing',
    },
  }),
  createBaseReview('SOFTWARE', {
    internalMetadata: {
      reviewId: '897ef9846787f99046066d14',
      status: 'Rejected',
      statusCode: 2,
      rejectionReason: AGENT_REJECTION_REASONS[0],
    },
    subject: {
      name: 'SketchUp',
      slug: 'sketchup',
      categories: ['3D Modeling Software'],
    },
    reviewer: {
      name: 'Sarah Chen',
      email: 'sarah.chen@company.com',
    },
    groundTruth: {
      statusLabel: 'Rejected',
      agentStatus: 'REJECTED',
      rejectionReason: AGENT_REJECTION_REASONS[0],
    },
    reviewRecord: {
      mongoId: '897ef9846787f99046066d14',
      statusCode: 2,
      statusLabel: 'Rejected',
      rejectionReason: AGENT_REJECTION_REASONS[0],
    },
  }),
  createBaseReview('SOFTWARE', {
    internalMetadata: {
      reviewId: '997ef9846787f99046066d15',
      status: 'Flagged',
      statusCode: -1,
    },
    subject: {
      name: 'AutoCAD',
      slug: 'autocad',
      categories: ['CAD Software'],
    },
    reviewer: {
      name: 'Mike Ross',
      email: 'mike.ross@design.net',
    },
    groundTruth: {
      statusLabel: 'Flagged',
      agentStatus: 'FLAGGED',
    },
    reviewRecord: {
      mongoId: '997ef9846787f99046066d15',
      statusCode: -1,
      statusLabel: 'Flagged',
    },
  }),
];

export const serviceReviews: ReviewData[] = [
  createBaseReview('SERVICE', {
    internalMetadata: {
      reviewId: 'a97ef9846787f99046066d21',
      status: 'Approved',
      statusCode: 1,
    },
    subject: {
      subjectId: 'service-201',
      name: 'PixelForge Studio',
      slug: 'pixelforge-studio',
      categories: ['UI/UX Design', 'Product Strategy'],
    },
    usage: {
      durationValue: 8,
      durationUnit: 'months',
      frequency: 'weekly',
      pricing: 'premium',
      integratedOtherSoftware: 'n/a',
      integratedSoftware: [],
      switchedFromOtherSoftware: 'n/a',
      usedSoftwareBeforeSwitch: [],
    },
    review: {
      title: 'Reliable design partner',
      summary:
        'PixelForge Studio helped us redesign our onboarding flow and move faster during weekly releases. Their communication was sharp, handoffs were clean, and the team adapted well to shifting priorities.',
      strength:
        'The strongest part of working with PixelForge was their delivery discipline. They came prepared to every review, translated feedback quickly, and made complex interface problems feel manageable.',
      weakness:
        'The only friction was turnaround time for urgent revisions during peak launch weeks. A tighter escalation path for same-day requests would improve the experience.',
    },
    reviewer: {
      name: 'Nora Patel',
      email: 'nora@northpeak.co',
      emailDomain: 'northpeak.co',
      companyName: 'Northpeak',
      position: 'Product Lead',
    },
    groundTruth: {
      statusLabel: 'Approved',
      agentStatus: 'APPROVED',
    },
    reviewRecord: {
      statusCode: 1,
      statusLabel: 'Approved',
    },
  }),
  createBaseReview('SERVICE', {
    internalMetadata: {
      reviewId: 'b97ef9846787f99046066d22',
      status: 'Processing',
      statusCode: 3,
    },
    subject: {
      subjectId: 'service-202',
      name: 'ScaleOps Consulting',
      slug: 'scaleops-consulting',
      categories: ['Cloud Consulting', 'DevOps'],
    },
    usage: {
      durationValue: 1,
      durationUnit: 'year',
      frequency: 'monthly',
      pricing: 'enterprise',
      integratedOtherSoftware: 'n/a',
      integratedSoftware: [],
      switchedFromOtherSoftware: 'n/a',
      usedSoftwareBeforeSwitch: [],
    },
    review: {
      title: 'Good operational clarity',
      summary:
        'ScaleOps Consulting gave us a much cleaner release process and better observability practices. The engagement was structured and useful, especially during incident follow-ups.',
      strength:
        'Their clearest strength was making operational risk visible to non-infrastructure stakeholders. Workshops were practical and the documentation was easy for our internal team to reuse.',
      weakness:
        'Some recommendations felt too generic until the second month, so the onboarding phase could be more tailored to company size and maturity.',
    },
    reviewer: {
      name: 'Marcus Bell',
      email: 'marcus@copperlane.io',
      emailDomain: 'copperlane.io',
      companyName: 'Copperlane',
      position: 'Engineering Manager',
    },
    groundTruth: {
      statusLabel: 'Processing',
      agentStatus: 'PROCESSING',
    },
    reviewRecord: {
      mongoId: 'b97ef9846787f99046066d22',
      statusCode: 3,
      statusLabel: 'Processing',
    },
  }),
  createBaseReview('SERVICE', {
    internalMetadata: {
      reviewId: 'c97ef9846787f99046066d23',
      status: 'Rejected',
      statusCode: 2,
      rejectionReason: AGENT_REJECTION_REASONS[3],
    },
    subject: {
      subjectId: 'service-203',
      name: 'LaunchSprint Media',
      slug: 'launchsprint-media',
      categories: ['Digital Marketing'],
    },
    review: {
      title: 'Strong campaign support',
      summary:
        'LaunchSprint Media drove solid campaign execution and helped our team keep a consistent publishing rhythm across channels during a busy quarter.',
      strength:
        'The agency was responsive and kept every campaign asset organized. Weekly reporting made it easy to see what was changing and where we were wasting spend.',
      weakness:
        'The review draft originally included overly promotional language and direct calls to hire the agency, which made it less useful as neutral buyer feedback.',
    },
    reviewer: {
      name: 'Ethan Cole',
      email: 'ethan@ridgefieldlabs.com',
      emailDomain: 'ridgefieldlabs.com',
      companyName: 'Ridgefield Labs',
    },
    groundTruth: {
      statusLabel: 'Rejected',
      agentStatus: 'REJECTED',
      rejectionReason: AGENT_REJECTION_REASONS[3],
    },
    reviewRecord: {
      mongoId: 'c97ef9846787f99046066d23',
      statusCode: 2,
      statusLabel: 'Rejected',
      rejectionReason: AGENT_REJECTION_REASONS[3],
    },
  }),
];

export const reviewRuns: Record<ReviewType, DailyRun[]> = {
  SOFTWARE: [
    {
      id: 'software-run-2026-03-08',
      date: '2026-03-08',
      totalReviews: 6,
      eligibleCount: 8,
      approvedCount: 2,
      rejectedCount: 1,
      reviews: softwareReviews,
    },
    {
      id: 'software-run-2026-03-07',
      date: '2026-03-07',
      totalReviews: 2,
      eligibleCount: 10,
      approvedCount: 3,
      rejectedCount: 2,
      reviews: [softwareReviews[1], softwareReviews[2]],
    },
    {
      id: 'software-run-2026-03-06',
      date: '2026-03-06',
      totalReviews: 1,
      eligibleCount: 5,
      approvedCount: 2,
      rejectedCount: 1,
      reviews: [softwareReviews[3]],
    },
  ],
  SERVICE: [
    {
      id: 'service-run-2026-03-08',
      date: '2026-03-08',
      totalReviews: 3,
      eligibleCount: 6,
      approvedCount: 1,
      rejectedCount: 1,
      reviews: serviceReviews,
    },
    {
      id: 'service-run-2026-03-07',
      date: '2026-03-07',
      totalReviews: 2,
      eligibleCount: 5,
      approvedCount: 1,
      rejectedCount: 0,
      reviews: [serviceReviews[0], serviceReviews[1]],
    },
  ],
};

export const getStatusType = (review: ReviewData): StatusType => {
  return review.groundTruth.agentStatus;
};

export const getStatusColor = (status: StatusType): string => {
  switch (status) {
    case 'APPROVED':
      return 'bg-[#4CAF50]/20 text-[#4CAF50] border-[#4CAF50]/30';
    case 'REJECTED':
      return 'bg-[#F44336]/20 text-[#F44336] border-[#F44336]/30';
    case 'PENDING':
      return 'bg-[#888888]/20 text-[#888888] border-[#888888]/30';
    case 'PROCESSING':
      return 'bg-[#5E81AC]/20 text-[#8FB3E8] border-[#5E81AC]/30';
    case 'PUBLISHED':
      return 'bg-[#4CAF50]/25 text-[#7DD67F] border-[#4CAF50]/35';
    case 'FLAGGED':
      return 'bg-[#FFC107]/20 text-[#FFC107] border-[#FFC107]/30';
    default:
      return 'bg-[#888888]/20 text-[#888888] border-[#888888]/30';
  }
};

export const getValidationChecks = (review: ReviewData): ValidationCheck[] =>
  review.agentRun
    ? review.agentRun.checklistResults.map((check) => ({
        name: check.name,
        status:
          check.status === 'pass' ? 'PASS' : check.status === 'fail' ? 'FAIL' : 'FLAG',
        details: check.reason,
      }))
    : [
        {
          name: 'Email Verification',
          status: review.accountContext.account.emailVerifiedAt ? 'PASS' : 'FAIL',
          details: review.accountContext.account.emailVerifiedAt || 'Not verified',
        },
        {
          name: 'Account Match',
          status: review.derivedSignals.reviewEmailMatchesAccountEmail ? 'PASS' : 'FLAG',
          details: review.derivedSignals.reviewEmailMatchesAccountEmail
            ? 'Email matches account'
            : 'Email mismatch',
        },
        {
          name: 'Name Match',
          status: review.derivedSignals.reviewNameMatchesAccountName ? 'PASS' : 'FLAG',
          details: review.derivedSignals.reviewNameMatchesAccountName
            ? 'Name matches account'
            : 'Name mismatch',
        },
        {
          name: 'Vendor Conflict',
          status: review.derivedSignals.vendorConflictHints.length === 0 ? 'PASS' : 'FAIL',
          details:
            review.derivedSignals.vendorConflictHints.length === 0
              ? 'No conflicts detected'
              : review.derivedSignals.vendorConflictHints.join(', '),
        },
        {
          name: 'Trust Signals',
          status: review.derivedSignals.trustSignals.length > 0 ? 'PASS' : 'FLAG',
          details: review.derivedSignals.trustSignals.join(', ') || 'No trust signals',
        },
      ];

export const getPrechecks = (review: ReviewData): ValidationCheck[] =>
  review.agentRun && review.agentRun.prechecks.length > 0
    ? review.agentRun.prechecks.map((check) => ({
        name: check.name,
        status:
          check.status === 'pass' ? 'PASS' : check.status === 'fail' ? 'FAIL' : 'FLAG',
        details: check.reason,
      }))
    : [
        {
          name: 'Content Length',
          status: review.review.summary.length > 50 ? 'PASS' : 'FLAG',
          details: `${review.review.summary.length} characters`,
        },
        {
          name: 'Has Strengths',
          status: review.review.strength.length > 20 ? 'PASS' : 'FLAG',
          details: `${review.review.strength.substring(0, 50)}...`,
        },
        {
          name: 'Has Weaknesses',
          status: review.review.weakness.length > 20 ? 'PASS' : 'FLAG',
          details: `${review.review.weakness.substring(0, 50)}...`,
        },
        {
          name: 'Valid Ratings',
          status: review.review.ratings.overall > 0 ? 'PASS' : 'FAIL',
          details: `Overall: ${review.review.ratings.overall}/5`,
        },
      ];
