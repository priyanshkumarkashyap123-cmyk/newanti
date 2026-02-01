// ============================================================================
// PROFESSIONAL ADVISORY DISCLAIMER COMPONENT
// ============================================================================
//
// P0 REQUIREMENT: Engineering software advisory disclaimer
// 
// This component provides legally-required disclaimers for:
// - Analysis results interpretation
// - Professional responsibility
// - Software limitations
// - Regulatory compliance notes
//
// Industry standard: All structural analysis software includes these
// (STAAD.Pro, ETABS, SAP2000, RISA all have similar disclaimers)
// ============================================================================

import React, { useState, useEffect } from 'react';

// ============================================================================
// DISCLAIMER TYPES
// ============================================================================

export type DisclaimerType = 
  | 'analysis'      // Analysis results
  | 'report'        // Generated reports
  | 'export'        // Export/download
  | 'ai'            // AI-generated content
  | 'session'       // Session start
  | 'print';        // Print output

export interface DisclaimerConfig {
  type: DisclaimerType;
  requireAcknowledgment?: boolean;
  showOnce?: boolean;
  customMessage?: string;
}

// ============================================================================
// DISCLAIMER CONTENT
// ============================================================================

const DISCLAIMER_CONTENT: Record<DisclaimerType, {
  title: string;
  icon: string;
  content: string;
  details: string[];
  acknowledgmentText: string;
}> = {
  analysis: {
    title: 'Analysis Results Disclaimer',
    icon: '⚠️',
    content: `These analysis results are provided for preliminary engineering assessment only. 
    All results must be verified by a licensed Professional Engineer (PE) before use in construction.`,
    details: [
      'Results are based on idealized structural models and may not capture all real-world behaviors.',
      'Material properties, loading conditions, and boundary conditions are approximations.',
      'Software uses numerical methods which have inherent limitations and tolerances.',
      'Connection and joint details require separate detailed analysis and design.',
      'Seismic and wind analysis results should be reviewed for code compliance.',
      'Load combinations may not cover all project-specific requirements.',
    ],
    acknowledgmentText: 'I understand that these results require professional review',
  },

  report: {
    title: 'Report Generation Disclaimer',
    icon: '📋',
    content: `Generated reports are for documentation purposes only. 
    They do not constitute a certified engineering analysis or design.`,
    details: [
      'Reports summarize software output and should not be used as final engineering documents.',
      'A licensed engineer must review, verify, and stamp all documents for official use.',
      'Report content reflects model state at time of generation and may become outdated.',
      'All assumptions and limitations noted in the report must be considered.',
    ],
    acknowledgmentText: 'I understand this report requires professional certification',
  },

  export: {
    title: 'Export Data Disclaimer',
    icon: '📤',
    content: `Exported data should be validated before use in other applications.`,
    details: [
      'File format conversions may result in data loss or interpretation differences.',
      'Verify all critical values after importing into destination application.',
      'Unit conversions should be double-checked for accuracy.',
      'Coordinate system transformations may affect geometry interpretation.',
    ],
    acknowledgmentText: 'I will verify exported data before further use',
  },

  ai: {
    title: 'AI-Assisted Analysis Disclaimer',
    icon: '🤖',
    content: `AI-generated suggestions and analysis assistance are for guidance only.`,
    details: [
      'AI recommendations are based on pattern recognition and may not apply to your specific case.',
      'Always verify AI suggestions against applicable design codes and standards.',
      'AI cannot replace the judgment of a qualified structural engineer.',
      'AI may not be aware of project-specific constraints or requirements.',
      'All AI-suggested designs must be independently verified.',
    ],
    acknowledgmentText: 'I understand AI assistance requires professional verification',
  },

  session: {
    title: 'Professional Use Notice',
    icon: 'ℹ️',
    content: `This software is intended for use by qualified engineering professionals.`,
    details: [
      'Users should have adequate training in structural analysis and design.',
      'Understanding of underlying theory and limitations is required for proper use.',
      'Results should be validated against hand calculations for critical elements.',
      'Software does not replace professional engineering judgment.',
    ],
    acknowledgmentText: 'I am a qualified professional or working under professional supervision',
  },

  print: {
    title: 'Print Output Notice',
    icon: '🖨️',
    content: `Printed output is a record of software calculations at a specific time.`,
    details: [
      'Printed documents should include date, project information, and software version.',
      'All printed output requires professional review and certification.',
      'Printed results may differ from display due to formatting.',
    ],
    acknowledgmentText: 'I understand printed output requires professional review',
  },
};

// ============================================================================
// LOCAL STORAGE KEYS
// ============================================================================

const STORAGE_KEY_PREFIX = 'antivate_disclaimer_acknowledged_';

function getAcknowledgedKey(type: DisclaimerType): string {
  return `${STORAGE_KEY_PREFIX}${type}`;
}

function hasAcknowledged(type: DisclaimerType): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(getAcknowledgedKey(type)) === 'true';
}

function setAcknowledged(type: DisclaimerType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getAcknowledgedKey(type), 'true');
}

// ============================================================================
// DISCLAIMER MODAL COMPONENT
// ============================================================================

interface DisclaimerModalProps {
  config: DisclaimerConfig;
  onAccept: () => void;
  onDecline?: () => void;
  isOpen: boolean;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({
  config,
  onAccept,
  onDecline,
  isOpen,
}) => {
  const [acknowledged, setAcknowledgedState] = useState(false);
  const content = DISCLAIMER_CONTENT[config.type];

  if (!isOpen) return null;

  const handleAccept = () => {
    if (config.showOnce) {
      setAcknowledged(config.type);
    }
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <span className="text-2xl">{content.icon}</span>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {content.title}
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-gray-700 dark:text-gray-300 font-medium">
            {config.customMessage || content.content}
          </p>

          <ul className="space-y-2">
            {content.details.map((detail, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="text-yellow-500 mt-0.5">•</span>
                {detail}
              </li>
            ))}
          </ul>

          {/* Regulatory Notice */}
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Professional Responsibility:</strong> All structural designs must be 
              reviewed and certified by a licensed Professional Engineer (PE) or equivalent 
              in your jurisdiction before construction.
            </p>
          </div>

          {/* Acknowledgment Checkbox */}
          {config.requireAcknowledgment && (
            <label className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledgedState(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {content.acknowledgmentText}
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          {onDecline && (
            <button
              onClick={onDecline}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleAccept}
            disabled={config.requireAcknowledgment && !acknowledged}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// INLINE DISCLAIMER BANNER
// ============================================================================

interface DisclaimerBannerProps {
  type: DisclaimerType;
  variant?: 'compact' | 'full';
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({
  type,
  variant = 'compact',
  dismissible = true,
  onDismiss,
}) => {
  const [dismissed, setDismissed] = useState(false);
  const content = DISCLAIMER_CONTENT[type];

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (variant === 'compact') {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-400 p-3 flex items-start justify-between">
        <div className="flex items-start gap-2">
          <span>{content.icon}</span>
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Notice:</strong> {content.content.split('.')[0]}.
          </p>
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{content.icon}</span>
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
            {content.title}
          </h3>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            {content.content}
          </p>
        </div>
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 text-xl"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// FOOTER DISCLAIMER
// ============================================================================

export const FooterDisclaimer: React.FC = () => {
  return (
    <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2 border-t border-gray-200 dark:border-gray-700">
      <p>
        Analysis results are for preliminary assessment only. 
        All designs must be reviewed and certified by a licensed Professional Engineer.
      </p>
      <p className="mt-1">
        © {new Date().getFullYear()} Antivate Structural Analysis Software. 
        Use subject to <a href="/terms" className="underline hover:text-blue-600">Terms of Service</a>.
      </p>
    </div>
  );
};

// ============================================================================
// REPORT WATERMARK
// ============================================================================

interface ReportWatermarkProps {
  projectName?: string;
  timestamp?: string;
}

export const ReportWatermark: React.FC<ReportWatermarkProps> = ({
  projectName,
  timestamp,
}) => {
  return (
    <div className="print:block hidden absolute inset-0 pointer-events-none">
      {/* Diagonal watermark */}
      <div 
        className="absolute inset-0 flex items-center justify-center opacity-5"
        style={{ transform: 'rotate(-45deg)' }}
      >
        <span className="text-8xl font-bold text-gray-900">
          PRELIMINARY - NOT FOR CONSTRUCTION
        </span>
      </div>

      {/* Footer watermark */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-100 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Project: {projectName || 'Unnamed'}</span>
          <span>Generated: {timestamp || new Date().toISOString()}</span>
        </div>
        <p className="mt-1 text-center font-semibold">
          ⚠️ FOR REVIEW ONLY - REQUIRES PE CERTIFICATION BEFORE USE ⚠️
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// DISCLAIMER HOOK
// ============================================================================

export function useDisclaimer(config: DisclaimerConfig) {
  const [showModal, setShowModal] = useState(false);
  const [hasAccepted, setHasAccepted] = useState(false);

  useEffect(() => {
    if (config.showOnce && hasAcknowledged(config.type)) {
      setHasAccepted(true);
    }
  }, [config.type, config.showOnce]);

  const promptDisclaimer = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (hasAccepted && config.showOnce) {
        resolve(true);
        return;
      }

      setShowModal(true);

      // This will be resolved by the modal callbacks
      const handleAccept = () => {
        setShowModal(false);
        setHasAccepted(true);
        resolve(true);
      };

      const handleDecline = () => {
        setShowModal(false);
        resolve(false);
      };

      // Store callbacks for modal
      (window as any).__disclaimerCallbacks = { handleAccept, handleDecline };
    });
  };

  const DisclaimerComponent = () => (
    <DisclaimerModal
      config={config}
      isOpen={showModal}
      onAccept={() => (window as any).__disclaimerCallbacks?.handleAccept()}
      onDecline={() => (window as any).__disclaimerCallbacks?.handleDecline()}
    />
  );

  return {
    promptDisclaimer,
    hasAccepted,
    DisclaimerComponent,
    showModal,
  };
}

// ============================================================================
// EXPORT WITH DISCLAIMER HOC
// ============================================================================

export function withDisclaimer<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  disclaimerType: DisclaimerType
) {
  return function WithDisclaimerComponent(props: P) {
    const { DisclaimerComponent, hasAccepted } = useDisclaimer({
      type: disclaimerType,
      requireAcknowledgment: true,
      showOnce: true,
    });

    return (
      <>
        <DisclaimerComponent />
        <WrappedComponent {...props} />
      </>
    );
  };
}

// ============================================================================
// PREDEFINED DISCLAIMER CONFIGS
// ============================================================================

export const DISCLAIMER_CONFIGS = {
  analysisResults: {
    type: 'analysis' as DisclaimerType,
    requireAcknowledgment: false,
    showOnce: false,
  },
  reportGeneration: {
    type: 'report' as DisclaimerType,
    requireAcknowledgment: true,
    showOnce: true,
  },
  fileExport: {
    type: 'export' as DisclaimerType,
    requireAcknowledgment: false,
    showOnce: true,
  },
  aiAssistance: {
    type: 'ai' as DisclaimerType,
    requireAcknowledgment: true,
    showOnce: true,
  },
  sessionStart: {
    type: 'session' as DisclaimerType,
    requireAcknowledgment: true,
    showOnce: true,
  },
};

export default DisclaimerModal;
