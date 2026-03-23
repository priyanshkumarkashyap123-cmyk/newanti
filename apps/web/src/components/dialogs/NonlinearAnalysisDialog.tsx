/**
 * NonlinearAnalysisDialog.tsx — Quick-launch nonlinear analysis from workspace
 * Wraps the key settings from NonlinearAnalysisPage into a modal dialog
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { TrendingUp, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useModelStore } from '@/store/model';
import { useShallow } from 'zustand/react/shallow';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '@/config/env';

type NonlinearType = 'geometric' | 'material' | 'both';
type SolutionMethod = 'newton-raphson' | 'modified-nr' | 'arc-length' | 'displacement-control';

interface NLParams {
  nonlinearType: NonlinearType;
  solutionMethod: SolutionMethod;
  loadSteps: number;
  maxIterations: number;
  tolerance: number;
  useAdaptiveStepping: boolean;
}

const NonlinearAnalysisDialog: React.FC = () => {
  const { modals, setModal } = useUIStore(
    useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
  );
  const isOpen = modals.nonlinearAnalysis || false;
  const navigate = useNavigate();

  const { nodes, members } = useModelStore(
    useShallow((s) => ({ nodes: s.nodes, members: s.members }))
  );

  const [params, setParams] = useState<NLParams>({
    nonlinearType: 'geometric',
    solutionMethod: 'newton-raphson',
    loadSteps: 10,
    maxIterations: 25,
    tolerance: 1e-6,
    useAdaptiveStepping: true,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; loadFactor: number } | null>(null);

  const modelEmpty = nodes.size === 0 || members.size === 0;

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${API_CONFIG.rustUrl}/analysis/nonlinear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nonlinear_type: params.nonlinearType,
          solution_method: params.solutionMethod,
          load_steps: params.loadSteps,
          max_iterations: params.maxIterations,
          convergence_tolerance: params.tolerance,
          adaptive_stepping: params.useAdaptiveStepping,
        }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      setResult({ status: data.status || 'COMPLETED', loadFactor: data.load_factor || 1.0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsRunning(false);
    }
  }, [params]);

  const handleOpenFullPage = () => {
    setModal('nonlinearAnalysis', false);
    navigate('/analysis/nonlinear');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => setModal('nonlinearAnalysis', open)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            Nonlinear Analysis
            <Badge variant="secondary" className="ml-2">Quick Launch</Badge>
          </DialogTitle>
          <DialogDescription>
            Configure and run geometric/material nonlinear analysis
          </DialogDescription>
        </DialogHeader>

        {modelEmpty && (
          <div className="flex items-center gap-2 p-3 text-yellow-600 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">Create nodes and members before running analysis</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nonlinearity Type</Label>
              <Select
                value={params.nonlinearType}
                onValueChange={v => setParams(prev => ({ ...prev, nonlinearType: v as NonlinearType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="geometric">Geometric (P-Δ)</SelectItem>
                  <SelectItem value="material">Material (Plasticity)</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Solution Method</Label>
              <Select
                value={params.solutionMethod}
                onValueChange={v => setParams(prev => ({ ...prev, solutionMethod: v as SolutionMethod }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newton-raphson">Newton-Raphson</SelectItem>
                  <SelectItem value="modified-nr">Modified NR</SelectItem>
                  <SelectItem value="arc-length">Arc-Length (Riks)</SelectItem>
                  <SelectItem value="displacement-control">Displacement Control</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Load Steps</Label>
              <Input
                type="number"
                value={params.loadSteps}
                onChange={e => setParams(prev => ({ ...prev, loadSteps: parseInt(e.target.value) || 1 }))}
                min={1}
                max={1000}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Iterations</Label>
              <Input
                type="number"
                value={params.maxIterations}
                onChange={e => setParams(prev => ({ ...prev, maxIterations: parseInt(e.target.value) || 1 }))}
                min={1}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tolerance</Label>
              <Input
                type="number"
                step={0.000001}
                value={params.tolerance}
                onChange={e => setParams(prev => ({ ...prev, tolerance: parseFloat(e.target.value) || 1e-6 }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={params.useAdaptiveStepping}
              onChange={e => setParams(prev => ({ ...prev, useAdaptiveStepping: e.target.checked }))}
              className="rounded"
            />
            Adaptive load stepping
          </label>

          {result && (
            <div className={`p-3 rounded-lg border ${result.status === 'CONVERGED' ? 'bg-green-50 dark:bg-green-950 border-[#1a2333]' : 'bg-red-50 dark:bg-red-950 border-[#1a2333]'}`}>
              <div className="text-sm font-medium tracking-wide">{result.status}</div>
              <div className="text-xs text-muted-foreground">Load factor: {result.loadFactor.toFixed(4)}</div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 text-red-600 bg-red-50 dark:bg-red-950 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleOpenFullPage} className="mr-auto">
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Full Analysis Page
          </Button>
          <Button variant="outline" onClick={() => setModal('nonlinearAnalysis', false)}>Cancel</Button>
          <Button disabled={modelEmpty || isRunning} onClick={handleRun}>
            {isRunning ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Running...</> : 'Run Analysis'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NonlinearAnalysisDialog;
