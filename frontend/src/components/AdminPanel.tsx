import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';
import { RunFeedbackDrawer } from './RunFeedbackDrawer';
import {
  AgentRunListItem,
  IdentityVerificationResult,
  ReviewData,
  ReviewType,
  ServiceAgentApiResponse,
  SoftwareAgentApiResponse,
} from '../types';
import { mapServiceAgentResponseToReview } from '../lib/serviceAgent';
import { mapSoftwareAgentResponseToReview } from '../lib/softwareAgent';
import { runIdentityVerification } from '../lib/reviewVerification';
import {
  agentRunListItemFromApiResponse,
  fetchAgentRunDetail,
  fetchAgentRunHistoryList,
  groupAgentRunHistory,
  submitAgentRunFeedback,
} from '../lib/agentRunHistory';
const SIDEBAR_WIDTH_STORAGE_KEY = 'goodfirms-admin-sidebar-width';
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 520;
const SIDEBAR_DEFAULT_WIDTH = 320;

const clampSidebarWidth = (value: number) =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, value));

export const AdminPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    const storedTheme = window.localStorage.getItem('goodfirms-admin-theme');
    return storedTheme === 'light' ? 'light' : 'dark';
  });
  const [selectedReviewType, setSelectedReviewType] = useState<ReviewType>('SOFTWARE');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedReviewKey, setSelectedReviewKey] = useState<string | null>(null);
  const [expandedRunIds, setExpandedRunIds] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [feedbackDrawerOpen, setFeedbackDrawerOpen] = useState(false);
  const [feedbackErrorMessage, setFeedbackErrorMessage] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<
    Partial<Record<'hunter' | 'contactout' | 'apollo', IdentityVerificationResult>>
  >({});
  const [verificationErrorMessage, setVerificationErrorMessage] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return SIDEBAR_DEFAULT_WIDTH;
    }

    const storedWidth = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    return Number.isFinite(storedWidth) ? clampSidebarWidth(storedWidth) : SIDEBAR_DEFAULT_WIDTH;
  });

  useEffect(() => {
    document.body.dataset.theme = theme;
    window.localStorage.setItem('goodfirms-admin-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    setFeedbackDrawerOpen(false);
    setFeedbackErrorMessage(null);
    setVerificationResults({});
    setVerificationErrorMessage(null);
  }, [selectedReviewKey, selectedReviewType]);

  const softwareHistoryQuery = useQuery({
    queryKey: ['agent-run-history', 'SOFTWARE'],
    queryFn: () => fetchAgentRunHistoryList('SOFTWARE'),
  });
  const serviceHistoryQuery = useQuery({
    queryKey: ['agent-run-history', 'SERVICE'],
    queryFn: () => fetchAgentRunHistoryList('SERVICE'),
  });

  const softwareRuns = useMemo(
    () => groupAgentRunHistory(softwareHistoryQuery.data ?? [], 'SOFTWARE'),
    [softwareHistoryQuery.data]
  );
  const serviceRuns = useMemo(
    () => groupAgentRunHistory(serviceHistoryQuery.data ?? [], 'SERVICE'),
    [serviceHistoryQuery.data]
  );
  const currentRuns = selectedReviewType === 'SOFTWARE' ? softwareRuns : serviceRuns;
  const currentRun = currentRuns.find((run) => run.id === selectedRunId);
  const selectedSummaryReview =
    currentRun?.reviews.find(
      (review) => (review.internalMetadata.runId ?? review.internalMetadata.reviewId) === selectedReviewKey
    ) ?? null;

  const persistedRunId = selectedSummaryReview?.internalMetadata.runId ?? null;
  const selectedReviewDetailQuery = useQuery({
    queryKey: ['agent-run-detail', persistedRunId, selectedReviewType],
    queryFn: () => fetchAgentRunDetail(persistedRunId!, selectedReviewType),
    enabled: Boolean(persistedRunId),
  });

  const currentReview = selectedReviewDetailQuery.data ?? selectedSummaryReview;
  const feedbackMutation = useMutation({
    mutationFn: ({ runId, reviewType, feedback }: { runId: string; reviewType: ReviewType; feedback: string }) =>
      submitAgentRunFeedback(runId, reviewType, feedback),
    onSuccess: (updatedReview) => {
      const runId = updatedReview.internalMetadata.runId;
      if (runId) {
        queryClient.setQueryData(['agent-run-detail', runId, updatedReview.reviewType], updatedReview);
      }
      setFeedbackErrorMessage(null);
      setFeedbackDrawerOpen(false);
    },
    onError: (error) => {
      setFeedbackErrorMessage(error instanceof Error ? error.message : 'Failed to save feedback');
    },
  });
  const identityVerificationMutation = useMutation({
    mutationFn: ({
      reviewType,
      reviewId,
      provider,
    }: {
      reviewType: ReviewType;
      reviewId: string;
      provider: 'hunter' | 'contactout' | 'apollo';
    }) => runIdentityVerification({ reviewType, reviewId, provider }),
    onSuccess: (result) => {
      setVerificationResults((current) => ({
        ...current,
        [result.provider]: result,
      }));
      setVerificationErrorMessage(null);
    },
    onError: (error) => {
      setVerificationErrorMessage(error instanceof Error ? error.message : 'Verification failed');
    },
  });

  useEffect(() => {
    if (currentRuns.length === 0) {
      if (selectedRunId !== null) {
        setSelectedRunId(null);
      }
      if (selectedReviewKey !== null) {
        setSelectedReviewKey(null);
      }
      if (expandedRunIds.length > 0) {
        setExpandedRunIds([]);
      }
      return;
    }

    const runStillExists = selectedRunId ? currentRuns.some((run) => run.id === selectedRunId) : false;
    const nextRun = runStillExists
      ? currentRuns.find((run) => run.id === selectedRunId) ?? currentRuns[0]
      : currentRuns[0];

    if (selectedRunId !== nextRun.id) {
      setSelectedRunId(nextRun.id);
    }

    if (!runStillExists && !expandedRunIds.includes(nextRun.id)) {
      setExpandedRunIds([nextRun.id]);
    }

    const reviewStillExists = selectedReviewKey
      ? nextRun.reviews.some((review) => (review.internalMetadata.runId ?? review.internalMetadata.reviewId) === selectedReviewKey)
      : false;
    const nextReview = reviewStillExists
      ? nextRun.reviews.find(
          (review) => (review.internalMetadata.runId ?? review.internalMetadata.reviewId) === selectedReviewKey
        ) ?? nextRun.reviews[0]
      : nextRun.reviews[0];

    const nextReviewKey = nextReview
      ? nextReview.internalMetadata.runId ?? nextReview.internalMetadata.reviewId
      : null;
    if (selectedReviewKey !== nextReviewKey) {
      setSelectedReviewKey(nextReviewKey);
    }
  }, [currentRuns, selectedRunId, selectedReviewKey, expandedRunIds]);

  const handleRunToggle = (runId: string) => {
    setExpandedRunIds((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]
    );
  };

  const handleRunSelect = (runId: string) => {
    setSelectedRunId(runId);
    const run = currentRuns.find((r) => r.id === runId);
    if (run && run.reviews.length > 0) {
      setSelectedReviewKey(run.reviews[0].internalMetadata.runId ?? run.reviews[0].internalMetadata.reviewId);
    }
  };

  const handleReviewTypeChange = (reviewType: ReviewType) => {
    setSelectedReviewType(reviewType);
    setSelectedRunId(null);
    setSelectedReviewKey(null);
    setExpandedRunIds([]);
  };

  const handleReviewSelect = (review: ReviewData) => {
    setSelectedReviewKey(review.internalMetadata.runId ?? review.internalMetadata.reviewId);
  };

  const handleManualSoftwareSuccess = (
    response: SoftwareAgentApiResponse,
    testMode: boolean
  ) => {
    const mappedReview = mapSoftwareAgentResponseToReview(response, testMode);
    const listItem = agentRunListItemFromApiResponse(response, 'SOFTWARE');
    if (response.run_id) {
      queryClient.setQueryData(['agent-run-detail', response.run_id, 'SOFTWARE'], mappedReview);
    }
    if (listItem) {
      queryClient.setQueryData(
        ['agent-run-history', 'SOFTWARE'],
        (current: AgentRunListItem[] | undefined) => {
          const list = Array.isArray(current) ? current : [];
          return [listItem, ...list.filter((item) => item.run_id !== listItem.run_id)];
        }
      );
    } else {
      queryClient.invalidateQueries({ queryKey: ['agent-run-history', 'SOFTWARE'] });
    }
    queryClient.invalidateQueries({ queryKey: ['agent-run-history', 'SOFTWARE'] });
    setSelectedReviewType('SOFTWARE');
    setSelectedRunId(
      `software-${(listItem?.completed_at ?? listItem?.created_at ?? new Date().toISOString()).slice(0, 10)}`
    );
    setSelectedReviewKey(mappedReview.internalMetadata.runId ?? mappedReview.internalMetadata.reviewId);
  };

  const handleManualServiceSuccess = (
    response: ServiceAgentApiResponse,
    testMode: boolean
  ) => {
    const mappedReview = mapServiceAgentResponseToReview(response, testMode);
    const listItem = agentRunListItemFromApiResponse(response, 'SERVICE');
    if (response.run_id) {
      queryClient.setQueryData(['agent-run-detail', response.run_id, 'SERVICE'], mappedReview);
    }
    if (listItem) {
      queryClient.setQueryData(
        ['agent-run-history', 'SERVICE'],
        (current: AgentRunListItem[] | undefined) => {
          const list = Array.isArray(current) ? current : [];
          return [listItem, ...list.filter((item) => item.run_id !== listItem.run_id)];
        }
      );
    } else {
      queryClient.invalidateQueries({ queryKey: ['agent-run-history', 'SERVICE'] });
    }
    queryClient.invalidateQueries({ queryKey: ['agent-run-history', 'SERVICE'] });
    setSelectedReviewType('SERVICE');
    setSelectedRunId(
      `service-${(listItem?.completed_at ?? listItem?.created_at ?? new Date().toISOString()).slice(0, 10)}`
    );
    setSelectedReviewKey(mappedReview.internalMetadata.runId ?? mappedReview.internalMetadata.reviewId);
  };

  const handleSidebarResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setSidebarWidth(clampSidebarWidth(moveEvent.clientX));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleOpenFeedback = () => {
    if (!currentReview?.internalMetadata.runId) {
      return;
    }

    setFeedbackErrorMessage(null);
    setFeedbackDrawerOpen(true);
  };

  const handleSubmitFeedback = async (feedback: string) => {
    if (!currentReview?.internalMetadata.runId) {
      return;
    }

    await feedbackMutation.mutateAsync({
      runId: currentReview.internalMetadata.runId,
      reviewType: currentReview.reviewType,
      feedback,
    });
  };

  const handleIdentityVerification = async (provider: 'hunter' | 'contactout' | 'apollo') => {
    if (!currentReview) {
      return;
    }
    await identityVerificationMutation.mutateAsync({
      reviewType: currentReview.reviewType,
      reviewId: currentReview.internalMetadata.reviewId,
      provider,
    });
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-body)' }}>
      <Sidebar
        theme={theme}
        reviewType={selectedReviewType}
        dailyRuns={currentRuns}
        width={sidebarWidth}
        selectedRunId={selectedRunId}
        selectedReviewId={selectedReviewKey}
        expandedRunIds={expandedRunIds}
        onReviewTypeChange={handleReviewTypeChange}
        onRunToggle={handleRunToggle}
        onRunSelect={handleRunSelect}
        onReviewSelect={handleReviewSelect}
        onManualSoftwareSuccess={handleManualSoftwareSuccess}
        onManualServiceSuccess={handleManualServiceSuccess}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      />
      {!sidebarCollapsed ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          onMouseDown={handleSidebarResizeStart}
          className="sidebar-resize-handle"
        />
      ) : null}
      <MainContent
        review={currentReview || null}
        onOpenFeedback={handleOpenFeedback}
        verificationResults={verificationResults}
        verificationErrorMessage={verificationErrorMessage}
        isVerificationRunning={identityVerificationMutation.isPending}
        verificationProviderPending={identityVerificationMutation.variables?.provider ?? null}
        onRunIdentityVerification={handleIdentityVerification}
      />
      <RunFeedbackDrawer
        review={currentReview || null}
        isOpen={feedbackDrawerOpen}
        isSubmitting={feedbackMutation.isPending}
        errorMessage={feedbackErrorMessage}
        onClose={() => {
          if (!feedbackMutation.isPending) {
            setFeedbackDrawerOpen(false);
            setFeedbackErrorMessage(null);
          }
        }}
        onSubmit={handleSubmitFeedback}
      />
    </div>
  );
};
