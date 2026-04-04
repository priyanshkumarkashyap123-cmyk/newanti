/**
 * Validation Panel Component
 * 
 * Displays real-time validation issues and statistics
 */

'use client';

import React from 'react';
import type { ValidationResult, ValidationIssue } from '@/lib/room-planner/types';

interface ValidationPanelProps {
  result: ValidationResult | null;
  onIssueClick?: (issue: ValidationIssue) => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ result, onIssueClick }) => {
  if (!result) {
    return (
      <div className="w-80 bg-white rounded-lg shadow-md p-4">
        <p className="text-sm text-gray-500">Loading validation...</p>
      </div>
    );
  }

  const errorCount = result.issues.filter(i => i.severity === 'error').length;
  const warningCount = result.issues.filter(i => i.severity === 'warning').length;
  const infoCount = result.issues.filter(i => i.severity === 'info').length;

  const statusColor = result.passed ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300';
  const statusIcon = result.passed ? '✅' : '⚠️';
  const statusText = result.passed ? 'Valid Layout' : 'Issues Found';

  return (
    <div className="w-96 bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-96">
      {/* Header */}
      <div className={`p-4 border-b-2 ${statusColor}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{statusIcon}</span>
          <span className="font-bold text-lg">{statusText}</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-red-100 px-2 py-1 rounded text-red-900">
            <p className="font-bold">{errorCount}</p>
            <p>Errors</p>
          </div>
          <div className="bg-yellow-100 px-2 py-1 rounded text-yellow-900">
            <p className="font-bold">{warningCount}</p>
            <p>Warnings</p>
          </div>
          <div className="bg-blue-100 px-2 py-1 rounded text-blue-900">
            <p className="font-bold">{infoCount}</p>
            <p>Info</p>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto p-3">
        {result.issues.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600">✨ No issues detected!</p>
            <p className="text-xs text-gray-500 mt-1">Your room layout is valid.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {result.issues.map((issue, i) => {
              const bgColor =
                issue.severity === 'error'
                  ? 'bg-red-50 border-l-4 border-red-500'
                  : issue.severity === 'warning'
                  ? 'bg-yellow-50 border-l-4 border-yellow-500'
                  : 'bg-blue-50 border-l-4 border-blue-500';

              const textColor =
                issue.severity === 'error'
                  ? 'text-red-900'
                  : issue.severity === 'warning'
                  ? 'text-yellow-900'
                  : 'text-blue-900';

              const icon =
                issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';

              return (
                <div
                  key={i}
                  onClick={() => onIssueClick?.(issue)}
                  className={`p-3 rounded cursor-pointer hover:shadow-md transition-shadow ${bgColor}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-semibold text-sm ${textColor}`}>
                        {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)}
                      </h4>
                      <p className={`text-sm mt-1 ${textColor}`}>{issue.message}</p>
                      {issue.objectIds.length > 0 && (
                        <p className="text-xs text-gray-600 mt-2">
                          Affected: {issue.objectIds.slice(0, 2).join(', ')}
                          {issue.objectIds.length > 2 ? ` +${issue.objectIds.length - 2}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <p>Last validated: {new Date(result.timestamp).toLocaleTimeString()}</p>
      </div>
    </div>
  );
};

export default ValidationPanel;
