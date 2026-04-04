/**
 * VariantComparison.tsx
 * 
 * Side-by-side visualization of variant quality metrics using a bar chart.
 * Allows architects to compare:
 * - Compactness
 * - Zone coherence
 * - Adjacency satisfaction
 * - Circulation efficiency
 * - Overall composite score
 */

import React from 'react';
import { TrendingUp, Award } from 'lucide-react';
import type { VariantResponse } from '../../services/space-planning/layoutApiService';

interface Props {
  variants: VariantResponse[];
  selectedVariantId: string | null;
}

export function VariantComparison({ variants, selectedVariantId }: Props) {
  if (variants.length === 0) return null;

  // Sort by composite score descending
  const sorted = [...variants].sort(
    (a, b) => (b.score?.composite_score ?? 0) - (a.score?.composite_score ?? 0),
  );

  // Find max values for normalization
  const maxValues = {
    compactness: Math.max(...variants.map((v) => 100 - (v.score?.compactness ?? 100))),
    zone: Math.max(...variants.map((v) => v.score?.zone_coherence ?? 0)),
    adjacency: Math.max(...variants.map((v) => v.score?.adjacency_satisfaction ?? 0)),
    flow: Math.max(...variants.map((v) => v.score?.circulation_efficiency ?? 0)),
    composite: Math.max(...variants.map((v) => v.score?.composite_score ?? 0)),
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Metric Comparison
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Compare quality scores across all variants
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-amber-600 font-semibold">
          <Award className="w-4 h-4" />
          <span>Higher = Better</span>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-2 font-semibold text-gray-700">Variant</th>
              <th className="text-center py-3 px-2 font-semibold text-gray-700">Overall</th>
              <th className="text-center py-3 px-2 font-semibold text-gray-700">Compactness</th>
              <th className="text-center py-3 px-2 font-semibold text-gray-700">Zone</th>
              <th className="text-center py-3 px-2 font-semibold text-gray-700">Adjacency</th>
              <th className="text-center py-3 px-2 font-semibold text-gray-700">Flow</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((variant, index) => {
              const isSelected = selectedVariantId === variant.variant_id;
              const isFirst = index === 0;
              const score = variant.score;

              if (!score) return null;

              const compactnessScore = 100 - score.compactness; // Invert (lower is better)

              return (
                <tr
                  key={variant.variant_id}
                  className={`
                    border-b border-gray-100 transition-colors
                    ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                >
                  {/* Variant Name */}
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-2">
                      {isFirst && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                          Best
                        </span>
                      )}
                      <span className={`font-medium tracking-wide ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
                        {variant.strategy_name}
                      </span>
                    </div>
                  </td>

                  {/* Overall Score */}
                  <td className="py-4 px-2">
                    <ScoreCell
                      value={score.composite_score}
                      maxValue={maxValues.composite}
                      isSelected={isSelected}
                    />
                  </td>

                  {/* Compactness */}
                  <td className="py-4 px-2">
                    <ScoreCell
                      value={compactnessScore}
                      maxValue={maxValues.compactness}
                      isSelected={isSelected}
                    />
                  </td>

                  {/* Zone Coherence */}
                  <td className="py-4 px-2">
                    <ScoreCell
                      value={score.zone_coherence}
                      maxValue={maxValues.zone}
                      isSelected={isSelected}
                    />
                  </td>

                  {/* Adjacency */}
                  <td className="py-4 px-2">
                    <ScoreCell
                      value={score.adjacency_satisfaction}
                      maxValue={maxValues.adjacency}
                      isSelected={isSelected}
                    />
                  </td>

                  {/* Circulation Flow */}
                  <td className="py-4 px-2">
                    <ScoreCell
                      value={score.circulation_efficiency}
                      maxValue={maxValues.flow}
                      isSelected={isSelected}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs text-gray-600">
          <div>
            <div className="font-semibold text-gray-700 mb-1">Overall</div>
            <div>Weighted composite of all metrics</div>
          </div>
          <div>
            <div className="font-semibold text-gray-700 mb-1">Compactness</div>
            <div>How tightly rooms are grouped</div>
          </div>
          <div>
            <div className="font-semibold text-gray-700 mb-1">Zone</div>
            <div>Functional zone clustering quality</div>
          </div>
          <div>
            <div className="font-semibold text-gray-700 mb-1">Adjacency</div>
            <div>Required room pairs adjacent</div>
          </div>
          <div>
            <div className="font-semibold text-gray-700 mb-1">Flow</div>
            <div>Entry→living→sleeping efficiency</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Score cell with visual bar */
function ScoreCell({
  value,
  maxValue,
  isSelected,
}: {
  value: number;
  maxValue: number;
  isSelected: boolean;
}) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const color =
    value >= 80
      ? 'bg-green-500'
      : value >= 60
      ? 'bg-blue-500'
      : value >= 40
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <div className="flex flex-col items-center gap-2">
      <span className={`font-semibold ${isSelected ? 'text-blue-600' : 'text-gray-900'}`}>
        {value.toFixed(0)}
      </span>
      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
}
