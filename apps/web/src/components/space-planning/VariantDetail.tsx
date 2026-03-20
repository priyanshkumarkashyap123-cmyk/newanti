/**
 * VariantDetail.tsx
 * 
 * Shows full details of the selected design variant:
 * - Strategy name & description
 * - Overall quality score
 * - Room placement table with dimensions
 * - Export button
 */

import React from 'react';
import { Download, CheckCircle2, MapPin, Ruler, Square } from 'lucide-react';
import type { VariantResponse } from '../../services/space-planning/layoutApiService';

interface Props {
  variant: VariantResponse;
  onExport?: (variant: VariantResponse) => void;
}

const STRATEGY_BENEFITS: Record<string, string[]> = {
  active_first: [
    'Kitchen visible from living area',
    'Open social space for entertaining',
    'Integrated dining-kitchen-living flow',
  ],
  sleeping_refuge: [
    'Bedrooms isolated from noise',
    'Private sleeping wing',
    'Optimal bedroom-bathroom adjacency',
  ],
  central_circulation: [
    'Efficient hallway layout',
    'Minimal corridor space',
    'Rooms easily accessible',
  ],
  compact_zones: [
    'Minimized overall footprint',
    'Tight functional grouping',
    'Efficient space utilization',
  ],
  linear_flow: [
    'Traditional layout hierarchy',
    'Clear entry sequence',
    'Predictable room arrangement',
  ],
};

export function VariantDetail({ variant, onExport }: Props) {
  const score = variant.score;
  const benefits = STRATEGY_BENEFITS[variant.variant_id] || [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">{variant.strategy_name}</h3>
            <p className="text-blue-100 text-lg">{variant.strategy_description}</p>
          </div>

          {/* Score Badge */}
          {score && (
            <div className="ml-4 bg-white/20 backdrop-blur-sm rounded-lg px-6 py-4 text-center">
              <div className="text-4xl font-bold">{score.composite_score.toFixed(0)}</div>
              <div className="text-sm text-blue-100 mt-1">Quality Score</div>
            </div>
          )}
        </div>

        {/* Export Button */}
        {onExport && (
          <button
            onClick={() => onExport(variant)}
            className="w-full px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export This Design
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Benefits */}
        {benefits.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Key Benefits
            </h4>
            <ul className="space-y-2">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Score Breakdown */}
        {score && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Quality Metrics</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard
                label="Overall"
                value={score.composite_score}
                icon="🎯"
              />
              <MetricCard
                label="Compactness"
                value={100 - score.compactness}
                icon="📐"
              />
              <MetricCard
                label="Zone Coherence"
                value={score.zone_coherence}
                icon="🏘️"
              />
              <MetricCard
                label="Adjacency"
                value={score.adjacency_satisfaction}
                icon="🔗"
              />
              <MetricCard
                label="Flow"
                value={score.circulation_efficiency}
                icon="➡️"
              />
            </div>
          </div>
        )}

        {/* Room Placements Table */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Room Placements ({variant.placements.length} rooms)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Room</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">
                    Target (m²)
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">
                    Actual (m²)
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">
                    Deviation
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">
                    Dimensions
                  </th>
                </tr>
              </thead>
              <tbody>
                {variant.placements.map((placement, i) => {
                  const deviationColor =
                    Math.abs(placement.area_deviation_pct) < 5
                      ? 'text-green-600'
                      : Math.abs(placement.area_deviation_pct) < 10
                      ? 'text-amber-600'
                      : 'text-red-600';

                  return (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium tracking-wide tracking-wide text-gray-900">{placement.name}</div>
                          <div className="text-xs text-gray-500 capitalize">
                            {placement.type}
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 text-gray-700">
                        {placement.target_area_sqm.toFixed(1)}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold text-gray-900">
                        {placement.actual_area_sqm.toFixed(1)}
                      </td>
                      <td className={`text-right py-3 px-4 font-semibold ${deviationColor}`}>
                        {placement.area_deviation_pct > 0 ? '+' : ''}
                        {placement.area_deviation_pct.toFixed(1)}%
                      </td>
                      <td className="text-right py-3 px-4 text-gray-700 font-mono text-xs">
                        {placement.dimensions.width.toFixed(1)} × {placement.dimensions.height.toFixed(1)} m
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="py-3 px-4 text-gray-900">Total</td>
                  <td className="text-right py-3 px-4 text-gray-900">
                    {variant.placements.reduce((sum, p) => sum + p.target_area_sqm, 0).toFixed(1)}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900">
                    {variant.placements.reduce((sum, p) => sum + p.actual_area_sqm, 0).toFixed(1)}
                  </td>
                  <td colSpan={2} className="text-right py-3 px-4 text-gray-600 text-xs">
                    {variant.placements.length} rooms placed
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Penalty Weights Used (for advanced users) */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700 hover:text-gray-900 flex items-center gap-2">
            <span className="text-gray-400 group-open:rotate-90 transition-transform">▶</span>
            Advanced: Penalty Weights Used
          </summary>
          <div className="mt-3 p-4 bg-gray-50 rounded text-xs font-mono space-y-1">
            {Object.entries(variant.penalty_weights_used).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-600">{key}</span>
                <span className="font-semibold text-gray-900">{value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

/** Metric card component */
function MetricCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  const color =
    value >= 80
      ? 'from-green-500 to-emerald-500'
      : value >= 60
      ? 'from-blue-500 to-indigo-500'
      : value >= 40
      ? 'from-amber-500 to-orange-500'
      : 'from-red-500 to-rose-500';

  return (
    <div className={`p-4 rounded-lg bg-gradient-to-br ${color} text-white`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-3xl font-bold mb-1">{value.toFixed(0)}</div>
      <div className="text-sm opacity-90">{label}</div>
    </div>
  );
}
