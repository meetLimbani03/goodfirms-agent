import React from 'react';
import { DailyRun, ReviewData } from '../types';
import { DailyRunCard } from './DailyRunCard';
import { Sun, PanelLeftClose } from 'lucide-react';

interface SidebarProps {
  dailyRuns: DailyRun[];
  selectedRunId: string | null;
  selectedReviewId: string | null;
  expandedRunIds: string[];
  currentReviews: ReviewData[];
  onRunToggle: (runId: string) => void;
  onRunSelect: (runId: string) => void;
  onReviewSelect: (review: ReviewData) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  dailyRuns,
  selectedRunId,
  selectedReviewId,
  expandedRunIds,
  currentReviews,
  onRunToggle,
  onRunSelect,
  onReviewSelect,
  isCollapsed,
  onToggleCollapse,
}) => {
  if (isCollapsed) {
    return (
      <div className="w-16 bg-[#0F0F0F] border-r border-[#2A2A2A] flex flex-col items-center py-5">
        <button
          onClick={onToggleCollapse}
          className="w-10 h-10 flex items-center justify-center hover:bg-[#1E1E1E] transition-colors"
        >
          <PanelLeftClose className="w-5 h-5 text-[#888888]" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 bg-[#0F0F0F] border-r border-[#E0E0E0] flex flex-col">
      {/* Header with Logo and Collapse */}
      <div className="flex items-center justify-between px-6 py-5">
        <h1 className="text-xl font-bold text-white italic" style={{ fontFamily: 'Playfair Display, serif' }}>
          GoodFirms Agent
        </h1>
        <div className="flex items-center gap-3">
          <button className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity">
            <Sun className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity"
          >
            <PanelLeftClose className="w-5 h-5 text-[#888888]" />
          </button>
        </div>
      </div>

      {/* Daily Runs Section */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <h2 className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3 px-2">
          Daily Runs
        </h2>
        <div className="space-y-3">
          {dailyRuns.map((run) => (
            <DailyRunCard
              key={run.id}
              run={run}
              isExpanded={expandedRunIds.includes(run.id)}
              onToggle={() => onRunToggle(run.id)}
              isSelected={selectedRunId === run.id}
              onSelect={() => onRunSelect(run.id)}
              reviews={run.reviews}
              selectedReviewId={selectedReviewId}
              onReviewSelect={onReviewSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
