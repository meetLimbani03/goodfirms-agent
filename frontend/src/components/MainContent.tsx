import React, { useState } from 'react';
import { ReviewData } from '../types';
import { DetailHeader } from './DetailHeader';
import { CollapsibleSection } from './CollapsibleSection';
import { ExtraContextSection } from './ExtraContextSection';
import { ReviewContextSection } from './ReviewContextSection';
import { UserContextSection } from './UserContextSection';
import { ValidationSection } from './ValidationSection';
import { GroundTruthSection } from './GroundTruthSection';
import { ProvenanceSection } from './ProvenanceSection';
import { AgentResponseSection } from './AgentResponseSection';
import { getPrechecks, getValidationChecks } from '../data/mockData';
import { AlertCircle } from 'lucide-react';

interface MainContentProps {
  review: ReviewData | null;
}

export const MainContent: React.FC<MainContentProps> = ({ review }) => {
  const [openSections, setOpenSections] = useState<string[]>([
    'extra-context',
    'review-context',
    'user-context',
    'validation',
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
      <div className="flex-1 flex items-center justify-center bg-[#141414]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
          <h2 className="text-xl font-medium text-[#666666]">No Review Selected</h2>
          <p className="text-sm text-[#888888] mt-2">
            Select a review from the sidebar to view details
          </p>
        </div>
      </div>
    );
  }

  const prechecks = getPrechecks(review);
  const validationChecks = getValidationChecks(review);

  return (
    <div className="flex-1 bg-[#141414] overflow-y-auto">
      <div className="px-10 py-8">
        {/* Main Content Area */}
        <div className="flex flex-col gap-8">
          {/* 1. Detail Header */}
          <DetailHeader
            review={review}
            onRerun={() => console.log('Rerun:', review.internalMetadata.reviewId)}
            onPublish={() => console.log('Publish:', review.internalMetadata.reviewId)}
          />

          {/* 2. Extra Context */}
          <CollapsibleSection
            title="Extra Context (Not given to agent)"
            isOpen={openSections.includes('extra-context')}
            onToggle={() => toggleSection('extra-context')}
          >
            <ExtraContextSection review={review} />
          </CollapsibleSection>

          {/* 3. Review Context */}
          <CollapsibleSection
            title="Review Context"
            isOpen={openSections.includes('review-context')}
            onToggle={() => toggleSection('review-context')}
          >
            <ReviewContextSection review={review} />
          </CollapsibleSection>

          {/* 4. User Context */}
          <CollapsibleSection
            title="User Context"
            isOpen={openSections.includes('user-context')}
            onToggle={() => toggleSection('user-context')}
          >
            <UserContextSection review={review} />
          </CollapsibleSection>

          {/* 5. Validation & Analysis Checks */}
          <CollapsibleSection
            title="Validation & Analysis Checks"
            isOpen={openSections.includes('validation')}
            onToggle={() => toggleSection('validation')}
          >
            <div className="flex flex-col gap-4">
              <div className="bg-[#1E1E1E] p-4" style={{ border: '1px solid #2A2A2A' }}>
                <ValidationSection title="Data Prechecks" checks={prechecks} />
              </div>
              <div className="bg-[#1E1E1E] p-4" style={{ border: '1px solid #2A2A2A' }}>
                <ValidationSection title="Agent Analysis" checks={validationChecks} />
              </div>
            </div>
          </CollapsibleSection>

          {/* 6. Ground Truth */}
          <CollapsibleSection
            title="GROUND TRUTH"
            isOpen={openSections.includes('ground-truth')}
            onToggle={() => toggleSection('ground-truth')}
          >
            <GroundTruthSection review={review} />
          </CollapsibleSection>

          {/* 7. Provenance */}
          <CollapsibleSection
            title="PROVENANCE"
            isOpen={openSections.includes('provenance')}
            onToggle={() => toggleSection('provenance')}
          >
            <ProvenanceSection review={review} />
          </CollapsibleSection>

          {/* 8. Agent Response */}
          <CollapsibleSection
            title="Agent's Response"
            isOpen={openSections.includes('agent-response')}
            onToggle={() => toggleSection('agent-response')}
          >
            <AgentResponseSection review={review} />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
};
