import React from 'react';
import { ReviewData } from '../types';
import { RefreshCw } from 'lucide-react';
import { getReviewTypeLabel } from '../data/mockData';

interface DetailHeaderProps {
  review: ReviewData;
  onRerun: () => void;
  onPublish: () => void;
  onOpenFeedback: () => void;
}

export const DetailHeader: React.FC<DetailHeaderProps> = ({
  review,
  onRerun,
  onPublish,
  onOpenFeedback,
}) => {
  const isManualRun = Boolean(review.agentRun);
  const hasPersistedRun = Boolean(review.internalMetadata.runId);
  const inferredLoginMethod =
    review.accountContext.account.inferredLoginMethod || review.derivedSignals.inferredLoginMethod;
  const isGoogleSignup = inferredLoginMethod === 'google';
  const isFinalized =
    review.groundTruth.agentStatus === 'APPROVED' ||
    review.groundTruth.agentStatus === 'PUBLISHED';

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
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: '#e0a65a' }}
          >
            Google Sign-Up
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
            This reviewer account was registered using Google sign-in.
          </p>
        </div>
      ) : null}

      <div className="flex items-start justify-between w-full">
        {/* Title Stack */}
        <div className="flex flex-col gap-2">
          <h1 
            className="text-4xl italic font-normal"
            style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}
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
