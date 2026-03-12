import React from 'react';
import { DailyRun, ReviewData, ReviewType, ServiceAgentApiResponse, SoftwareAgentApiResponse } from '../types';
import { DailyRunCard } from './DailyRunCard';
import { Moon, Sun, PanelLeftClose } from 'lucide-react';
import { getReviewTypeLabel } from '../data/mockData';
import { ManualReviewTrigger } from './ManualReviewTrigger';
import { runServiceAgent } from '../lib/serviceAgent';
import { runSoftwareAgent } from '../lib/softwareAgent';

interface SidebarProps {
  theme: 'dark' | 'light';
  reviewType: ReviewType;
  dailyRuns: DailyRun[];
  width: number;
  selectedRunId: string | null;
  selectedReviewId: string | null;
  expandedRunIds: string[];
  onReviewTypeChange: (reviewType: ReviewType) => void;
  onRunToggle: (runId: string) => void;
  onRunSelect: (runId: string) => void;
  onReviewSelect: (review: ReviewData) => void;
  onManualSoftwareSuccess: (response: SoftwareAgentApiResponse, testMode: boolean) => void;
  onManualServiceSuccess: (response: ServiceAgentApiResponse, testMode: boolean) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  theme,
  reviewType,
  dailyRuns,
  width,
  selectedRunId,
  selectedReviewId,
  expandedRunIds,
  onReviewTypeChange,
  onRunToggle,
  onRunSelect,
  onReviewSelect,
  onManualSoftwareSuccess,
  onManualServiceSuccess,
  isCollapsed,
  onToggleCollapse,
  onToggleTheme,
}) => {
  if (isCollapsed) {
    return (
      <div
        className="w-16 border-r flex flex-col items-center py-5"
        style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-default)' }}
      >
        <button
          onClick={onToggleTheme}
          className="w-10 h-10 mb-3 flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-primary)' }}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button
          onClick={onToggleCollapse}
          className="w-10 h-10 flex items-center justify-center transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <PanelLeftClose className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="border-r flex flex-col"
      style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-strong)', width }}
    >
      {/* Header with Logo and Collapse */}
      <div className="flex items-center justify-between px-6 py-5">
        <h1
          className="text-xl font-bold italic"
          style={{ fontFamily: 'Playfair Display, serif', color: 'var(--text-primary)' }}
        >
          GoodFirms Agent
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-primary)' }}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={onToggleCollapse}
            className="w-5 h-5 flex items-center justify-center hover:opacity-70 transition-opacity"
          >
            <PanelLeftClose className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      {/* Daily Runs Section */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-2 gap-2 mb-5">
          {(['SOFTWARE', 'SERVICE'] as ReviewType[]).map((type) => {
            const isActive = reviewType === type;

            return (
              <button
                key={type}
                onClick={() => onReviewTypeChange(type)}
                className="px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] transition-colors"
                style={{
                  backgroundColor: isActive ? '#F3EBDD' : '#1A1A1A',
                  color: isActive ? '#111111' : '#8F8A80',
                  border: `1px solid ${isActive ? '#F3EBDD' : '#2A2A2A'}`,
                }}
              >
                {getReviewTypeLabel(type)}
              </button>
            );
          })}
        </div>
        {reviewType === 'SOFTWARE' ? (
          <ManualReviewTrigger
            reviewType="SOFTWARE"
            onSuccess={onManualSoftwareSuccess}
            runReviewAgent={runSoftwareAgent}
          />
        ) : (
          <ManualReviewTrigger
            reviewType="SERVICE"
            onSuccess={onManualServiceSuccess}
            runReviewAgent={runServiceAgent}
          />
        )}
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-3 px-2"
          style={{ color: 'var(--text-subtle)' }}
        >
          {getReviewTypeLabel(reviewType)} Runs
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
