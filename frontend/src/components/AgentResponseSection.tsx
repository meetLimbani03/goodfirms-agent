import React from 'react';
import { ReviewData } from '../types';

interface AgentResponseSectionProps {
  review: ReviewData;
}

export const AgentResponseSection: React.FC<AgentResponseSectionProps> = ({ review }) => {
  if (!review.agentRun) {
    return (
      <div className="w-full p-5" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
        <p className="text-sm leading-relaxed" style={{ lineHeight: 1.6, color: 'var(--text-body)' }}>
          No manual agent response is available for this review yet.
        </p>
      </div>
    );
  }

  const { agentRun } = review;
  const hasRewriteSuggestions = Boolean(
    agentRun.improvedTitle ||
      agentRun.improvedSummary ||
      agentRun.improvedStrength ||
      agentRun.improvedWeakness
  );
  const formatFlag = (value: string) =>
    value
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  const formatFinalDecision = (value: string) =>
    value
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  const formatConfidence = (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1);
  const formatCount = (value: number) => value.toLocaleString('en-US');
  const formatUsd = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 6,
      maximumFractionDigits: 6,
    }).format(value);
  const usage = agentRun.llmUsageSummary;

  return (
    <div className="w-full space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
          <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            Final Decision
          </span>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {formatFinalDecision(agentRun.finalDecision)}
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-body)' }}>
            Agent reject reason: {agentRun.rejectReason || 'No recommendation'}
          </p>
        </div>
        <div className="p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
          <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            Confidence
          </span>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {formatConfidence(agentRun.confidence)}
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-body)' }}>
            Confidence reflects how strong and internally consistent the available evidence was.
          </p>
        </div>
        <div className="p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
          <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            Decision Summary
          </span>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
            {agentRun.decisionSummary}
          </p>
        </div>
      </div>

      <div className="p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
        <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
          Risk Flags
        </span>
        <p className="text-sm" style={{ color: 'var(--text-body)' }}>
          {agentRun.riskFlags.map(formatFlag).join(', ') || 'No risk flags detected'}
        </p>
      </div>

      <div className="p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
        <span className="mb-3 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
          OpenRouter Usage
        </span>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <span className="mb-1 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Prompt Tokens
            </span>
            <p className="text-sm" style={{ color: 'var(--text-body)' }}>{formatCount(usage.prompt_tokens)}</p>
          </div>
          <div>
            <span className="mb-1 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Completion Tokens
            </span>
            <p className="text-sm" style={{ color: 'var(--text-body)' }}>{formatCount(usage.completion_tokens)}</p>
          </div>
          <div>
            <span className="mb-1 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Total Tokens
            </span>
            <p className="text-sm" style={{ color: 'var(--text-body)' }}>{formatCount(usage.total_tokens)}</p>
          </div>
          <div>
            <span className="mb-1 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Reasoning Tokens
            </span>
            <p className="text-sm" style={{ color: 'var(--text-body)' }}>{formatCount(usage.reasoning_tokens)}</p>
          </div>
          <div>
            <span className="mb-1 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Cached Read Tokens
            </span>
            <p className="text-sm" style={{ color: 'var(--text-body)' }}>{formatCount(usage.cached_read_tokens)}</p>
          </div>
          <div>
            <span className="mb-1 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Cache Write Tokens
            </span>
            <p className="text-sm" style={{ color: 'var(--text-body)' }}>{formatCount(usage.cache_write_tokens)}</p>
          </div>
          <div>
            <span className="mb-1 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Exact OpenRouter Cost
            </span>
            <p className="text-sm" style={{ color: 'var(--text-body)' }}>{formatUsd(usage.exact_openrouter_cost)}</p>
          </div>
          <div>
            <span className="mb-1 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Cache Savings
            </span>
            <p className="text-sm" style={{ color: 'var(--text-body)' }}>{formatUsd(usage.cache_savings)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {agentRun.checklistResults.map((check) => (
          <div
            key={check.name}
            className="p-4"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
          >
            <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              {check.name}
            </span>
            <p className="text-sm font-medium uppercase" style={{ color: 'var(--text-primary)' }}>
              {check.status}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-body)' }}>
              {check.reason}
            </p>
          </div>
        ))}
      </div>

      {hasRewriteSuggestions ? (
        <div className="grid gap-4">
          {agentRun.changeRationale && agentRun.changeRationale.length > 0 ? (
            <div className="p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
              <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                Change Rationale
              </span>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                {agentRun.changeRationale.join(' ')}
              </p>
            </div>
          ) : null}

          {agentRun.improvedTitle ? (
            <div className="p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
              <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                Improved Title
              </span>
              <p className="text-sm" style={{ color: 'var(--text-body)' }}>{agentRun.improvedTitle}</p>
            </div>
          ) : null}

          {agentRun.improvedSummary ? (
            <div className="p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
              <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                Improved Summary
              </span>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>{agentRun.improvedSummary}</p>
            </div>
          ) : null}

          {(agentRun.improvedStrength || agentRun.improvedWeakness) ? (
            <div className="grid gap-4 md:grid-cols-2">
              {agentRun.improvedStrength ? (
                <div className="p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                    Improved Strength
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>{agentRun.improvedStrength}</p>
                </div>
              ) : null}
              {agentRun.improvedWeakness ? (
                <div className="p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                    Improved Weakness
                  </span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>{agentRun.improvedWeakness}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
