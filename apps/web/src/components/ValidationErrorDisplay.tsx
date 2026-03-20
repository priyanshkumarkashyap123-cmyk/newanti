import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle } from 'lucide-react';

export interface ValidationIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  affected_elements?: string[];
  suggested_fix?: string;
  auto_fixable?: boolean;
}

export interface ValidationResults {
  is_valid: boolean;
  has_errors?: boolean;
  has_warnings?: boolean;
  summary: string;
  error_count?: number;
  warning_count?: number;
  info_count?: number;
  issues: ValidationIssue[];
  statistics?: Record<string, any>;
}

interface Props {
  results: ValidationResults;
  onDismiss?: () => void;
  onAutoFix?: (issue: ValidationIssue) => void;
}

export const ValidationErrorDisplay: React.FC<Props> = ({ results, onDismiss, onAutoFix }) => {
  // Handle both API formats
  const hasErrors = results.has_errors ?? (results.error_count && results.error_count > 0) ?? false;
  const hasWarnings = results.has_warnings ?? (results.warning_count && results.warning_count > 0) ?? false;
  
  if (!results || (!hasErrors && !hasWarnings && results.issues.length === 0)) {
    return null;
  }

  const errors = results.issues.filter(i => i.severity === 'error');
  const warnings = results.issues.filter(i => i.severity === 'warning');
  const infos = results.issues.filter(i => i.severity === 'info');

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-500 bg-red-50';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50';
      case 'info':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-slate-300 bg-slate-50';
    }
  };

  return (
    <div className="fixed top-20 right-4 max-w-2xl z-50 space-y-2 max-h-[80vh] overflow-y-auto">
      {/* Main Alert Box */}
      <div className={`rounded-lg border-2 p-4 shadow-lg ${
        results.has_errors || errors.length > 0
          ? 'border-red-500 bg-red-50'
          : results.has_warnings || warnings.length > 0
          ? 'border-yellow-500 bg-yellow-50'
          : 'border-blue-500 bg-blue-50'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {results.has_errors || errors.length > 0 ? (
              <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
            ) : results.has_warnings || warnings.length > 0 ? (
              <AlertTriangle className="w-6 h-6 text-yellow-600 mt-0.5" />
            ) : (
              <Info className="w-6 h-6 text-blue-600 mt-0.5" />
            )}
            
            <div className="flex-1">
              <h3 className={`font-semibold text-lg ${
                results.has_errors || errors.length > 0
                  ? 'text-red-800'
                  : results.has_warnings || warnings.length > 0
                  ? 'text-yellow-800'
                  : 'text-blue-800'
              }`}>
                {results.has_errors || errors.length > 0
                  ? '⚠️ Model Validation Failed'
                  : results.has_warnings || warnings.length > 0
                  ? '⚡ Model Validation Warnings'
                  : 'ℹ️ Model Information'}
              </h3>
              <p className="text-sm text-slate-700 mt-1">{results.summary}</p>
              
              {/* Statistics */}
              {results.statistics && (
                <div className="mt-2 text-xs text-slate-600 grid grid-cols-2 gap-2">
                  {results.statistics.num_nodes !== undefined && (
                    <span>Nodes: {results.statistics.num_nodes}</span>
                  )}
                  {results.statistics.num_members !== undefined && (
                    <span>Members: {results.statistics.num_members}</span>
                  )}
                  {results.statistics.num_supports !== undefined && (
                    <span>Supports: {results.statistics.num_supports}</span>
                  )}
                  {results.statistics.num_loads !== undefined && (
                    <span>Loads: {results.statistics.num_loads}</span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {onDismiss && (
            <button type="button"
              onClick={onDismiss}
              className="text-slate-500 hover:text-slate-700 ml-2"
              aria-label="Dismiss"
            >
              ✕
            </button>
          )}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium tracking-wide tracking-wide text-red-800">
              Errors ({errors.length}) - Must fix to analyze:
            </h4>
            {errors.map((issue, idx) => (
              <IssueCard
                key={idx}
                issue={issue}
                onAutoFix={onAutoFix}
              />
            ))}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium tracking-wide tracking-wide text-yellow-800">
              Warnings ({warnings.length}) - Review recommended:
            </h4>
            {warnings.map((issue, idx) => (
              <IssueCard
                key={idx}
                issue={issue}
                onAutoFix={onAutoFix}
              />
            ))}
          </div>
        )}

        {/* Info */}
        {infos.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-medium tracking-wide tracking-wide text-blue-800">
              Information ({infos.length}):
            </h4>
            {infos.map((issue, idx) => (
              <IssueCard
                key={idx}
                issue={issue}
                onAutoFix={onAutoFix}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const IssueCard: React.FC<{
  issue: ValidationIssue;
  onAutoFix?: (issue: ValidationIssue) => void;
}> = ({ issue, onAutoFix }) => {
  const getSeverityBorderColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-l-red-600';
      case 'warning':
        return 'border-l-yellow-600';
      case 'info':
        return 'border-l-blue-600';
      default:
        return 'border-l-slate-400';
    }
  };

  return (
    <div className={`bg-[#131b2e] p-3 rounded border-l-4 ${getSeverityBorderColor(issue.severity)} shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium tracking-wide tracking-wide text-[#dae2fd]">{issue.message}</p>
          
          {issue.affected_elements && issue.affected_elements.length > 0 && (
            <p className="text-xs text-[#869ab8] mt-1">
              <span className="font-medium tracking-wide tracking-wide">Affected:</span>{' '}
              {issue.affected_elements.slice(0, 5).join(', ')}
              {issue.affected_elements.length > 5 && ` (+${issue.affected_elements.length - 5} more)`}
            </p>
          )}
          
          {issue.suggested_fix && (
            <div className="mt-2 p-2 bg-green-900/30 rounded text-xs text-green-300 border border-green-700">
              <span className="font-medium tracking-wide tracking-wide">💡 Suggestion:</span> {issue.suggested_fix}
            </div>
          )}
        </div>
        
        {issue.auto_fixable && onAutoFix && (
          <button type="button"
            onClick={() => onAutoFix(issue)}
            className="ml-3 px-3 py-1 text-xs font-medium tracking-wide tracking-wide text-white bg-green-600 hover:bg-green-700 rounded"
          >
            Auto-Fix
          </button>
        )}
      </div>
    </div>
  );
};

export default ValidationErrorDisplay;
