import React from 'react';
import { ReviewData } from '../types';
import { getStatusType } from '../data/mockData';

interface ReviewItemProps {
  review: ReviewData;
  isSelected: boolean;
  onClick: () => void;
}

export const ReviewItem: React.FC<ReviewItemProps> = ({ review, isSelected, onClick }) => {
  const status = getStatusType(review);

  const getStatusStyles = () => {
    switch (status) {
      case 'APPROVED':
        return {
          bg: isSelected ? '#2A2A2A' : '#2A2A2A',
          badgeBg: '#4CAF50',
          badgeText: '#FFFFFF',
          titleColor: '#FFFFFF',
          metaColor: '#888888',
        };
      case 'REJECTED':
        return {
          bg: isSelected ? '#2A2A2A' : '#1E1E1E',
          badgeBg: '#1E1E1E',
          badgeText: '#F44336',
          titleColor: '#FFFFFF',
          metaColor: '#888888',
        };
      case 'NOT_ELIGIBLE':
      default:
        return {
          bg: isSelected ? '#2A2A2A' : '#1E1E1E',
          badgeBg: '#333333',
          badgeText: '#888888',
          titleColor: '#888888',
          metaColor: '#666666',
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-3 hover:bg-[#252525] transition-colors"
      style={{ backgroundColor: styles.bg }}
    >
      <div className="flex flex-col gap-1.5 text-left">
        <span 
          className="text-[13px] font-medium truncate max-w-[140px]"
          style={{ color: styles.titleColor }}
        >
          {review.review.title}
        </span>
        <span 
          className="text-[11px]"
          style={{ color: styles.metaColor }}
        >
          {review.software.name} • {review.reviewer.name}
        </span>
      </div>
      <span 
        className="text-[10px] font-semibold px-2.5 py-1"
        style={{ 
          backgroundColor: status === 'REJECTED' ? 'transparent' : styles.badgeBg,
          color: styles.badgeText,
          border: status === 'REJECTED' ? '1px solid #F44336' : 'none',
          borderRadius: '2px',
        }}
      >
        {status}
      </span>
    </button>
  );
};
