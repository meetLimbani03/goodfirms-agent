import React from 'react';
import { ReviewData } from '../types';

interface GroundTruthSectionProps {
  review: ReviewData;
}

export const GroundTruthSection: React.FC<GroundTruthSectionProps> = ({ review }) => {
  const { groundTruth } = review;

  const formatText = () => {
    return `Status: ${groundTruth.statusLabel} | Agent Tag: ${groundTruth.agentStatus} | Rejection Reason: ${groundTruth.rejectionReason || 'none'}`;
  };

  return (
    <div className="w-full">
      <p className="text-sm text-[#CCCCCC]">
        {formatText()}
      </p>
    </div>
  );
};
