import React from 'react';
import { ReviewData } from '../types';

interface ExtraContextSectionProps {
  review: ReviewData;
}

export const ExtraContextSection: React.FC<ExtraContextSectionProps> = ({ review }) => {
  const { internalMetadata } = review;
  const agentRun = review.agentRun;
  const displayStatus = internalMetadata.status === 'Pending' ? 'Pending Approval' : internalMetadata.status;
  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-3">
        <div>
          <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Created At</span>
          <p className="text-sm" style={{ color: 'var(--text-body)' }}>{formatDate(internalMetadata.createdAt)}</p>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Updated At</span>
          <p className="text-sm" style={{ color: 'var(--text-body)' }}>{formatDate(internalMetadata.updatedAt)}</p>
        </div>
        {agentRun?.testMode && internalMetadata.rejectionReason ? (
          <div>
            <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Actual Reject Reason</span>
            <p className="text-sm" style={{ color: 'var(--text-body)' }}>{internalMetadata.rejectionReason}</p>
          </div>
        ) : (
          <div>
            <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Current Status</span>
            <p className="text-sm" style={{ color: 'var(--text-body)' }}>{displayStatus}</p>
          </div>
        )}
        <div>
          <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Review Request Token</span>
          <p className="text-sm" style={{ color: 'var(--text-body)' }}>{internalMetadata.requestToken || 'Not available'}</p>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Agent Model</span>
          <p className="text-sm" style={{ color: 'var(--text-body)' }}>{agentRun?.model || 'Not available'}</p>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Run Mode</span>
          <p className="text-sm" style={{ color: 'var(--text-body)' }}>{agentRun ? (agentRun.testMode ? 'Test' : 'Live') : 'Not available'}</p>
        </div>
      </div>
    </div>
  );
};
