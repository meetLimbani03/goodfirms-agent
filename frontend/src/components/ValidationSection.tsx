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
      return <Check className="w-4 h-4" style={{ color: 'var(--success)' }} />;
    case 'FAIL':
      return <X className="w-4 h-4" style={{ color: 'var(--error)' }} />;
    case 'FLAG':
      return <AlertTriangle className="w-4 h-4" style={{ color: 'var(--warning)' }} />;
    default:
      return null;
  }
};

const StatusBadge: React.FC<{ status: ValidationCheck['status'] }> = ({ status }) => {
  const colors = {
    PASS: 'var(--success)',
    FAIL: 'var(--error)',
    FLAG: 'var(--warning)',
  };

  return (
    <span className="text-xs font-semibold" style={{ color: colors[status] }}>
      {status}
    </span>
  );
};

export const ValidationSection: React.FC<ValidationSectionProps> = ({ title, checks }) => {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</h4>
      <div className="space-y-2">
        {checks.map((check, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-2"
            style={{ borderBottom: index < checks.length - 1 ? '1px solid var(--border-default)' : 'none' }}
          >
            <div className="flex items-center gap-3">
              <StatusIcon status={check.status} />
              <span className="text-sm" style={{ color: 'var(--text-body)' }}>{check.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {check.details && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{check.details}</span>
              )}
              <StatusBadge status={check.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
