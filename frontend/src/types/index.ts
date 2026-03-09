export interface InternalMetadata {
  projection: string;
  reviewId: string;
  generatedAt: string;
  status: string;
  statusCode: number;
  step: number;
  rejectionReason: string | null;
  requestToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReviewType = 'SOFTWARE' | 'SERVICE';

export interface ReviewSubject {
  subjectId: string;
  name: string;
  slug: string;
  categories: string[];
}

export interface Usage {
  durationValue: number;
  durationUnit: string;
  frequency: string;
  pricing: string;
  integratedOtherSoftware: string;
  integratedSoftware: string[];
  switchedFromOtherSoftware: string;
  usedSoftwareBeforeSwitch: string[];
}

export interface Ratings {
  easeOfUse: number;
  featuresFunctionality: number;
  customerSupport: number;
  overall: number;
}

export interface Review {
  title: string;
  summary: string;
  strength: string;
  weakness: string;
  ratings: Ratings;
}

export interface Reviewer {
  name: string;
  email: string;
  emailDomain: string;
  companyName: string | null;
  position: string | null;
  location: string | null;
  postingPreferenceCode: string;
  postingPreferenceLabel: string;
  companyWebsite: string | null;
  companyWebsiteHost: string | null;
  profileLink: string | null;
  profileLinkHost: string | null;
}

export interface Account {
  id: number;
  type: string;
  name: string;
  email: string;
  emailDomain: string;
  position: string | null;
  location: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyWebsiteHost: string | null;
  publicUrl: string | null;
  publicUrlHost: string | null;
  totalReviews: number;
  mergeReviewer: number;
  isGoodfirmsRegistered: boolean;
  isSpam: boolean;
  emailVerifiedAt: string | null;
  emailResult: string;
  emailReason: string | null;
  emailCheckedAt: string | null;
  googleIdPresent: boolean;
  socialIdPresent: boolean;
  inferredLoginMethod: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountContext {
  userId: string;
  accountFound: boolean;
  account: Account;
  pendingEmailVerificationRecords: any[];
}

export interface DerivedSignals {
  inferredLoginMethod: string;
  authEvidence: string[];
  reviewEmailMatchesAccountEmail: boolean;
  reviewNameMatchesAccountName: boolean;
  reviewCompanyMatchesAccountCompany: boolean | null;
  vendorConflictHints: string[];
  trustSignals: string[];
  riskHints: string[];
}

export type StatusType =
  | 'PENDING'
  | 'PROCESSING'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'FLAGGED';

export interface GroundTruth {
  agentStatus: StatusType;
  statusLabel: string;
  rejectionReason: string | null;
}

export interface Provenance {
  mongoCollection: string;
  relatedMongoCollections: string[];
  mySqlDatabase: string;
  notes: string[];
}

export interface ReviewRecord {
  mongoId: string;
  statusCode: number;
  statusLabel: string;
  step: number;
  rejectionReason: string | null;
  response: string | null;
  requestToken: string | null;
  submittedBy: number;
  publishDateUnix: number;
  publishDateIso: string;
  createdAtUnix: number;
  createdAtIso: string;
  updatedAtUnix: number;
  updatedAtIso: string;
}

export interface ReviewData {
  reviewType: ReviewType;
  internalMetadata: InternalMetadata;
  subject: ReviewSubject;
  usage: Usage;
  review: Review;
  reviewer: Reviewer;
  accountContext: AccountContext;
  derivedSignals: DerivedSignals;
  groundTruth: GroundTruth;
  provenance: Provenance;
  reviewRecord: ReviewRecord;
}

export interface DailyRun {
  id: string;
  date: string;
  totalReviews: number;
  eligibleCount: number;
  approvedCount: number;
  rejectedCount: number;
  reviews: ReviewData[];
}

export interface ValidationCheck {
  name: string;
  status: 'PASS' | 'FLAG' | 'FAIL';
  details?: string;
}
