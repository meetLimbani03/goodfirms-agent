import React from 'react';
import { ReviewData } from '../types';

interface UserContextSectionProps {
  review: ReviewData;
}

export const UserContextSection: React.FC<UserContextSectionProps> = ({ review }) => {
  const { reviewer, accountContext, derivedSignals } = review;
  const account = accountContext.account;
  const accountCreated =
    account.createdAt && !Number.isNaN(new Date(account.createdAt).getTime())
      ? new Date(account.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Not available';
  const accountType = derivedSignals.inferredLoginMethod === 'unknown'
    ? 'Unknown'
    : derivedSignals.inferredLoginMethod === 'google'
      ? 'Google Login'
      : derivedSignals.inferredLoginMethod === 'linkedin'
        ? 'LinkedIn Login'
        : 'Email Login';

  const formatText = () => {
    return `NAME: ${reviewer.name}
EMAIL: ${reviewer.email}
COMPANY: ${reviewer.companyName || '(not provided)'}
POSITION: ${reviewer.position || '(not provided)'}
LOCATION: ${reviewer.location || '(not provided)'}

ACCOUNT DETAILS:
User ID: ${accountContext.userId}
Account Found: ${accountContext.accountFound ? 'Yes' : 'No'}
Account Type: ${accountType}
Email Verified: ${account.emailVerifiedAt ? 'Yes' : 'Unknown'}
Total Reviews: ${account.totalReviews > 0 ? account.totalReviews : 'Not available'}
Account Created: ${accountCreated}

SIGNALS:
Email Match: ${derivedSignals.reviewEmailMatchesAccountEmail ? 'Yes' : 'No or unknown'}
Name Match: ${derivedSignals.reviewNameMatchesAccountName ? 'Yes' : 'No or unknown'}
Company Match: ${
  derivedSignals.reviewCompanyMatchesAccountCompany === null
    ? 'Unknown'
    : derivedSignals.reviewCompanyMatchesAccountCompany
      ? 'Yes'
      : 'No'
}
Trust Signals: ${derivedSignals.trustSignals.join(', ') || 'None'}
Risk Hints: ${derivedSignals.riskHints.join(', ') || 'None'}`;
  };

  return (
    <div className="w-full">
      <pre className="text-sm font-sans whitespace-pre-wrap leading-relaxed" style={{ lineHeight: 1.6, color: 'var(--text-body)' }}>
        {formatText()}
      </pre>
    </div>
  );
};
