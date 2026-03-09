import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { dailyRuns, sampleReview } from '../data/mockData';
import { ReviewData } from '../types';

export const AdminPanel: React.FC = () => {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(dailyRuns[0].id);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(
    sampleReview.internalMetadata.reviewId
  );
  const [expandedRunIds, setExpandedRunIds] = useState<string[]>([dailyRuns[0].id]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const currentRun = dailyRuns.find((run) => run.id === selectedRunId);
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
    const run = dailyRuns.find((r) => r.id === runId);
    if (run && run.reviews.length > 0) {
      setSelectedReviewId(run.reviews[0].internalMetadata.reviewId);
    }
  };

  const handleReviewSelect = (review: ReviewData) => {
    setSelectedReviewId(review.internalMetadata.reviewId);
  };

  return (
    <div className="flex h-screen bg-[#0A0A0A]">
      <Sidebar
        dailyRuns={dailyRuns}
        selectedRunId={selectedRunId}
        selectedReviewId={selectedReviewId}
        expandedRunIds={expandedRunIds}
        currentReviews={currentRun?.reviews || []}
        onRunToggle={handleRunToggle}
        onRunSelect={handleRunSelect}
        onReviewSelect={handleReviewSelect}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <MainContent review={currentReview || null} />
    </div>
  );
};
