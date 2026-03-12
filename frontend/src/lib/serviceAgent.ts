import { ReviewData, ServiceAgentApiResponse, StatusType } from '../types';

const API_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL ?? 'http://127.0.0.1:8000';

interface RunServiceAgentInput {
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
  finalDecision: ServiceAgentApiResponse['output']['final_decision']
): StatusType => {
  if (finalDecision === 'reject_recommended') {
    return 'REJECTED';
  }
  if (finalDecision === 'needs_manual_review') {
    return 'FLAGGED';
  }
  return 'APPROVED';
};

export const runServiceAgent = async ({
  reviewId,
  test,
}: RunServiceAgentInput): Promise<ServiceAgentApiResponse> => {
  const params = new URLSearchParams();
  if (test) {
    params.set('test', 'true');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/service-reviews/${encodeURIComponent(reviewId)}/agent-run${
      params.size > 0 ? `?${params.toString()}` : ''
    }`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    let message = 'Service review agent call failed';

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

  return (await response.json()) as ServiceAgentApiResponse;
};

export const mapServiceAgentResponseToReview = (
  response: ServiceAgentApiResponse,
  testMode?: boolean
): ReviewData => {
  const { context_payload: context, review_metadata: metadata, output } = response;
  const reviewer = context.reviewer.resolved;
  const statusType = finalDecisionToStatusType(output.final_decision);
  const generatedAt = new Date().toISOString();
  const hasAccount = context.signals.account_found;
  const effectiveTestMode = testMode ?? response.run_metadata?.test_mode ?? false;

  return {
    reviewType: 'SERVICE',
    internalMetadata: {
      runId: response.run_id ?? null,
      projection: 'manual-agent-run',
      reviewId: response.review_id,
      generatedAt,
      status: metadata.status_label,
      statusCode: metadata.status_code ?? 0,
      step: metadata.step ?? 0,
      rejectionReason: metadata.rejection_reason ?? null,
      requestToken: metadata.request_token ?? null,
      createdAt: metadata.created_at ?? 'Unknown',
      updatedAt: metadata.updated_at ?? 'Unknown',
    },
    subject: {
      subjectId: response.review_id,
      name: context.subject.company_name,
      slug: context.subject.company_slug || response.review_id,
      categories:
        context.project.selected_services.length > 0
          ? context.project.selected_services
          : context.project.primary_service
            ? [context.project.primary_service]
            : [],
    },
    usage: {
      durationValue: 0,
      durationUnit: context.project.status_label || 'unknown',
      frequency: context.project.industry || 'unknown',
      pricing: context.project.budget || 'unknown',
      integratedOtherSoftware: 'not applicable',
      integratedSoftware: [],
      switchedFromOtherSoftware: 'not applicable',
      usedSoftwareBeforeSwitch: [],
    },
    review: {
      title: context.review_content.headline,
      summary: context.review_content.body,
      strength: context.review_content.strength,
      weakness: context.review_content.weakness,
      ratings: {
        easeOfUse: context.review_content.ratings.quality_work ?? 0,
        featuresFunctionality: context.review_content.ratings.scheduling_timing ?? 0,
        customerSupport: context.review_content.ratings.communication ?? 0,
        overall: context.review_content.ratings.overall_experience ?? 0,
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
      companyWebsite: toNullableString(context.reviewer.review_submitted.company_website || reviewer.company_website),
      companyWebsiteHost: toNullableString(reviewer.company_website_host),
      profileLink: toNullableString(context.reviewer.review_submitted.profile_link || reviewer.profile_link),
      profileLinkHost: toNullableString(reviewer.profile_link_host),
    },
    accountContext: {
      userId: reviewer.reviewer_id || 'unknown',
      accountFound: hasAccount,
      account: {
        id: Number(reviewer.reviewer_id || 0),
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
        totalReviews: Number(reviewer.previous_reviews || 0),
        mergeReviewer: 0,
        isGoodfirmsRegistered: context.signals.is_goodfirms_registered,
        isSpam: false,
        emailVerifiedAt: null,
        emailResult: 'unknown',
        emailReason: null,
        emailCheckedAt: null,
        googleIdPresent: context.signals.inferred_login_method === 'google',
        socialIdPresent: context.signals.inferred_login_method === 'linkedin',
        inferredLoginMethod: context.signals.inferred_login_method,
        createdAt: hasAccount ? reviewer.account_created_at || '' : '',
        updatedAt: hasAccount ? reviewer.account_updated_at || '' : '',
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
      rejectionReason: metadata.rejection_reason ?? null,
    },
    provenance: {
      mongoCollection: 'not applicable',
      relatedMongoCollections: [],
      mySqlDatabase: 'GoodFirms',
      notes: [
        'Manual run triggered from the admin UI against the backend service-review agent endpoint.',
      ],
    },
    reviewRecord: {
      mongoId: response.review_id,
      statusCode: metadata.status_code ?? 0,
      statusLabel: metadata.status_label,
      step: metadata.step ?? 0,
      rejectionReason: metadata.rejection_reason ?? null,
      response: null,
      requestToken: metadata.request_token ?? null,
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
      rejectReason: output.reject_reason ?? null,
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
