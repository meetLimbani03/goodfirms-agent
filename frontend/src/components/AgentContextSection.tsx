import React from 'react';
import { ReviewData } from '../types';

interface AgentContextSectionProps {
  review: ReviewData;
}

export const AgentContextSection: React.FC<AgentContextSectionProps> = ({ review }) => {
  return (
    <div className="w-full">
      <pre
        className="text-sm font-sans whitespace-pre-wrap leading-relaxed"
        style={{ lineHeight: 1.6, color: 'var(--text-body)' }}
      >
        {review.agentRun?.contextMarkdown || 'No agent context is available for this review yet.'}
      </pre>
    </div>
  );
};
