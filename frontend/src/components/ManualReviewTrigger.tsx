import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, LoaderCircle, Play } from 'lucide-react';
import { ReviewType } from '../types';

interface ManualReviewTriggerProps<TResponse> {
  reviewType: ReviewType;
  onSuccess: (response: TResponse, testMode: boolean) => void;
  runReviewAgent: (input: { reviewId: string; test: boolean }) => Promise<TResponse>;
}

export const ManualReviewTrigger = <TResponse,>({
  reviewType,
  onSuccess,
  runReviewAgent,
}: ManualReviewTriggerProps<TResponse>) => {
  const [reviewId, setReviewId] = useState('');
  const [testMode, setTestMode] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      runReviewAgent({
        reviewId: reviewId.trim(),
        test: testMode,
      }),
    onSuccess: (response) => {
      onSuccess(response, testMode);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!reviewId.trim()) {
      return;
    }

    mutation.mutate();
  };

  return (
    <div
      className="mb-5 rounded border p-4"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
    >
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-subtle)' }}>
          Manual Trigger
        </p>
      </div>

      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-subtle)' }}>
            Review ID
          </label>
          <input
            value={reviewId}
            onChange={(event) => setReviewId(event.target.value)}
            placeholder={reviewType === 'SOFTWARE' ? '69b0d4b687a0ea12930bdea3' : '84551'}
            className="w-full px-3 py-2 text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
            }}
          />
        </div>

        <label className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-body)' }}>
          <span className="relative mt-1 flex h-4 w-4 items-center justify-center">
            <input
              type="checkbox"
              checked={testMode}
              onChange={(event) => setTestMode(event.target.checked)}
              className="absolute inset-0 m-0 h-4 w-4 cursor-pointer opacity-0"
            />
            <span
              aria-hidden="true"
              className="flex h-4 w-4 items-center justify-center border transition-colors"
              style={{
                backgroundColor: testMode ? 'var(--accent-muted)' : 'var(--bg-subtle)',
                borderColor: testMode ? 'var(--accent-muted)' : 'var(--text-muted)',
                borderWidth: '1px',
                borderStyle: 'solid',
                boxShadow: testMode ? 'none' : '0 0 0 1px var(--text-muted) inset',
                color: testMode ? '#111111' : 'transparent',
              }}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
          </span>
          <span className="leading-6">
            <span>Test mode</span>
            <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
              Allows runs on reviews that are already approved or rejected.
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={mutation.isPending || !reviewId.trim()}
          className="flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-opacity"
          style={{
            backgroundColor: 'var(--accent-muted)',
            color: '#111111',
            opacity: mutation.isPending || !reviewId.trim() ? 0.6 : 1,
            cursor: mutation.isPending || !reviewId.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {mutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {mutation.isPending ? 'Running Agent' : 'Run Review'}
        </button>
      </form>

      {mutation.error ? (
        <p className="mt-3 text-sm" style={{ color: 'var(--error)' }}>
          {mutation.error.message}
        </p>
      ) : null}
    </div>
  );
};

