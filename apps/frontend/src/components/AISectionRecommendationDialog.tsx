/**
 * AISectionRecommendationDialog.tsx
 *
 * Advanced AI-powered section recommendation dialog with ML optimization
 * Provides intelligent section suggestions based on design requirements
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Package,
  CheckCircle,
  AlertTriangle,
  Zap,
  Target,
  Scale,
  DollarSign,
  Settings,
  ShieldCheck,
  Plus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { aiSectionRecommendationService, SectionRecommendation, OptimizationResult } from '../services/AISectionRecommendationService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApply: (sectionName: string) => void;
  initialDemands?: {
    axial_force?: number; // kN
    shear_force?: number; // kN
    bending_moment?: number; // kN·m
    deflection_limit?: number; // mm
    span_length?: number; // m
  };
}

export const AISectionRecommendationDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onApply,
  initialDemands = {}
}) => {
  // Form state
  const [formData, setFormData] = useState({
    axial_force: initialDemands.axial_force || 0,
    shear_force: initialDemands.shear_force || 0,
    bending_moment: initialDemands.bending_moment || 0,
    deflection_limit: initialDemands.deflection_limit || undefined,
    span_length: initialDemands.span_length || undefined,
    code: 'IS800' as 'IS800' | 'AISC360' | 'EC3',
    material: 'steel' as 'steel' | 'concrete',
    utilization_target: 0.8,
    max_results: 5
  });

  // Optimization state
  const [optimizationGoal, setOptimizationGoal] = useState<'cost' | 'weight' | 'safety' | 'balanced'>('balanced');
  const [constraints, setConstraints] = useState({
    max_cost_per_m: undefined as number | undefined,
    max_weight_per_m: undefined as number | undefined
  });

  // Results state
  const [recommendations, setRecommendations] = useState<SectionRecommendation[]>([]);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recommend' | 'optimize'>('recommend');

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        axial_force: initialDemands.axial_force || 0,
        shear_force: initialDemands.shear_force || 0,
        bending_moment: initialDemands.bending_moment || 0,
        deflection_limit: initialDemands.deflection_limit || undefined,
        span_length: initialDemands.span_length || undefined,
        code: 'IS800',
        material: 'steel',
        utilization_target: 0.8,
        max_results: 5
      });
      setRecommendations([]);
      setOptimizationResult(null);
      setSelectedSection(null);
    }
  }, [isOpen, initialDemands]);

  const handleGetRecommendations = async () => {
    setLoading(true);
    try {
      const result = await aiSectionRecommendationService.getRecommendations(formData);
      if (result.success) {
        setRecommendations(result.recommendations);
      } else {
        console.error('Failed to get recommendations:', result.error);
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeSection = async () => {
    setOptimizing(true);
    try {
      const result = await aiSectionRecommendationService.optimizeSection({
        ...formData,
        optimization_goal: optimizationGoal,
        constraints: {
          max_cost_per_m: constraints.max_cost_per_m,
          max_weight_per_m: constraints.max_weight_per_m
        }
      });
      if (result.success && result.optimization) {
        setOptimizationResult(result.optimization);
      } else {
        console.error('Failed to optimize section:', result.error);
      }
    } catch (error) {
      console.error('Error optimizing section:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const handleApply = () => {
    const sectionToApply = activeTab === 'recommend'
      ? recommendations.find(r => r.section_name === selectedSection)
      : optimizationResult?.optimal_section;

    if (sectionToApply) {
      onApply(sectionToApply.section_name);
      onClose();
    }
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization <= 0.8) return 'text-green-500';
    if (utilization <= 0.95) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getUtilizationIcon = (utilization: number) => {
    if (utilization <= 0.8) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (utilization <= 0.95) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <AlertTriangle className="w-4 h-4 text-red-500" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1200px] max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-[#1a2333]">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-blue-400 animate-pulse" />
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-gradient-premium">
                BeamLab Ultimate AI Recommender
              </DialogTitle>
              <DialogDescription className="text-sm text-[#869ab8] font-medium">
                Deterministic Engine • IS 800:2007 • IS 456 compliance
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Engineering Liability Banner */}
          <div className="bg-blue-500/5 border-b border-blue-500/10 px-6 py-2.5 flex items-center gap-3 flex-shrink-0 animate-fadeIn">
            <div className="bg-blue-500/20 p-1 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-[11px] text-blue-300/80 leading-tight font-medium uppercase tracking-wider">
              Verification Required: AI generates high-fidelity preliminary estimates. Final designs must be validated against 
              primary FEM solvers by a licensed Structural Engineer.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'recommend' | 'optimize')} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 mx-6 mt-4 flex-shrink-0">
              <TabsTrigger value="recommend" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Recommendations
              </TabsTrigger>
              <TabsTrigger value="optimize" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Optimization
              </TabsTrigger>
            </TabsList>

            {/* Input Form */}
            <div className="px-6 py-4 border-b border-[#1a2333]">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="axial_force" className="text-xs text-[#869ab8]">Axial Force (kN)</Label>
                  <Input
                    id="axial_force"
                    type="number"
                    value={formData.axial_force}
                    onChange={(e) => setFormData(prev => ({ ...prev, axial_force: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-800/50 border-slate-600"
                  />
                </div>
                <div>
                  <Label htmlFor="shear_force" className="text-xs text-[#869ab8]">Shear Force (kN)</Label>
                  <Input
                    id="shear_force"
                    type="number"
                    value={formData.shear_force}
                    onChange={(e) => setFormData(prev => ({ ...prev, shear_force: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-800/50 border-slate-600"
                  />
                </div>
                <div>
                  <Label htmlFor="bending_moment" className="text-xs text-[#869ab8]">Bending Moment (kN·m)</Label>
                  <Input
                    id="bending_moment"
                    type="number"
                    value={formData.bending_moment}
                    onChange={(e) => setFormData(prev => ({ ...prev, bending_moment: parseFloat(e.target.value) || 0 }))}
                    className="bg-slate-800/50 border-slate-600"
                  />
                </div>
                <div>
                  <Label htmlFor="deflection_limit" className="text-xs text-[#869ab8]">Deflection Limit (mm)</Label>
                  <Input
                    id="deflection_limit"
                    type="number"
                    placeholder="Optional"
                    value={formData.deflection_limit || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, deflection_limit: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="bg-slate-800/50 border-slate-600"
                  />
                </div>
                <div>
                  <Label htmlFor="span_length" className="text-xs text-[#869ab8]">Span Length (m)</Label>
                  <Input
                    id="span_length"
                    type="number"
                    placeholder="Optional"
                    value={formData.span_length || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, span_length: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    className="bg-slate-800/50 border-slate-600"
                  />
                </div>
                <div>
                  <Label htmlFor="code" className="text-xs text-[#869ab8]">Design Code</Label>
                  <Select value={formData.code} onValueChange={(value) => setFormData(prev => ({ ...prev, code: value as any }))}>
                    <SelectTrigger className="bg-slate-800/50 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IS800">IS 800 (India)</SelectItem>
                      <SelectItem value="AISC360">AISC 360 (US)</SelectItem>
                      <SelectItem value="EC3">EC3 (Europe)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="material" className="text-xs text-[#869ab8]">Material</Label>
                  <Select value={formData.material} onValueChange={(value) => setFormData(prev => ({ ...prev, material: value as any }))}>
                    <SelectTrigger className="bg-slate-800/50 border-slate-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="steel">Steel</SelectItem>
                      <SelectItem value="concrete">Concrete</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="utilization_target" className="text-xs text-[#869ab8]">Target Utilization</Label>
                  <Input
                    id="utilization_target"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="1.0"
                    value={formData.utilization_target}
                    onChange={(e) => setFormData(prev => ({ ...prev, utilization_target: parseFloat(e.target.value) || 0.8 }))}
                    className="bg-slate-800/50 border-slate-600"
                  />
                </div>
              </div>

              {activeTab === 'optimize' && (
                <div className="mt-4 p-4 bg-slate-800/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Settings className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-[#adc6ff]">Optimization Settings</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-[#869ab8]">Optimization Goal</Label>
                      <Select value={optimizationGoal} onValueChange={(value) => setOptimizationGoal(value as any)}>
                        <SelectTrigger className="bg-slate-800/50 border-slate-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="balanced">Balanced</SelectItem>
                          <SelectItem value="cost">Minimize Cost</SelectItem>
                          <SelectItem value="weight">Minimize Weight</SelectItem>
                          <SelectItem value="safety">Maximize Safety</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-[#869ab8]">Max Cost/m (₹)</Label>
                      <Input
                        type="number"
                        placeholder="Optional"
                        value={constraints.max_cost_per_m || ''}
                        onChange={(e) => setConstraints(prev => ({ ...prev, max_cost_per_m: e.target.value ? parseFloat(e.target.value) : undefined }))}
                        className="bg-slate-800/50 border-slate-600"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#869ab8]">Max Weight/m (kg)</Label>
                      <Input
                        type="number"
                        placeholder="Optional"
                        value={constraints.max_weight_per_m || ''}
                        onChange={(e) => setConstraints(prev => ({ ...prev, max_weight_per_m: e.target.value ? parseFloat(e.target.value) : undefined }))}
                        className="bg-slate-800/50 border-slate-600"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <TabsContent value="recommend" className="flex-1 overflow-hidden">
              <div className="px-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[#adc6ff]">Section Recommendations</h3>
                  <Button
                    onClick={handleGetRecommendations}
                    disabled={loading}
                    className="btn-shimmer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-900/20"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="loading-spinner w-3 h-3" />
                        <span>Analyzing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        <span>Run Structural Audit</span>
                      </div>
                    )}
                  </Button>
                </div>

                {recommendations.length > 0 && (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {recommendations.map((rec, index) => (
                      <div
                        key={rec.section_name}
                        className={`p-4 rounded-xl border-l-4 cursor-pointer transition-all duration-300 card-glow animate-fadeIn relative overflow-hidden ${
                          selectedSection === rec.section_name
                            ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                            : 'border-slate-700 bg-slate-800/20 hover:bg-slate-800/40 hover:border-slate-500'
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => setSelectedSection(rec.section_name)}
                      >
                        <div className="absolute top-0 right-0 p-1 opacity-20 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-3 h-3 text-blue-400" />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-blue-400" />
                            <span className="font-medium text-[#dae2fd]">{rec.section_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {rec.section_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {getUtilizationIcon(rec.design_checks.overall_utilization)}
                            <span className={`text-sm font-medium ${getUtilizationColor(rec.design_checks.overall_utilization)}`}>
                              {rec.design_checks.overall_utilization.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-xs text-[#869ab8]">
                          <div>
                            <span>Area: {rec.properties.area.toFixed(0)} mm²</span>
                          </div>
                          <div>
                            <span>Weight: {rec.properties.weight_per_m.toFixed(1)} kg/m</span>
                          </div>
                          <div>
                            <span>Zx: {rec.properties.Zx.toFixed(0)} mm³</span>
                          </div>
                          <div>
                            <span>Score: {rec.score.toFixed(1)}</span>
                          </div>
                        </div>

                        {rec.reasoning.length > 0 && (
                          <div className="mt-2 text-xs text-[#869ab8]">
                            <span className="font-medium">Reasoning:</span> {rec.reasoning.slice(0, 2).join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {recommendations.length === 0 && !loading && (
                  <div className="text-center py-8 text-[#869ab8]">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Enter design requirements and click "Get Recommendations"</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="optimize" className="flex-1 overflow-hidden">
              <div className="px-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[#adc6ff]">Section Optimization</h3>
                  <Button
                    onClick={handleOptimizeSection}
                    disabled={optimizing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {optimizing ? 'Optimizing...' : 'Run Optimization'}
                  </Button>
                </div>

                {optimizationResult && (
                  <div className="space-y-4 animate-slideUp">
                    <div className="p-5 card-premium bg-green-500/5 border border-green-500/20 rounded-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl -mr-16 -mt-16 rounded-full" />
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-green-500/20 p-1.5 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                        <span className="font-bold text-lg text-green-300 tracking-tight">Optimal Candidate Isolated</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <span className="text-sm text-[#869ab8]">Section</span>
                          <p className="font-medium text-[#dae2fd]">{optimizationResult.optimal_section.section_name}</p>
                        </div>
                        <div>
                          <span className="text-sm text-[#869ab8]">Optimization Score</span>
                          <p className="font-medium text-[#dae2fd]">{optimizationResult.optimization_metrics.goal_achieved.toFixed(1)}%</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-blue-400" />
                          <span className="text-[#869ab8]">Weight: {optimizationResult.optimal_section.properties.weight_per_m.toFixed(1)} kg/m</span>
                        </div>
                        {optimizationResult.cost_breakdown && (
                          <>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-green-400" />
                              <span className="text-[#869ab8]">Cost: ₹{optimizationResult.cost_breakdown.total_cost_per_m.toFixed(0)}/m</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-yellow-400" />
                              <span className="text-[#869ab8]">Utilization: {optimizationResult.optimal_section.design_checks.overall_utilization.toFixed(1)}%</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-[#869ab8] space-y-1">
                      <p>• {optimizationResult.optimization_metrics.alternatives_considered} sections evaluated</p>
                      <p>• Constraints satisfied: {optimizationResult.optimization_metrics.constraints_satisfied ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                )}

                {!optimizationResult && !optimizing && (
                  <div className="text-center py-8 text-[#869ab8]">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Configure optimization parameters and click "Run Optimization"</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-[#1a2333]">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedSection && !optimizationResult}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Apply Section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};