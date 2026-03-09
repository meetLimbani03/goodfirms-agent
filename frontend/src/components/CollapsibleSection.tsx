import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  isOpen,
  onToggle,
  children,
}) => {
  return (
    <div className="w-full">
      {/* Section Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-0 hover:opacity-80 transition-opacity"
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <div 
          className="w-7 h-7 flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-card)', border: '2px solid var(--text-muted)' }}
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-body)' }} />
          ) : (
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-body)' }} />
          )}
        </div>
      </button>
      
      {/* Section Content */}
      {isOpen && (
        <div className="mt-3">
          <div 
            className="w-full p-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
