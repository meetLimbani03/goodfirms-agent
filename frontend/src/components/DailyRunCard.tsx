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
      className={`bg-[#1E1E1E] border border-[#2A2A2A] rounded ${
        isSelected ? 'ring-1 ring-[#4CAF50]' : ''
      }`}
    >
      {/* Card Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-[#252525] transition-colors"
      >
        <span className="text-sm font-semibold text-white">
          {new Date(run.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
        <div className="w-4 h-4 flex items-center justify-center">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[#888888]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#888888]" />
          )}
        </div>
      </button>

      {/* Stats Row */}
      <div className="flex gap-4 px-4 pb-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[#CCCCCC]">{run.newCount}</span>
          <span className="text-xs text-[#888888]">New</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[#CCCCCC]">{run.eligibleCount}</span>
          <span className="text-xs text-[#888888]">Eligible</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[#4CAF50]">{run.approvedCount}</span>
          <span className="text-xs text-[#888888]">Approved</span>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[#F44336]">{run.rejectedCount}</span>
          <span className="text-xs text-[#888888]">Rejected</span>
        </div>
      </div>

      {/* Expanded Reviews List */}
      {isExpanded && reviews.length > 0 && (
        <div className="bg-[#1A1A1A] px-2 pb-2 pt-2 space-y-2">
          {reviews.map((review) => (
            <ReviewItem
              key={review.internalMetadata.reviewId}
              review={review}
              isSelected={selectedReviewId === review.internalMetadata.reviewId}
              onClick={() => onReviewSelect(review)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
