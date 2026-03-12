import {
  ReviewData,
  SoftwareAgentApiResponse,
  StatusType,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8000';

interface RunSoftwareAgentInput {
  reviewId: string;
  test: boolean;
}

const toNullableString = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return value;
};

const finalDecisionToStatusType = (
  finalDecision: SoftwareAgentApiResponse['output']['final_decision']
): StatusType => {
  if (finalDecision === 'reject_recommended') {
    return 'REJECTED';
  }
  if (finalDecision === 'needs_manual_review') {
    return 'FLAGGED';
  }
  return 'APPROVED';
};

export const runSoftwareAgent = async ({
  reviewId,
  test,
}: RunSoftwareAgentInput): Promise<SoftwareAgentApiResponse> => {
  const params = new URLSearchParams();
  if (test) {
    params.set('test', 'true');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/software-reviews/${encodeURIComponent(reviewId)}/agent-run${
      params.size > 0 ? `?${params.toString()}` : ''
    }`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    let message = 'Software review agent call failed';

    try {
      const errorPayload = (await response.json()) as { detail?: string };
      if (errorPayload.detail) {
        message = errorPayload.detail;
      }
    } catch {
      // ignore non-json errors
    }

    throw new Error(message);
  }

  return (await response.json()) as SoftwareAgentApiResponse;
};

export const mapSoftwareAgentResponseToReview = (
  response: SoftwareAgentApiResponse,
  testMode?: boolean
): ReviewData => {
  const { context_payload: context, review_metadata: metadata, output } = response;
  const reviewer = context.reviewer.resolved;
  const statusType = finalDecisionToStatusType(output.final_decision);
  const generatedAt = new Date().toISOString();
  const hasAccount = context.signals.account_found;
  const effectiveTestMode = testMode ?? response.run_metadata?.test_mode ?? false;

  return {
    reviewType: 'SOFTWARE',
    internalMetadata: {
      runId: response.run_id ?? null,
      projection: 'manual-agent-run',
      reviewId: response.review_id,
      generatedAt,
      status: metadata.status_label,
      statusCode: metadata.status_code ?? 0,
      step: metadata.step ?? 0,
      rejectionReason: metadata.rejection_reason,
      requestToken: metadata.request_token,
      createdAt: metadata.created_at ?? 'Unknown',
      updatedAt: metadata.updated_at ?? 'Unknown',
    },
    subject: {
      subjectId: response.review_id,
      name: context.subject.name,
      slug: context.subject.slug || response.review_id,
      categories: context.subject.category_labels,
    },
    usage: {
      durationValue: context.usage.duration_value ?? 0,
      durationUnit: context.usage.duration_unit || 'unknown',
      frequency: context.usage.frequency || 'unknown',
      pricing: context.usage.pricing || 'unknown',
      integratedOtherSoftware: context.usage.integrates_other_software || 'unknown',
      integratedSoftware: context.usage.integrated_software,
      switchedFromOtherSoftware: context.usage.switched_from_other_software || 'unknown',
      usedSoftwareBeforeSwitch: context.usage.used_software_before_switch,
    },
    review: {
      title: context.review_content.headline,
      summary: context.review_content.body,
      strength: context.review_content.strength,
      weakness: context.review_content.weakness,
      ratings: {
        easeOfUse: context.review_content.ratings.ease_of_use ?? 0,
        featuresFunctionality: context.review_content.ratings.features_functionality ?? 0,
        customerSupport: context.review_content.ratings.customer_support ?? 0,
        overall: context.review_content.ratings.overall ?? 0,
      },
    },
    reviewer: {
      name: reviewer.name || '(not provided)',
      email: context.reviewer.review_submitted.email || reviewer.email || '(not provided)',
      emailDomain: reviewer.email_domain || '(not provided)',
      companyName: toNullableString(reviewer.company_name),
      position: toNullableString(reviewer.position),
      location: toNullableString(reviewer.location),
      postingPreferenceCode: '',
      postingPreferenceLabel: reviewer.posting_preference_label || '(not provided)',
      companyWebsite: toNullableString(reviewer.company_website),
      companyWebsiteHost: toNullableString(reviewer.company_website_host),
      profileLink: toNullableString(reviewer.profile_link),
      profileLinkHost: toNullableString(reviewer.profile_link_host),
    },
    accountContext: {
      userId: 'unknown',
      accountFound: hasAccount,
      account: {
        id: 0,
        type: context.signals.inferred_login_method,
        name: context.reviewer.profile_fetched.name || '(not available)',
        email: context.reviewer.profile_fetched.email || '(not available)',
        emailDomain: '',
        position: toNullableString(context.reviewer.profile_fetched.position),
        location: toNullableString(context.reviewer.profile_fetched.location),
        companyName: toNullableString(context.reviewer.profile_fetched.company_name),
        companyWebsite: toNullableString(context.reviewer.profile_fetched.company_website),
        companyWebsiteHost: null,
        publicUrl: toNullableString(context.reviewer.profile_fetched.profile_link),
        publicUrlHost: null,
        totalReviews: 0,
        mergeReviewer: 0,
        isGoodfirmsRegistered: hasAccount,
        isSpam: false,
        emailVerifiedAt: null,
        emailResult: 'unknown',
        emailReason: null,
        emailCheckedAt: null,
        googleIdPresent: context.signals.inferred_login_method === 'google',
        socialIdPresent: context.signals.inferred_login_method === 'linkedin',
        inferredLoginMethod: context.signals.inferred_login_method,
        createdAt: hasAccount ? generatedAt : '',
        updatedAt: hasAccount ? generatedAt : '',
      },
      pendingEmailVerificationRecords: [],
    },
    derivedSignals: {
      inferredLoginMethod: context.signals.inferred_login_method,
      authEvidence: [],
      reviewEmailMatchesAccountEmail: context.signals.review_email_matches_account_email ?? false,
      reviewNameMatchesAccountName: context.signals.review_name_matches_account_name ?? false,
      reviewCompanyMatchesAccountCompany: context.signals.review_company_matches_account_company,
      vendorConflictHints: [],
      trustSignals: context.signals.trust_flags,
      riskHints: context.signals.risk_flags,
    },
    groundTruth: {
      agentStatus: statusType,
      statusLabel:
        statusType === 'APPROVED'
          ? 'Approved'
          : statusType === 'REJECTED'
            ? 'Rejected'
            : statusType === 'FLAGGED'
              ? 'Flagged'
              : metadata.status_label,
      rejectionReason: metadata.rejection_reason,
    },
    provenance: {
      mongoCollection: 'software-reviews',
      relatedMongoCollections: [],
      mySqlDatabase: 'GoodFirms',
      notes: [
        'Manual run triggered from the admin UI against the backend software-review agent endpoint.',
      ],
    },
    reviewRecord: {
      mongoId: response.review_id,
      statusCode: metadata.status_code ?? 0,
      statusLabel: metadata.status_label,
      step: metadata.step ?? 0,
      rejectionReason: metadata.rejection_reason,
      response: null,
      requestToken: metadata.request_token,
      submittedBy: metadata.submitted_by ?? 0,
      publishDateUnix: 0,
      publishDateIso: '',
      createdAtUnix: 0,
      createdAtIso: metadata.created_at ?? '',
      updatedAtUnix: 0,
      updatedAtIso: metadata.updated_at ?? '',
    },
    agentRun: {
      model: response.model,
      promptMarkdown: response.prompt_markdown,
      contextMarkdown: response.context_markdown,
      finalDecision: output.final_decision,
      confidence: output.confidence,
      decisionSummary: output.decision_summary,
      rejectReason: output.reject_reason,
      riskFlags: output.risk_flags,
      prechecks: context.prechecks ?? [],
      checklistResults: output.checklist_results,
      improvedTitle: output.improved_title ?? undefined,
      improvedSummary: output.improved_summary ?? undefined,
      improvedStrength: output.improved_strength ?? undefined,
      improvedWeakness: output.improved_weakness ?? undefined,
      changeRationale: output.change_rationale ?? undefined,
      testMode: effectiveTestMode,
      toolTraces: response.tool_traces,
      llmUsageSummary: response.llm_usage_summary,
      llmUsageCalls: response.llm_usage_calls,
      feedbackText: response.review_feedback?.feedback ?? null,
      feedbackUpdatedAt: response.review_feedback?.updated_at ?? null,
    },
  };
};
