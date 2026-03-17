import React from 'react';
import { IdentityVerificationResult, ReviewData } from '../types';
import { RefreshCw } from 'lucide-react';
import { getReviewTypeLabel } from '../data/mockData';
import hunterIcon from '../assets/hunter-icon.png';
import contactoutIcon from '../assets/contactout-icon.png';
import apolloIcon from '../assets/apollo-icon.svg';

interface DetailHeaderProps {
  review: ReviewData;
  onRerun: () => void;
  onPublish: () => void;
  onOpenFeedback: () => void;
  verificationResults: Partial<Record<'hunter' | 'contactout' | 'apollo', IdentityVerificationResult>>;
  verificationErrorMessage: string | null;
  isVerificationRunning: boolean;
  verificationProviderPending: 'hunter' | 'contactout' | 'apollo' | null;
  onRunIdentityVerification: (provider: 'hunter' | 'contactout' | 'apollo') => Promise<void>;
}

export const DetailHeader: React.FC<DetailHeaderProps> = ({
  review,
  onRerun,
  onPublish,
  onOpenFeedback,
  verificationResults,
  verificationErrorMessage,
  isVerificationRunning,
  verificationProviderPending,
  onRunIdentityVerification,
}) => {
  const isManualRun = Boolean(review.agentRun);
  const hasPersistedRun = Boolean(review.internalMetadata.runId);
  const inferredLoginMethod =
    review.accountContext.account.inferredLoginMethod || review.derivedSignals.inferredLoginMethod;
  const isGoogleSignup = inferredLoginMethod === 'google';
  const isFinalized =
    review.groundTruth.agentStatus === 'APPROVED' ||
    review.groundTruth.agentStatus === 'PUBLISHED';
  const verificationInputs =
    verificationResults.hunter?.inputs ??
    verificationResults.contactout?.inputs ??
    verificationResults.apollo?.inputs ??
    null;

  return (
    <div className="flex w-full flex-col gap-4">
      {isGoogleSignup ? (
        <div
          className="w-full border px-5 py-4"
          style={{
            backgroundColor: 'rgba(214, 145, 66, 0.12)',
            borderColor: 'rgba(214, 145, 66, 0.45)',
          }}
        >
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: '#e0a65a' }}
              >
                Google Sign-Up
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                This reviewer account was registered using Google sign-in.
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Final approval should stay with a human reviewer. Run external identity verification only when needed.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={() => void onRunIdentityVerification('hunter')}
                disabled={isVerificationRunning}
                title={verificationProviderPending === 'hunter' ? 'Running Hunter verification' : 'Verify with Hunter'}
                aria-label={verificationProviderPending === 'hunter' ? 'Running Hunter verification' : 'Verify with Hunter'}
                className="flex h-10 w-10 items-center justify-center"
                style={{
                  backgroundColor:
                    verificationProviderPending === 'hunter' ? 'rgba(214, 145, 66, 0.22)' : 'var(--bg-card)',
                  border: '1px solid rgba(214, 145, 66, 0.45)',
                  opacity: isVerificationRunning && verificationProviderPending !== 'hunter' ? 0.7 : 1,
                  cursor: isVerificationRunning ? 'wait' : 'pointer',
                }}
              >
                <img src={hunterIcon} alt="Hunter" className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => void onRunIdentityVerification('contactout')}
                disabled={isVerificationRunning}
                title={
                  verificationProviderPending === 'contactout'
                    ? 'Running ContactOut verification'
                    : 'Verify with ContactOut'
                }
                aria-label={
                  verificationProviderPending === 'contactout'
                    ? 'Running ContactOut verification'
                    : 'Verify with ContactOut'
                }
                className="flex h-10 w-10 items-center justify-center"
                style={{
                  backgroundColor:
                    verificationProviderPending === 'contactout' ? 'rgba(214, 145, 66, 0.22)' : 'var(--bg-card)',
                  border: '1px solid rgba(214, 145, 66, 0.45)',
                  opacity: isVerificationRunning && verificationProviderPending !== 'contactout' ? 0.7 : 1,
                  cursor: isVerificationRunning ? 'wait' : 'pointer',
                }}
              >
                <img src={contactoutIcon} alt="ContactOut" className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => void onRunIdentityVerification('apollo')}
                disabled={isVerificationRunning}
                title={verificationProviderPending === 'apollo' ? 'Running Apollo verification' : 'Verify with Apollo'}
                aria-label={verificationProviderPending === 'apollo' ? 'Running Apollo verification' : 'Verify with Apollo'}
                className="flex h-10 w-10 items-center justify-center"
                style={{
                  backgroundColor:
                    verificationProviderPending === 'apollo' ? 'rgba(214, 145, 66, 0.22)' : 'var(--bg-card)',
                  border: '1px solid rgba(214, 145, 66, 0.45)',
                  opacity: isVerificationRunning && verificationProviderPending !== 'apollo' ? 0.7 : 1,
                  cursor: isVerificationRunning ? 'wait' : 'pointer',
                }}
              >
                <img src={apolloIcon} alt="Apollo" className="h-5 w-5" />
              </button>
            </div>
          </div>
          {verificationErrorMessage ? (
            <p className="mt-3 text-sm" style={{ color: '#f0c674' }}>
              {verificationErrorMessage}
            </p>
          ) : null}
          {verificationInputs ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(['hunter', 'contactout', 'apollo'] as const)
                .filter((provider) => verificationResults[provider])
                .map((provider) => {
                  const result = verificationResults[provider]!;
                  return (
                    <div
                      key={provider}
                      className="p-3"
                      style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.08)',
                        border: '1px solid rgba(214, 145, 66, 0.28)',
                      }}
                    >
                      <p
                        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: '#e0a65a' }}
                      >
                        {provider === 'hunter'
                          ? 'Hunter Result'
                          : provider === 'contactout'
                            ? 'ContactOut Result'
                            : 'Apollo Result'}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                        {result.summary}
                      </p>
                      <div className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                        <p>Status: {result.status}</p>
                        <p>Claimed Name: {result.inputs.name || 'Not available'}</p>
                        <p>Signup Email: {result.inputs.signup_email || 'Not available'}</p>
                        <p>Claimed Company: {result.inputs.company_name || 'Not available'}</p>
                        <p>LinkedIn: {result.inputs.linkedin_url || 'Not available'}</p>
                        {'candidate_email' in result.result ? (
                          <p>Candidate Email: {String(result.result.candidate_email || 'Not available')}</p>
                        ) : null}
                        {'candidate_domain' in result.result ? (
                          <p>Candidate Domain: {String(result.result.candidate_domain || 'Not available')}</p>
                        ) : null}
                        {'lookup_method' in result.result ? (
                          <p>Lookup Method: {String(result.result.lookup_method || 'Not available')}</p>
                        ) : null}
                        {'work_emails' in result.result ? (
                          <p>
                            Work Emails:{' '}
                            {Array.isArray(result.result.work_emails) && result.result.work_emails.length > 0
                              ? result.result.work_emails.join(', ')
                              : 'Not available'}
                          </p>
                        ) : null}
                        {'personal_emails' in result.result ? (
                          <p>
                            Personal Emails:{' '}
                            {Array.isArray(result.result.personal_emails) && result.result.personal_emails.length > 0
                              ? result.result.personal_emails.join(', ')
                              : 'Not available'}
                          </p>
                        ) : null}
                        {'work_email' in result.result ? (
                          <p>Work Email: {String(result.result.work_email || 'Not available')}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-start justify-between w-full">
        {/* Title Stack */}
        <div className="flex flex-col gap-2">
          <h1 
            className="text-4xl font-semibold tracking-[-0.02em]"
            style={{ fontFamily: 'Source Serif 4, serif', color: 'var(--text-primary)' }}
          >
            Review: {review.review.title}
          </h1>
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span>{review.subject.name}</span>
            <span>•</span>
            <span>{review.internalMetadata.reviewId}</span>
            <span
              className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--accent-muted)', border: '1px solid var(--border-default)' }}
            >
              {getReviewTypeLabel(review.reviewType)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onRerun}
            className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity"
          >
            <RefreshCw className="w-[18px] h-[18px]" style={{ color: 'var(--text-muted)' }} />
          </button>
          {isManualRun && hasPersistedRun ? (
            <button
              type="button"
              onClick={onOpenFeedback}
              className="px-5 py-2.5 text-sm font-medium whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-body)',
                border: '1px solid var(--border-default)',
              }}
            >
              Feedback
            </button>
          ) : null}
          {isManualRun ? (
            <span
              className="px-5 py-2.5 text-sm font-medium whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-default)',
              }}
            >
              Manual Run
            </span>
          ) : (
            <button
              onClick={onPublish}
              disabled={isFinalized}
              className="px-5 py-2.5 text-sm font-medium text-white transition-colors"
              style={{ 
                backgroundColor: isFinalized ? 'var(--bg-card)' : 'var(--success)',
                color: '#FFFFFF',
                cursor: isFinalized ? 'not-allowed' : 'pointer',
                opacity: isFinalized ? 0.5 : 1,
              }}
            >
              {review.groundTruth.agentStatus === 'PUBLISHED'
                ? 'Published'
                : review.groundTruth.agentStatus === 'APPROVED'
                  ? 'Approved'
                  : 'Approve'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
