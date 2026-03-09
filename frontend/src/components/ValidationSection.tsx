import React from 'react';
import { ValidationCheck } from '../types';
import { Check, X, AlertTriangle } from 'lucide-react';

interface ValidationSectionProps {
  title: string;
  checks: ValidationCheck[];
}

const StatusIcon: React.FC<{ status: ValidationCheck['status'] }> = ({ status }) => {
  switch (status) {
    case 'PASS':
      return <Check className="w-4 h-4 text-[#4CAF50]" />;
    case 'FAIL':
      return <X className="w-4 h-4 text-[#F44336]" />;
    case 'FLAG':
      return <AlertTriangle className="w-4 h-4 text-[#FFC107]" />;
    default:
      return null;
  }
};

const StatusBadge: React.FC<{ status: ValidationCheck['status'] }> = ({ status }) => {
  const colors = {
    PASS: 'text-[#4CAF50]',
    FAIL: 'text-[#F44336]',
    FLAG: 'text-[#FFC107]',
  };

  return (
    <span className={`text-xs font-semibold ${colors[status]}`}>
      {status}
    </span>
  );
};

export const ValidationSection: React.FC<ValidationSectionProps> = ({ title, checks }) => {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-[#888888] uppercase tracking-wider">{title}</h4>
      <div className="space-y-2">
        {checks.map((check, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-2"
            style={{ borderBottom: index < checks.length - 1 ? '1px solid #2A2A2A' : 'none' }}
          >
            <div className="flex items-center gap-3">
              <StatusIcon status={check.status} />
              <span className="text-sm text-[#CCCCCC]">{check.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {check.details && (
                <span className="text-xs text-[#888888]">{check.details}</span>
              )}
              <StatusBadge status={check.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
