import React from 'react';
import { ReviewData } from '../types';
import { RefreshCw } from 'lucide-react';

interface DetailHeaderProps {
  review: ReviewData;
  onRerun: () => void;
  onPublish: () => void;
}

export const DetailHeader: React.FC<DetailHeaderProps> = ({
  review,
  onRerun,
  onPublish,
}) => {
  return (
    <div className="flex items-start justify-between w-full">
      {/* Title Stack */}
      <div className="flex flex-col gap-2">
        <h1 
          className="text-4xl text-white italic font-normal"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Review: {review.review.title}
        </h1>
        <p className="text-sm text-[#888888]">
          {review.software.name} • {review.internalMetadata.reviewId}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onRerun}
          className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity"
        >
          <RefreshCw className="w-[18px] h-[18px] text-[#888888]" />
        </button>
        <button
          onClick={onPublish}
          disabled={review.groundTruth.isPublished}
          className="px-5 py-2.5 text-sm font-medium text-white transition-colors"
          style={{ 
            backgroundColor: review.groundTruth.isPublished ? '#2A2A2A' : '#4CAF50',
            cursor: review.groundTruth.isPublished ? 'not-allowed' : 'pointer',
            opacity: review.groundTruth.isPublished ? 0.5 : 1,
          }}
        >
          {review.groundTruth.isPublished ? 'Published' : 'Publish'}
        </button>
      </div>
    </div>
  );
};
