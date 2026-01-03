/**
 * SectionRecommendationDialog.tsx
 * 
 * AI-powered section recommendation dialog.
 * Shows when analysis fails or sections are inadequate.
 * Recommends better sections from IS 800 database.
 */

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Package, CheckCircle, AlertTriangle } from 'lucide-react';

interface SectionProperties {
  area: number;
  depth: number;
  width: number;
  tw: number;
  tf: number;
  ixx: number;
  iyy: number;
  zxx: number;
  zyy: number;
  rxx: number;
  ryy: number;
  weight_per_meter: number;
}

interface SectionCapacity {
  Mx_elastic_kNm: number;
  My_elastic_kNm: number;
  P_capacity_kN: number;
  slenderness_ratio_xx: number;
  slenderness_ratio_yy: number;
}

interface SectionRecommendation {
  designation: string;
  section_type: string;
  properties: SectionProperties;
  capacity: SectionCapacity;
  material: {
    fy: number;
    fu: number;
    E: number;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (designation: string) => void;
  memberType: 'beam' | 'column';
  demands: {
    Mx?: number;  // kN·m
    My?: number;  // kN·m
    P?: number;   // kN
    V?: number;   // kN
    length: number;  // mm
  };
  currentSection?: string;
}

export const SectionRecommendationDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onApply,
  memberType,
  demands,
  currentSection
}) => {
  const [recommendations, setRecommendations] = useState<SectionRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [sectionType, setSectionType] = useState<'ISMB' | 'ISMC' | 'ISA'>('ISMB');

  useEffect(() => {
    if (isOpen) {
      fetchRecommendations();
    }
  }, [isOpen, sectionType, demands]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const PYTHON_API = import.meta.env['VITE_PYTHON_API_URL'] || 'https://api.beamlabultimate.tech';
      
      const response = await fetch(`${PYTHON_API}/sections/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          member_type: memberType,
          required_Mx: demands.Mx || 0,
          required_My: demands.My || 0,
          required_P: demands.P || 0,
          required_V: demands.V || 0,
          length: demands.length || 5000,
          section_type: sectionType,
          safety_factor: 1.5
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (selectedSection) {
      onApply(selectedSection);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl w-[900px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                AI Section Recommendation
              </h2>
              <p className="text-sm text-zinc-400">
                {memberType === 'beam' ? 'Beam' : 'Column'} - Based on structural demands
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Demands Summary */}
        <div className="px-6 py-4 bg-zinc-800/50 border-b border-zinc-700">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Structural Demands</h3>
          <div className="grid grid-cols-4 gap-4">
            {demands.Mx !== undefined && demands.Mx > 0 && (
              <div>
                <span className="text-xs text-zinc-500">Mx (kN·m)</span>
                <p className="text-sm font-medium text-white">{demands.Mx.toFixed(1)}</p>
              </div>
            )}
            {demands.My !== undefined && demands.My > 0 && (
              <div>
                <span className="text-xs text-zinc-500">My (kN·m)</span>
                <p className="text-sm font-medium text-white">{demands.My.toFixed(1)}</p>
              </div>
            )}
            {demands.P !== undefined && demands.P > 0 && (
              <div>
                <span className="text-xs text-zinc-500">Axial (kN)</span>
                <p className="text-sm font-medium text-white">{demands.P.toFixed(1)}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-zinc-500">Length (m)</span>
              <p className="text-sm font-medium text-white">{(demands.length / 1000).toFixed(1)}</p>
            </div>
          </div>
        </div>

        {/* Section Type Selector */}
        <div className="px-6 py-3 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Section Type:</span>
            <div className="flex gap-2">
              {(['ISMB', 'ISMC', 'ISA'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setSectionType(type)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    sectionType === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recommendations List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
              <p className="text-zinc-400">No suitable sections found for the given demands.</p>
              <p className="text-sm text-zinc-500 mt-1">Try reducing the safety factor or changing section type.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div
                  key={rec.designation}
                  onClick={() => setSelectedSection(rec.designation)}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedSection === rec.designation
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">
                          {rec.designation}
                        </h3>
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded">
                            RECOMMENDED
                          </span>
                        )}
                        {selectedSection === rec.designation && (
                          <CheckCircle className="w-5 h-5 text-blue-500" />
                        )}
                      </div>
                      
                      {/* Capacity Information */}
                      <div className="grid grid-cols-4 gap-4 mb-3">
                        {memberType === 'beam' ? (
                          <>
                            <div>
                              <span className="text-xs text-zinc-500">Mx Capacity</span>
                              <p className="text-sm font-medium text-white">
                                {rec.capacity.Mx_elastic_kNm.toFixed(1)} kN·m
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-zinc-500">My Capacity</span>
                              <p className="text-sm font-medium text-white">
                                {rec.capacity.My_elastic_kNm.toFixed(1)} kN·m
                              </p>
                            </div>
                          </>
                        ) : (
                          <div>
                            <span className="text-xs text-zinc-500">Axial Capacity</span>
                            <p className="text-sm font-medium text-white">
                              {rec.capacity.P_capacity_kN.toFixed(0)} kN
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="text-xs text-zinc-500">Weight</span>
                          <p className="text-sm font-medium text-white">
                            {rec.properties.weight_per_meter.toFixed(1)} kg/m
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-zinc-500">Section</span>
                          <p className="text-sm font-medium text-white">
                            {rec.properties.depth.toFixed(0)} × {rec.properties.width.toFixed(0)} mm
                          </p>
                        </div>
                      </div>

                      {/* Efficiency Bar */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                          <span>Utilization Ratio</span>
                          <span>
                            {memberType === 'beam' 
                              ? ((demands.Mx || 0) * 1.5 / rec.capacity.Mx_elastic_kNm * 100).toFixed(0)
                              : ((demands.P || 0) * 1.5 / rec.capacity.P_capacity_kN * 100).toFixed(0)
                            }%
                          </span>
                        </div>
                        <div className="w-full bg-zinc-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              index === 0 ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{
                              width: `${Math.min(100, memberType === 'beam'
                                ? ((demands.Mx || 0) * 1.5 / rec.capacity.Mx_elastic_kNm * 100)
                                : ((demands.P || 0) * 1.5 / rec.capacity.P_capacity_kN * 100)
                              )}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-700 flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            {recommendations.length > 0 && (
              <>Showing top {recommendations.length} recommendations</>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedSection}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedSection
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              Apply Section
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
