/**
 * SectionRecommendationDialog.tsx
 * 
 * AI-powered section recommendation dialog.
 * Shows when analysis fails or sections are inadequate.
 * Recommends better sections from IS 800 database.
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, Package, CheckCircle, AlertTriangle } from 'lucide-react';
import { API_CONFIG } from '../config/env';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

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
      const PYTHON_API = API_CONFIG.pythonUrl;
      
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[900px] max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-[#1a2333]">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-500" />
            <div>
              <DialogTitle className="text-lg font-semibold text-[#dae2fd]">
                AI Section Recommendation
              </DialogTitle>
              <DialogDescription className="text-sm text-[#869ab8]">
                {memberType === 'beam' ? 'Beam' : 'Column'} - Based on structural demands
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Demands Summary */}
        <div className="px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-b border-[#1a2333]">
          <h3 className="text-sm font-medium tracking-wide text-[#adc6ff] mb-2">Structural Demands</h3>
          <div className="grid grid-cols-4 gap-4">
            {demands.Mx !== undefined && demands.Mx > 0 && (
              <div>
                <span className="text-xs text-[#869ab8]">Mx (kN·m)</span>
                <p className="text-sm font-medium tracking-wide text-[#dae2fd]">{demands.Mx.toFixed(1)}</p>
              </div>
            )}
            {demands.My !== undefined && demands.My > 0 && (
              <div>
                <span className="text-xs text-[#869ab8]">My (kN·m)</span>
                <p className="text-sm font-medium tracking-wide text-[#dae2fd]">{demands.My.toFixed(1)}</p>
              </div>
            )}
            {demands.P !== undefined && demands.P > 0 && (
              <div>
                <span className="text-xs text-[#869ab8]">Axial (kN)</span>
                <p className="text-sm font-medium tracking-wide text-[#dae2fd]">{demands.P.toFixed(1)}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-[#869ab8]">Length (m)</span>
              <p className="text-sm font-medium tracking-wide text-[#dae2fd]">{(demands.length / 1000).toFixed(1)}</p>
            </div>
          </div>
        </div>

        {/* Section Type Selector */}
        <div className="px-6 py-3 border-b border-[#1a2333]">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#869ab8]">Section Type:</span>
            <div className="flex gap-2">
              {(['ISMB', 'ISMC', 'ISA'] as const).map((type) => (
                <Button
                  key={type}
                  variant={sectionType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSectionType(type)}
                >
                  {type}
                </Button>
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
              <p className="text-[#869ab8]">No suitable sections found for the given demands.</p>
              <p className="text-sm text-[#869ab8] mt-1">Try reducing the safety factor or changing section type.</p>
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
                      : 'border-[#1a2333] hover:border-slate-300 dark:hover:border-slate-600 bg-slate-100/30 dark:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-[#dae2fd]">
                          {rec.designation}
                        </h3>
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium tracking-wide rounded">
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
                              <span className="text-xs text-[#869ab8]">Mx Capacity</span>
                              <p className="text-sm font-medium tracking-wide text-[#dae2fd]">
                                {rec.capacity.Mx_elastic_kNm.toFixed(1)} kN·m
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-[#869ab8]">My Capacity</span>
                              <p className="text-sm font-medium tracking-wide text-[#dae2fd]">
                                {rec.capacity.My_elastic_kNm.toFixed(1)} kN·m
                              </p>
                            </div>
                          </>
                        ) : (
                          <div>
                            <span className="text-xs text-[#869ab8]">Axial Capacity</span>
                            <p className="text-sm font-medium tracking-wide text-[#dae2fd]">
                              {rec.capacity.P_capacity_kN.toFixed(0)} kN
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="text-xs text-[#869ab8]">Weight</span>
                          <p className="text-sm font-medium tracking-wide text-[#dae2fd]">
                            {rec.properties.weight_per_meter.toFixed(1)} kg/m
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-[#869ab8]">Section</span>
                          <p className="text-sm font-medium tracking-wide text-[#dae2fd]">
                            {rec.properties.depth.toFixed(0)} × {rec.properties.width.toFixed(0)} mm
                          </p>
                        </div>
                      </div>

                      {/* Efficiency Bar */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-[#869ab8] mb-1">
                          <span>Utilization Ratio</span>
                          <span>
                            {memberType === 'beam' 
                              ? ((demands.Mx || 0) * 1.5 / rec.capacity.Mx_elastic_kNm * 100).toFixed(0)
                              : ((demands.P || 0) * 1.5 / rec.capacity.P_capacity_kN * 100).toFixed(0)
                            }%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
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
        <DialogFooter className="px-6 py-4 border-t border-[#1a2333] flex items-center justify-between sm:justify-between">
          <div className="text-sm text-[#869ab8]">
            {recommendations.length > 0 && (
              <>Showing top {recommendations.length} recommendations</>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={!selectedSection}
            >
              Apply Section
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
