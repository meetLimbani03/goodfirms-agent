import React from 'react';
import { ReviewData } from '../types';
import { getReviewTypeLabel, getStatusType } from '../data/mockData';

interface ReviewItemProps {
  review: ReviewData;
  isSelected: boolean;
  onClick: () => void;
}

export const ReviewItem: React.FC<ReviewItemProps> = ({ review, isSelected, onClick }) => {
  const status = getStatusType(review);
  const selectedOutline = '0 0 0 1px var(--accent-muted) inset';

  const getStatusStyles = () => {
    const selectedBg = 'var(--bg-elevated)';
    const defaultBg = 'var(--bg-card)';

    switch (status) {
      case 'PENDING':
        return {
          bg: isSelected ? 'color-mix(in srgb, var(--accent-muted) 12%, var(--bg-elevated))' : defaultBg,
          badgeBg: 'var(--bg-subtle)',
          badgeText: 'var(--text-muted)',
          titleColor: 'var(--text-primary)',
          metaColor: 'var(--text-muted)',
        };
      case 'PROCESSING':
        return {
          bg: isSelected ? 'color-mix(in srgb, var(--info) 10%, var(--bg-elevated))' : defaultBg,
          badgeBg: 'color-mix(in srgb, var(--info) 18%, var(--bg-card))',
          badgeText: 'var(--info)',
          titleColor: 'var(--text-primary)',
          metaColor: 'var(--text-muted)',
        };
      case 'PUBLISHED':
        return {
          bg: isSelected
            ? 'color-mix(in srgb, var(--success) 18%, var(--bg-elevated))'
            : 'color-mix(in srgb, var(--success) 8%, var(--bg-card))',
          badgeBg: 'color-mix(in srgb, var(--success) 70%, black 10%)',
          badgeText: '#FFFFFF',
          titleColor: 'var(--text-primary)',
          metaColor: 'var(--text-muted)',
        };
      case 'APPROVED':
        return {
          bg: isSelected
            ? 'color-mix(in srgb, var(--success) 24%, var(--bg-elevated))'
            : 'color-mix(in srgb, var(--success) 14%, var(--bg-card))',
          badgeBg: 'var(--success)',
          badgeText: '#FFFFFF',
          titleColor: 'var(--text-primary)',
          metaColor: 'var(--text-muted)',
        };
      case 'REJECTED':
        return {
          bg: isSelected ? 'color-mix(in srgb, var(--error) 10%, var(--bg-elevated))' : defaultBg,
          badgeBg: 'transparent',
          badgeText: 'var(--error)',
          titleColor: 'var(--text-primary)',
          metaColor: 'var(--text-muted)',
        };
      case 'FLAGGED':
      default:
        return {
          bg: isSelected ? 'color-mix(in srgb, var(--warning) 12%, var(--bg-elevated))' : defaultBg,
          badgeBg: 'color-mix(in srgb, var(--warning) 18%, var(--bg-card))',
          badgeText: 'var(--warning)',
          titleColor: 'var(--text-primary)',
          metaColor: 'var(--text-subtle)',
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 transition-colors"
      style={{
        backgroundColor: styles.bg,
        boxShadow: isSelected ? selectedOutline : 'none',
      }}
    >
      <div className="flex flex-col gap-1.5 text-left">
        <span 
          className="text-[13px] font-medium truncate max-w-[140px]"
          style={{ color: styles.titleColor }}
        >
          {review.review.title}
        </span>
        <div className="flex flex-col gap-1">
          <span className="text-[11px]" style={{ color: styles.metaColor }}>
            {review.subject.name} • {review.reviewer.name}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--accent-muted)' }}>
            {getReviewTypeLabel(review.reviewType)}
          </span>
        </div>
      </div>
      <span 
        className="text-[10px] font-semibold px-2.5 py-1"
        style={{ 
          backgroundColor: status === 'REJECTED' ? 'transparent' : styles.badgeBg,
          color: styles.badgeText,
          border: status === 'REJECTED' ? '1px solid var(--error)' : 'none',
          borderRadius: '2px',
        }}
      >
        {status}
      </span>
    </button>
  );
};
