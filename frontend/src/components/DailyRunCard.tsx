import React from 'react';
import { DailyRun, ReviewData } from '../types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ReviewItem } from './ReviewItem';

interface DailyRunCardProps {
  run: DailyRun;
  isExpanded: boolean;
  onToggle: () => void;
  isSelected: boolean;
  onSelect: () => void;
  reviews: ReviewData[];
  selectedReviewId: string | null;
  onReviewSelect: (review: ReviewData) => void;
}

export const DailyRunCard: React.FC<DailyRunCardProps> = ({
  run,
  isExpanded,
  onToggle,
  isSelected,
  onSelect,
  reviews,
  selectedReviewId,
  onReviewSelect,
}) => {
  return (
    <div
      className="border rounded"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: isSelected ? 'var(--accent-muted)' : 'var(--border-default)',
        boxShadow: 'none',
      }}
    >
      {/* Card Header */}
      <button
        onClick={() => {
          onSelect();
          onToggle();
        }}
        className="w-full flex items-center justify-between p-4 transition-colors"
        style={{ backgroundColor: 'transparent' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {new Date(run.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <div className="w-4 h-4 flex items-center justify-center">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
      </button>

      {/* Stats Row */}
      <div className="flex gap-6 px-4 pb-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium" style={{ color: 'var(--text-body)' }}>{run.eligibleCount}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Eligible</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>{run.approvedCount}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Approved</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium" style={{ color: 'var(--error)' }}>{run.rejectedCount}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Rejected</span>
        </div>
      </div>

      {/* Expanded Reviews List */}
      {isExpanded && reviews.length > 0 && (
        <div className="px-2 pb-2 pt-2 space-y-2" style={{ backgroundColor: 'var(--bg-subtle)' }}>
          {reviews.map((review) => (
            <ReviewItem
              key={review.internalMetadata.runId ?? review.internalMetadata.reviewId}
              review={review}
              isSelected={
                selectedReviewId === (review.internalMetadata.runId ?? review.internalMetadata.reviewId)
              }
              onClick={() => onReviewSelect(review)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
