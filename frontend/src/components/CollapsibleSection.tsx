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
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div 
          className="w-7 h-7 flex items-center justify-center bg-[#1E1E1E]"
          style={{ border: '2px solid #888888' }}
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-[#CCCCCC]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#CCCCCC]" />
          )}
        </div>
      </button>
      
      {/* Section Content */}
      {isOpen && (
        <div className="mt-3">
          <div 
            className="w-full bg-[#1E1E1E] p-4"
            style={{ border: '1px solid #2A2A2A' }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
