import React from 'react';
import { ReviewData } from '../types';

interface AgentResponseSectionProps {
  review: ReviewData;
}

export const AgentResponseSection: React.FC<AgentResponseSectionProps> = ({ review }) => {
  const responseText = `Thank you for your detailed feedback on ${review.software.name}, ${review.reviewer.name}! We're thrilled to hear that our real-time rendering capabilities and cinematic quality have transformed your workflow and help you create impressive client presentations. Your feedback about stability with heavy scenes is valuable - we're continuously working on performance improvements. We appreciate you taking the time to share your experience!`;

  return (
    <div className="w-full bg-[#000000] p-5" style={{ border: '1px solid #2A2A2A' }}>
      <p className="text-sm text-[#E0E0E0] leading-relaxed" style={{ lineHeight: 1.6 }}>
        {responseText}
      </p>
    </div>
  );
};
