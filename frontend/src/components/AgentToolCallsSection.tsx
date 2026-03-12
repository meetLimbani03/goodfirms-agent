import React from 'react';
import { ReviewData } from '../types';

interface AgentToolCallsSectionProps {
  review: ReviewData;
}

export const AgentToolCallsSection: React.FC<AgentToolCallsSectionProps> = ({ review }) => {
  const toolTraces = review.agentRun?.toolTraces ?? [];

  const getToolLabel = (toolName: string): string => {
    if (toolName === 'reviewer_review_history_lookup') {
      return 'Reviewer History Lookup';
    }

    if (toolName === 'public_web_search') {
      return 'Public Web Search';
    }

    return toolName
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  if (toolTraces.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-body)' }}>
        No tools were used during this run.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {toolTraces.map((trace) => (
        <div
          key={`${trace.order}-${trace.tool_name}`}
          className="p-4"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
        >
          <div className="mb-3">
            <span className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Tool Call {trace.order}
            </span>
            <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {getToolLabel(trace.tool_name)}
            </p>
          </div>

          <div className="mb-4">
            <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Parameters
            </span>
            <pre
              className="text-sm font-sans whitespace-pre-wrap leading-relaxed"
              style={{ lineHeight: 1.6, color: 'var(--text-body)' }}
            >
              {JSON.stringify(trace.arguments, null, 2)}
            </pre>
          </div>

          <div>
            <span className="mb-2 block text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
              Response
            </span>
            <pre
              className="text-sm font-sans whitespace-pre-wrap leading-relaxed"
              style={{ lineHeight: 1.6, color: 'var(--text-body)' }}
            >
              {trace.response_markdown}
            </pre>
          </div>
        </div>
      ))}
    </div>
  );
};
