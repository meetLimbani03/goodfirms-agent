import React from 'react';
import { ReviewData } from '../types';

interface ProvenanceSectionProps {
  review: ReviewData;
}

export const ProvenanceSection: React.FC<ProvenanceSectionProps> = ({ review }) => {
  const { provenance } = review;

  const formatText = () => {
    return `MongoDB Collection: goodfirms.${provenance.mongoCollection} | MySQL Database: ${provenance.mySqlDatabase}`;
  };

  return (
    <div className="w-full">
      <p className="text-sm text-[#CCCCCC]">
        {formatText()}
      </p>
    </div>
  );
};
