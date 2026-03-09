import React, { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { reviewRuns } from '../data/mockData';
import { ReviewData, ReviewType } from '../types';

export const AdminPanel: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    const storedTheme = window.localStorage.getItem('goodfirms-admin-theme');
    return storedTheme === 'light' ? 'light' : 'dark';
  });
  const [selectedReviewType, setSelectedReviewType] = useState<ReviewType>('SOFTWARE');
  const initialRuns = reviewRuns.SOFTWARE;
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRuns[0].id);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(
    initialRuns[0].reviews[0].internalMetadata.reviewId
  );
  const [expandedRunIds, setExpandedRunIds] = useState<string[]>([initialRuns[0].id]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem('goodfirms-admin-theme', theme);
  }, [theme]);

  const currentRuns = reviewRuns[selectedReviewType];
  const currentRun = currentRuns.find((run) => run.id === selectedRunId);
  const currentReview = currentRun?.reviews.find(
    (review) => review.internalMetadata.reviewId === selectedReviewId
  );

  const handleRunToggle = (runId: string) => {
    setExpandedRunIds((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
    );
  };

  const handleRunSelect = (runId: string) => {
    setSelectedRunId(runId);
    const run = currentRuns.find((r) => r.id === runId);
    if (run && run.reviews.length > 0) {
      setSelectedReviewId(run.reviews[0].internalMetadata.reviewId);
    }
  };

  const handleReviewTypeChange = (reviewType: ReviewType) => {
    const nextRuns = reviewRuns[reviewType];
    const firstRun = nextRuns[0] ?? null;
    const firstReview = firstRun?.reviews[0] ?? null;

    setSelectedReviewType(reviewType);
    setSelectedRunId(firstRun?.id ?? null);
    setSelectedReviewId(firstReview?.internalMetadata.reviewId ?? null);
    setExpandedRunIds(firstRun ? [firstRun.id] : []);
  };

  const handleReviewSelect = (review: ReviewData) => {
    setSelectedReviewId(review.internalMetadata.reviewId);
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-body)' }}>
      <Sidebar
        theme={theme}
        reviewType={selectedReviewType}
        dailyRuns={currentRuns}
        selectedRunId={selectedRunId}
        selectedReviewId={selectedReviewId}
        expandedRunIds={expandedRunIds}
        onReviewTypeChange={handleReviewTypeChange}
        onRunToggle={handleRunToggle}
        onRunSelect={handleRunSelect}
        onReviewSelect={handleReviewSelect}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      />
      <MainContent review={currentReview || null} />
    </div>
  );
};
