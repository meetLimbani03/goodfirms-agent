import React from 'react';
import { ReviewData } from '../types';
import { getReviewTypeLabel } from '../data/mockData';

interface AgentResponseSectionProps {
  review: ReviewData;
}

export const AgentResponseSection: React.FC<AgentResponseSectionProps> = ({ review }) => {
  const subjectType = getReviewTypeLabel(review.reviewType).toLowerCase();
  const responseText = `Thank you for your detailed feedback on ${review.subject.name}, ${review.reviewer.name}. We appreciate you sharing your experience with this ${subjectType} and giving specific context around what worked well and what needs improvement. Your review helps us keep moderation decisions grounded in real buyer feedback.`;

  return (
    <div className="w-full p-5" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
      <p className="text-sm leading-relaxed" style={{ lineHeight: 1.6, color: 'var(--text-body)' }}>
        {responseText}
      </p>
    </div>
  );
};
