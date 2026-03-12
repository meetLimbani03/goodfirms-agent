import {
  AgentRunListItem,
  DailyRun,
  ReviewData,
  ReviewType,
  ServiceAgentApiResponse,
  SoftwareAgentApiResponse,
  StatusType,
} from '../types';
import { mapServiceAgentResponseToReview } from './serviceAgent';
import { mapSoftwareAgentResponseToReview } from './softwareAgent';

const API_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8000';

const reviewTypeToApiValue = (reviewType: ReviewType): 'software' | 'service' =>
  reviewType === 'SOFTWARE' ? 'software' : 'service';

const finalDecisionToStatusType = (finalDecision: AgentRunListItem['final_decision']): StatusType => {
  if (finalDecision === 'reject_recommended') {
    return 'REJECTED';
  }
  if (finalDecision === 'needs_manual_review') {
    return 'FLAGGED';
  }
  if (finalDecision === 'verified_pass' || finalDecision === 'verified_with_minor_fixes') {
    return 'APPROVED';
  }
  return 'PROCESSING';
};

export const agentRunListItemFromApiResponse = (
  response: SoftwareAgentApiResponse | ServiceAgentApiResponse,
  reviewType: ReviewType
): AgentRunListItem | null => {
  if (!response.run_id) {
    return null;
  }

  const subjectName =
    reviewType === 'SOFTWARE'
      ? (response as SoftwareAgentApiResponse).context_payload.subject.name
      : (response as ServiceAgentApiResponse).context_payload.subject.company_name;

  return {
    run_id: response.run_id,
    review_type: reviewTypeToApiValue(reviewType),
    review_id: response.review_id,
    status: response.run_metadata?.status ?? 'completed',
    final_decision: response.output.final_decision,
    created_at: response.run_metadata?.created_at ?? null,
    completed_at: response.run_metadata?.completed_at ?? null,
    test_mode: response.run_metadata?.test_mode ?? false,
    review_title: response.context_payload.review_content.headline || response.review_id,
    subject_name: subjectName,
    reviewer_name: response.context_payload.reviewer.resolved.name || 'Unknown reviewer',
    model: response.model,
  };
};

const groupRunIdForItem = (reviewType: ReviewType, date: string) => `${reviewType.toLowerCase()}-${date}`;

export const fetchAgentRunHistoryList = async (reviewType: ReviewType): Promise<AgentRunListItem[]> => {
  const response = await fetch(
    `${API_BASE_URL}/api/agent-runs?review_type=${encodeURIComponent(reviewTypeToApiValue(reviewType))}`
  );

  if (!response.ok) {
    let message = 'Failed to load agent runs';

    try {
      const errorPayload = (await response.json()) as { detail?: string };
      if (errorPayload.detail) {
        message = errorPayload.detail;
      }
    } catch {
      // ignore
    }

    throw new Error(message);
  }

  return (await response.json()) as AgentRunListItem[];
};

export const fetchAgentRunDetail = async (
  runId: string,
  reviewType: ReviewType
): Promise<ReviewData> => {
  const response = await fetch(`${API_BASE_URL}/api/agent-runs/${encodeURIComponent(runId)}`);

  if (!response.ok) {
    let message = 'Failed to load agent run detail';

    try {
      const errorPayload = (await response.json()) as { detail?: string };
      if (errorPayload.detail) {
        message = errorPayload.detail;
      }
    } catch {
      // ignore
    }

    throw new Error(message);
  }

  const payload = await response.json();
  if (reviewType === 'SOFTWARE') {
    return mapSoftwareAgentResponseToReview(payload as SoftwareAgentApiResponse);
  }

  return mapServiceAgentResponseToReview(payload as ServiceAgentApiResponse);
};

export const submitAgentRunFeedback = async (
  runId: string,
  reviewType: ReviewType,
  feedback: string
): Promise<ReviewData> => {
  const response = await fetch(`${API_BASE_URL}/api/agent-runs/${encodeURIComponent(runId)}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feedback }),
  });

  if (!response.ok) {
    let message = 'Failed to submit agent run feedback';

    try {
      const errorPayload = (await response.json()) as { detail?: string };
      if (errorPayload.detail) {
        message = errorPayload.detail;
      }
    } catch {
      // ignore
    }

    throw new Error(message);
  }

  const payload = await response.json();
  if (reviewType === 'SOFTWARE') {
    return mapSoftwareAgentResponseToReview(payload as SoftwareAgentApiResponse);
  }

  return mapServiceAgentResponseToReview(payload as ServiceAgentApiResponse);
};

const toSummaryReview = (item: AgentRunListItem): ReviewData => {
  const reviewType: ReviewType = item.review_type === 'software' ? 'SOFTWARE' : 'SERVICE';
  const statusType = finalDecisionToStatusType(item.final_decision);

  return {
    reviewType,
    internalMetadata: {
      runId: item.run_id,
      projection: 'persisted-agent-run-summary',
      reviewId: item.review_id,
      generatedAt: item.completed_at ?? item.created_at ?? new Date().toISOString(),
      status: item.status,
      statusCode: 0,
      step: 0,
      rejectionReason: null,
      requestToken: null,
      createdAt: item.created_at ?? '',
      updatedAt: item.completed_at ?? item.created_at ?? '',
    },
    subject: {
      subjectId: item.review_id,
      name: item.subject_name,
      slug: item.review_id,
      categories: [],
    },
    usage: {
      durationValue: 0,
      durationUnit: '',
      frequency: '',
      pricing: '',
      integratedOtherSoftware: '',
      integratedSoftware: [],
      switchedFromOtherSoftware: '',
      usedSoftwareBeforeSwitch: [],
    },
    review: {
      title: item.review_title,
      summary: '',
      strength: '',
      weakness: '',
      ratings: {
        easeOfUse: 0,
        featuresFunctionality: 0,
        customerSupport: 0,
        overall: 0,
      },
    },
    reviewer: {
      name: item.reviewer_name,
      email: '',
      emailDomain: '',
      companyName: null,
      position: null,
      location: null,
      postingPreferenceCode: '',
      postingPreferenceLabel: '',
      companyWebsite: null,
      companyWebsiteHost: null,
      profileLink: null,
      profileLinkHost: null,
    },
    accountContext: {
      userId: '',
      accountFound: false,
      account: {
        id: 0,
        type: '',
        name: '',
        email: '',
        emailDomain: '',
        position: null,
        location: null,
        companyName: null,
        companyWebsite: null,
        companyWebsiteHost: null,
        publicUrl: null,
        publicUrlHost: null,
        totalReviews: 0,
        mergeReviewer: 0,
        isGoodfirmsRegistered: false,
        isSpam: false,
        emailVerifiedAt: null,
        emailResult: '',
        emailReason: null,
        emailCheckedAt: null,
        googleIdPresent: false,
        socialIdPresent: false,
        inferredLoginMethod: '',
        createdAt: '',
        updatedAt: '',
      },
      pendingEmailVerificationRecords: [],
    },
    derivedSignals: {
      inferredLoginMethod: '',
      authEvidence: [],
      reviewEmailMatchesAccountEmail: false,
      reviewNameMatchesAccountName: false,
      reviewCompanyMatchesAccountCompany: null,
      vendorConflictHints: [],
      trustSignals: [],
      riskHints: [],
    },
    groundTruth: {
      agentStatus: statusType,
      statusLabel: statusType,
      rejectionReason: null,
    },
    provenance: {
      mongoCollection: '',
      relatedMongoCollections: [],
      mySqlDatabase: '',
      notes: [],
    },
    reviewRecord: {
      mongoId: item.review_id,
      statusCode: 0,
      statusLabel: item.status,
      step: 0,
      rejectionReason: null,
      response: null,
      requestToken: null,
      submittedBy: 0,
      publishDateUnix: 0,
      publishDateIso: '',
      createdAtUnix: 0,
      createdAtIso: item.created_at ?? '',
      updatedAtUnix: 0,
      updatedAtIso: item.completed_at ?? item.created_at ?? '',
    },
    agentRun: {
      model: item.model ?? '',
      promptMarkdown: '',
      contextMarkdown: '',
      finalDecision: item.final_decision ?? 'needs_manual_review',
      confidence: 'medium',
      decisionSummary: '',
      rejectReason: null,
      riskFlags: [],
      prechecks: [],
      checklistResults: [],
      testMode: item.test_mode,
      toolTraces: [],
      llmUsageSummary: {
        call_count: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        reasoning_tokens: 0,
        cached_read_tokens: 0,
        cache_write_tokens: 0,
        exact_openrouter_cost: 0,
        cache_savings: 0,
      },
      llmUsageCalls: [],
      feedbackText: null,
      feedbackUpdatedAt: null,
    },
  };
};

export const groupAgentRunHistory = (items: AgentRunListItem[], reviewType: ReviewType): DailyRun[] => {
  const grouped = new Map<string, AgentRunListItem[]>();

  for (const item of items) {
    const dateKey = (item.completed_at ?? item.created_at ?? '').slice(0, 10) || 'unknown';
    const current = grouped.get(dateKey) ?? [];
    current.push(item);
    grouped.set(dateKey, current);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, groupItems]) => {
      const reviews = groupItems.map(toSummaryReview);
      return {
        id: groupRunIdForItem(reviewType, dateKey),
        date: groupItems[0]?.completed_at ?? groupItems[0]?.created_at ?? new Date().toISOString(),
        totalReviews: reviews.length,
        eligibleCount: reviews.length,
        approvedCount: reviews.filter((review) =>
          ['APPROVED', 'PUBLISHED'].includes(review.groundTruth.agentStatus)
        ).length,
        rejectedCount: reviews.filter((review) => review.groundTruth.agentStatus === 'REJECTED').length,
        reviews,
      };
    });
};
