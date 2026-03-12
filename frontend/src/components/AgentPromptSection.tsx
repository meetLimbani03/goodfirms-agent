import React from 'react';
import { ReviewData } from '../types';

interface AgentPromptSectionProps {
  review: ReviewData;
}

export const AgentPromptSection: React.FC<AgentPromptSectionProps> = ({ review }) => {
  return (
    <div className="w-full">
      <pre
        className="text-sm font-sans whitespace-pre-wrap leading-relaxed"
        style={{ lineHeight: 1.6, color: 'var(--text-body)' }}
      >
        {review.agentRun?.promptMarkdown || 'No agent prompt available for this review yet.'}
      </pre>
    </div>
  );
};
