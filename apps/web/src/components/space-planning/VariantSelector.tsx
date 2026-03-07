/**
 * VariantSelector.tsx
 * 
 * Displays 5 design variant options for user selection.
 * Each variant card shows:
 * - Strategy name & description
 * - Composite quality score (0-100)
 * - Metric breakdown (compactness, zone coherence, adjacency, flow)
 * - Selection state
 * 
 * Includes philosophy guide to help users choose.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Info, Sparkles } from 'lucide-react';
import type { VariantResponse } from '../../services/space-planning/layoutApiService';

interface Props {
  variants: VariantResponse[];
  selectedVariantId: string | null;
  onSelectVariant: (variantId: string) => void;
  isLoading?: boolean;
  onGenerateVariants?: () => void;
}

const VARIANT_GUIDE: Record<string, string> = {
  active_first: '🏠 Best for entertaining and open-plan living',
  sleeping_refuge: '🌙 Best for quiet, separated bedrooms',
  central_circulation: '🔄 Best for efficient corridors',
  compact_zones: '📐 Best for small plots',
  linear_flow: '➡️ Best for traditional layouts',
};

export function VariantSelector({
  variants,
  selectedVariantId,
  onSelectVariant,
  isLoading,
  onGenerateVariants,
}: Props) {
  // If no variants yet, show generation prompt
  if (variants.length === 0) {
    return (
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Sparkles className="w-8 h-8 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Generate Multiple Design Variants
            </h3>
            <p className="text-gray-700 mb-4 leading-relaxed">
              Instead of one solution, get <strong>5 competing designs</strong> based on different
              architectural philosophies. Compare and choose your preferred approach.
            </p>
            <ul className="space-y-2 mb-4 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                <span>Open Living vs. Private Sleeping vs. Efficient Layout</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                <span>Each variant scored on 5 quality metrics</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                <span>Takes 2-3 minutes (worth it for better designs!)</span>
              </li>
            </ul>
            {onGenerateVariants && (
              <button
                onClick={onGenerateVariants}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Generating 5 Variants... (2-3 min)
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    ✨ Generate Design Variants
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Sort by score descending
  const sorted = [...variants].sort(
    (a, b) => (b.score?.composite_score ?? 0) - (a.score?.composite_score ?? 0),
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Design Variants ({variants.length} Solutions)
        </h3>
        <p className="text-sm text-gray-600">
          Compare different architectural approaches and select your preferred design
        </p>
      </div>

      {/* Variant Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sorted.map((variant, index) => {
          const isSelected = selectedVariantId === variant.variant_id;
          const isRecommended = index === 0; // First = highest score
          const score = variant.score;

          return (
            <motion.div
              key={variant.variant_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => onSelectVariant(variant.variant_id)}
              className={`
                relative p-5 rounded-lg border-2 cursor-pointer
                transition-all duration-200
                ${isSelected
                  ? 'border-blue-600 bg-blue-50 shadow-lg scale-[1.02]'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                }
              `}
            >
              {/* Recommended Badge */}
              {isRecommended && (
                <div className="absolute -top-2 -right-2 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
                  ⭐ Recommended
                </div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold text-lg text-gray-900 mb-1">
                    {variant.strategy_name}
                  </h4>
                  <p className="text-sm text-gray-600 leading-snug">
                    {variant.strategy_description}
                  </p>
                </div>

                {/* Score Badge */}
                {score && (
                  <div
                    className={`
                      ml-3 px-3 py-2 rounded-lg text-center flex-shrink-0
                      ${score.composite_score >= 85
                        ? 'bg-green-100 text-green-800'
                        : score.composite_score >= 75
                        ? 'bg-blue-100 text-blue-800'
                        : score.composite_score >= 65
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-800'
                      }
                    `}
                  >
                    <div className="text-2xl font-bold">
                      {score.composite_score.toFixed(0)}
                    </div>
                    <div className="text-xs opacity-75">/ 100</div>
                  </div>
                )}
              </div>

              {/* Score Breakdown */}
              {score && (
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <MetricBar label="Compactness" value={100 - score.compactness} />
                  <MetricBar label="Zone Coherence" value={score.zone_coherence} />
                  <MetricBar label="Adjacency" value={score.adjacency_satisfaction} />
                  <MetricBar label="Circulation" value={score.circulation_efficiency} />
                </div>
              )}

              {/* Philosophy Hint */}
              <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-700 flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 text-gray-500 flex-shrink-0" />
                <span>{VARIANT_GUIDE[variant.variant_id] || 'Quality design option'}</span>
              </div>

              {/* Selected Indicator */}
              {isSelected && (
                <div className="mt-4 flex items-center gap-2 text-blue-600 font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Selected</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Philosophy Guide */}
      <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200">
        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Info className="w-5 h-5 text-amber-600" />
          Which variant should I choose?
        </h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="font-semibold min-w-[180px]">Private Sleeping Wing:</span>
            <span>Best for quiet, separated bedrooms (families with sleepers)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold min-w-[180px]">Open Living Concept:</span>
            <span>Best for entertaining and kitchen visibility (social households)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold min-w-[180px]">Sequential Entry Flow:</span>
            <span>Best for traditional layouts with clear spatial hierarchy</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold min-w-[180px]">Hub & Spoke Layout:</span>
            <span>Best for efficient corridors (narrow plots, high density)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold min-w-[180px]">Compact Clustering:</span>
            <span>Best for minimizing footprint (small plots, urban projects)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

/** Mini metric bar component */
function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-semibold">{value.toFixed(0)}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            value >= 80
              ? 'bg-green-500'
              : value >= 60
              ? 'bg-blue-500'
              : value >= 40
              ? 'bg-amber-500'
              : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
