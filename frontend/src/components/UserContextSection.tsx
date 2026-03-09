import React from 'react';
import { ReviewData } from '../types';

interface UserContextSectionProps {
  review: ReviewData;
}

export const UserContextSection: React.FC<UserContextSectionProps> = ({ review }) => {
  const { reviewer, accountContext, derivedSignals } = review;
  const account = accountContext.account;

  const formatText = () => {
    return `NAME: ${reviewer.name}
EMAIL: ${reviewer.email}
DOMAIN: ${reviewer.emailDomain}
COMPANY: ${reviewer.companyName || '(not provided)'}
POSITION: ${reviewer.position || '(not provided)'}
LOCATION: ${reviewer.location || '(not provided)'}

ACCOUNT DETAILS:
User ID: ${accountContext.userId}
Account Type: ${derivedSignals.inferredLoginMethod === 'google' ? 'Google Login' : 'Email Login'}
Email Verified: ${account.emailVerifiedAt ? 'Yes' : 'No'}
Total Reviews: ${account.totalReviews}
Account Created: ${new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  return (
    <div className="w-full">
      <pre className="text-sm font-sans whitespace-pre-wrap leading-relaxed" style={{ lineHeight: 1.6, color: 'var(--text-body)' }}>
        {formatText()}
      </pre>
    </div>
  );
};
