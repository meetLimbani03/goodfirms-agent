import React from 'react';
import { ReviewData } from '../types';

interface ExtraContextSectionProps {
  review: ReviewData;
}

export const ExtraContextSection: React.FC<ExtraContextSectionProps> = ({ review }) => {
  const { internalMetadata } = review;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <div>
          <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Created At</span>
          <p className="text-sm" style={{ color: 'var(--text-body)' }}>{internalMetadata.createdAt}</p>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Updated At</span>
          <p className="text-sm" style={{ color: 'var(--text-body)' }}>{internalMetadata.updatedAt}</p>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Reject Reason</span>
          <p className="text-sm" style={{ color: 'var(--text-body)' }}>{internalMetadata.rejectionReason || 'None'}</p>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--text-muted)' }}>Request Token</span>
          <p className="text-sm" style={{ color: 'var(--text-body)' }}>{internalMetadata.requestToken || 'None'}</p>
        </div>
      </div>
    </div>
  );
};
