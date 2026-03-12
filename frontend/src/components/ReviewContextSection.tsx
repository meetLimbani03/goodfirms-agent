import React from 'react';
import { ReviewData } from '../types';
import { getReviewTypeLabel } from '../data/mockData';

interface ReviewContextSectionProps {
  review: ReviewData;
}

export const ReviewContextSection: React.FC<ReviewContextSectionProps> = ({ review }) => {
  const { subject, usage, review: reviewContent } = review;
  const typeLabel = getReviewTypeLabel(review.reviewType).toUpperCase();
  const postingPreference = review.reviewer.postingPreferenceLabel || '(not provided)';

  const formatText = () => {
    return `${typeLabel}:
• Name: ${subject.name}
• Slug: ${subject.slug}
• Categories: ${subject.categories.join(', ')}

USAGE:
• Duration: ${usage.durationValue} ${usage.durationUnit}
• Frequency: ${usage.frequency}
• Pricing: ${usage.pricing}
• Integrated Other Software: ${usage.integratedOtherSoftware}
• Integrated Software: ${usage.integratedSoftware.length > 0 ? usage.integratedSoftware.join(', ') : 'none'}
• Switched From Other Software: ${usage.switchedFromOtherSoftware}
• Used Software Before Switch: ${usage.usedSoftwareBeforeSwitch.length > 0 ? usage.usedSoftwareBeforeSwitch.join(', ') : 'none'}

REVIEW TITLE:
${reviewContent.title}

SUMMARY:
${reviewContent.summary}

STRENGTHS:
${reviewContent.strength}

WEAKNESSES:
${reviewContent.weakness}

RATINGS:
• Ease of Use: ${reviewContent.ratings.easeOfUse}/5
• Features & Functionality: ${reviewContent.ratings.featuresFunctionality}/5
• Customer Support: ${reviewContent.ratings.customerSupport}/5
• Overall: ${reviewContent.ratings.overall}/5

POSTING PREFERENCE:
${postingPreference}`;
  };

  return (
    <div className="w-full">
      <pre className="text-sm font-sans whitespace-pre-wrap leading-relaxed" style={{ lineHeight: 1.6, color: 'var(--text-body)' }}>
        {formatText()}
      </pre>
    </div>
  );
};
