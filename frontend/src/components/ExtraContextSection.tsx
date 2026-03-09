import React from 'react';
import { ReviewData } from '../types';

interface ExtraContextSectionProps {
  review: ReviewData;
}

export const ExtraContextSection: React.FC<ExtraContextSectionProps> = ({ review }) => {
  const { internalMetadata } = review;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <div>
          <span className="text-xs text-[#888888] uppercase tracking-wide block mb-1">Review ID</span>
          <p className="text-sm text-[#CCCCCC]">{internalMetadata.reviewId}</p>
        </div>
        <div>
          <span className="text-xs text-[#888888] uppercase tracking-wide block mb-1">Status</span>
          <p className="text-sm text-[#CCCCCC]">{internalMetadata.status}</p>
        </div>
        <div>
          <span className="text-xs text-[#888888] uppercase tracking-wide block mb-1">Projection</span>
          <p className="text-sm text-[#CCCCCC]">{internalMetadata.projection}</p>
        </div>
        <div>
          <span className="text-xs text-[#888888] uppercase tracking-wide block mb-1">Status Code</span>
          <p className="text-sm text-[#CCCCCC]">{internalMetadata.statusCode}</p>
        </div>
      </div>
    </div>
  );
};
