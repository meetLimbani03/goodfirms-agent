import React, { useState } from 'react';
import { ReviewData } from '../types';
import { DetailHeader } from './DetailHeader';
import { CollapsibleSection } from './CollapsibleSection';
import { ExtraContextSection } from './ExtraContextSection';
import { AgentPromptSection } from './AgentPromptSection';
import { AgentContextSection } from './AgentContextSection';
import { AgentToolCallsSection } from './AgentToolCallsSection';
import { ValidationSection } from './ValidationSection';
import { AgentResponseSection } from './AgentResponseSection';
import { getPrechecks, getValidationChecks } from '../data/mockData';
import { AlertCircle } from 'lucide-react';

interface MainContentProps {
  review: ReviewData | null;
  onOpenFeedback: () => void;
}

export const MainContent: React.FC<MainContentProps> = ({ review, onOpenFeedback }) => {
  const [openSections, setOpenSections] = useState<string[]>([
    'extra-context',
    'agent-context',
    'validation',
    'agent-response',
    'agent-tool-calls',
  ]);

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  if (!review) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-content)' }}>
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--border-default)' }} />
          <h2 className="text-xl font-medium" style={{ color: 'var(--text-subtle)' }}>No Review Selected</h2>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            Select a review from the sidebar to view details
          </p>
        </div>
      </div>
    );
  }

  const prechecks = getPrechecks(review);
  const validationChecks = getValidationChecks(review);

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg-content)' }}>
      <div className="px-10 py-8">
        {/* Main Content Area */}
        <div className="flex flex-col gap-8">
          {/* 1. Detail Header */}
          <DetailHeader
            review={review}
            onRerun={() => console.log('Rerun:', review.internalMetadata.reviewId)}
            onPublish={() => console.log('Publish:', review.internalMetadata.reviewId)}
            onOpenFeedback={onOpenFeedback}
          />

          {/* 2. Extra Context */}
          <CollapsibleSection
            title="Extra Context (Not given to agent)"
            isOpen={openSections.includes('extra-context')}
            onToggle={() => toggleSection('extra-context')}
          >
            <ExtraContextSection review={review} />
          </CollapsibleSection>

          {/* 3. Agent Response */}
          <CollapsibleSection
            title="Agent's Response"
            isOpen={openSections.includes('agent-response')}
            onToggle={() => toggleSection('agent-response')}
          >
            <AgentResponseSection review={review} />
          </CollapsibleSection>

          {/* 4. Agent Tool Calls */}
          <CollapsibleSection
            title="Agent Tool Calls"
            isOpen={openSections.includes('agent-tool-calls')}
            onToggle={() => toggleSection('agent-tool-calls')}
          >
            <AgentToolCallsSection review={review} />
          </CollapsibleSection>

          {/* 5. Agent Prompt */}
          <CollapsibleSection
            title="Agent Prompt"
            isOpen={openSections.includes('agent-prompt')}
            onToggle={() => toggleSection('agent-prompt')}
          >
            <AgentPromptSection review={review} />
          </CollapsibleSection>

          {/* 6. Agent Context */}
          <CollapsibleSection
            title="Agent Context"
            isOpen={openSections.includes('agent-context')}
            onToggle={() => toggleSection('agent-context')}
          >
            <AgentContextSection review={review} />
          </CollapsibleSection>

          {/* 7. Validation & Analysis Checks */}
          <CollapsibleSection
            title="Validation & Analysis Checks"
            isOpen={openSections.includes('validation')}
            onToggle={() => toggleSection('validation')}
          >
            <div className="flex flex-col gap-4">
              <div className="p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <ValidationSection title="Data Prechecks" checks={prechecks} />
              </div>
              <div className="p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                <ValidationSection title="Agent Analysis" checks={validationChecks} />
              </div>
            </div>
          </CollapsibleSection>

        </div>
      </div>
    </div>
  );
};
