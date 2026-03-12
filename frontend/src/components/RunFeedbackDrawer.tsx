import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ReviewData } from '../types';

interface RunFeedbackDrawerProps {
  review: ReviewData | null;
  isOpen: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (feedback: string) => Promise<void> | void;
}

const formatFinalDecision = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatConfidence = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const RunFeedbackDrawer: React.FC<RunFeedbackDrawerProps> = ({
  review,
  isOpen,
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}) => {
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFeedback(review?.agentRun?.feedbackText ?? '');
  }, [isOpen, review]);

  if (!isOpen || !review?.agentRun) {
    return null;
  }

  const handleSubmit = async () => {
    const trimmed = feedback.trim();
    if (!trimmed) {
      return;
    }

    await onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close feedback drawer"
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(8, 10, 15, 0.68)' }}
        onClick={onClose}
      />
      <div
        className="relative h-full w-full max-w-[560px] overflow-y-auto border-l px-6 py-6 shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-content)',
          borderColor: 'var(--border-default)',
        }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
              Agent Feedback
            </p>
            <h2
              className="mt-2 text-3xl italic"
              style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}
            >
              Improve This Run
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-body)' }}>
              Capture what the agent got right or wrong so prompt updates can be grounded in real review decisions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center border transition-opacity hover:opacity-80"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-body)' }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border p-4" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-elevated)' }}>
              <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                Final Decision
              </span>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatFinalDecision(review.agentRun.finalDecision)}
              </p>
            </div>
            <div className="border p-4" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-elevated)' }}>
              <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                Confidence
              </span>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatConfidence(review.agentRun.confidence)}
              </p>
            </div>
          </div>

          <div className="border p-4" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-elevated)' }}>
            <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Decision Summary
            </span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
              {review.agentRun.decisionSummary}
            </p>
          </div>

          <div className="border p-4" style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-elevated)' }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                Admin Feedback
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Last updated: {formatDateTime(review.agentRun.feedbackUpdatedAt)}
              </span>
            </div>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Describe where the decision was weak, what evidence should have mattered more, and what the agent should do differently next time."
              className="min-h-[220px] w-full resize-y border px-4 py-3 text-sm leading-relaxed outline-none"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-body)',
              }}
            />
            {errorMessage ? (
              <p className="mt-3 text-sm" style={{ color: '#e07a73' }}>
                {errorMessage}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-body)',
              }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !feedback.trim()}
              className="px-5 py-2.5 text-sm font-medium text-white transition-opacity"
              style={{
                backgroundColor: 'var(--accent-muted)',
                opacity: isSubmitting || !feedback.trim() ? 0.5 : 1,
                cursor: isSubmitting || !feedback.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Saving…' : 'Save Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
