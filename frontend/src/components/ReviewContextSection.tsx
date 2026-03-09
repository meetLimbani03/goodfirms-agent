import React from 'react';
import { ReviewData } from '../types';

interface ReviewContextSectionProps {
  review: ReviewData;
}

export const ReviewContextSection: React.FC<ReviewContextSectionProps> = ({ review }) => {
  const { software, usage, review: reviewContent } = review;

  const formatText = () => {
    return `SOFTWARE:
• Name: ${software.name}
• Slug: ${software.slug}
• Categories: ${software.categories.join(', ')}

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
Display both my name and the company's name with the review`;
  };

  return (
    <div className="w-full">
      <pre className="text-sm text-[#CCCCCC] font-sans whitespace-pre-wrap leading-relaxed" style={{ lineHeight: 1.6 }}>
        {formatText()}
      </pre>
    </div>
  );
};
