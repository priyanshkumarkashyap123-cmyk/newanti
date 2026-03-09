/**
 * ComingSoonDialog.tsx — Reusable "Coming Soon" placeholder for features in development
 * Used by modules that are planned but not yet implemented.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Construction, Sparkles, type LucideIcon } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { useShallow } from 'zustand/react/shallow';

interface ComingSoonDialogProps {
  modalKey: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  features: string[];
  expectedVersion?: string;
}

const ComingSoonDialog: React.FC<ComingSoonDialogProps> = ({
  modalKey,
  title,
  description,
  icon: Icon = Construction,
  features,
  expectedVersion,
}) => {
  const { modals, setModal } = useUIStore(
    useShallow((s) => ({ modals: s.modals, setModal: s.setModal }))
  );
  const isOpen = (modals as Record<string, boolean>)[modalKey] || false;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => setModal(modalKey as any, open)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-amber-500" />
            {title}
            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
              Coming Soon
            </Badge>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Planned Features
              </span>
            </div>
            <ul className="space-y-1.5">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <span className="text-amber-400 mt-0.5">•</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {expectedVersion && (
            <p className="text-xs text-muted-foreground text-center">
              Expected in {expectedVersion}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => setModal(modalKey as any, false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComingSoonDialog;

// ===== Pre-configured wrappers for each Coming Soon module =====

export const RCDetailingDialog: React.FC = () => (
  <ComingSoonDialog
    modalKey="rcDetailing"
    title="RC Detailing"
    description="Automated reinforcement detailing and bar bending schedules"
    features={[
      'Auto-generate bar bending schedules per IS 2502',
      'Beam & column section detailing drawings',
      'Lap length and development length checks (IS 456 Cl. 26.2)',
      'Curtailment optimization',
      'Export to DXF / PDF',
    ]}
    expectedVersion="v2.5"
  />
);

export const SteelDetailingDialog: React.FC = () => (
  <ComingSoonDialog
    modalKey="steelDetailing"
    title="Steel Detailing"
    description="Connection detailing and shop drawing generation"
    features={[
      'Bolted & welded connection detail drawings',
      'Stiffener and splice plate layout',
      'Weld symbol annotation per IS 813 / AWS D1.1',
      'Bill of materials with section cut lengths',
      'Export to DXF / IFC',
    ]}
    expectedVersion="v2.5"
  />
);

export const SectionOptimizationDialog: React.FC = () => (
  <ComingSoonDialog
    modalKey="sectionOptimization"
    title="Section Optimization"
    description="Automated member sizing using FSD and genetic algorithms"
    features={[
      'Fully Stressed Design (FSD) iteration',
      'Genetic algorithm-based multi-objective optimization',
      'Weight minimization with code compliance constraints',
      'Strength & serviceability limit state checks',
      'Batch optimization across all members',
    ]}
    expectedVersion="v2.6"
  />
);

export const DesignHubDialog: React.FC = () => (
  <ComingSoonDialog
    modalKey="designHub"
    title="Design Hub"
    description="Centralized multi-code design workflow dashboard"
    features={[
      'Unified design check dashboard across IS/ACI/EC codes',
      'Combined utilization ratio heat maps',
      'Automated design iteration with solver feedback',
      'Design report generation (PDF/DOCX)',
      'Version-controlled design audit trail',
    ]}
    expectedVersion="v3.0"
  />
);

export const GeotechnicalDialog: React.FC = () => (
  <ComingSoonDialog
    modalKey="geotechnicalDesign"
    title="Geotechnical Design"
    description="Foundation and soil engineering analysis tools"
    features={[
      'Bearing capacity per IS 6403 / Terzaghi / Meyerhof',
      'Settlement analysis (immediate + consolidation)',
      'Pile capacity — static formula & load test correlation',
      'Lateral earth pressure (Rankine, Coulomb)',
      'Slope stability (Bishop, Morgenstern-Price)',
    ]}
    expectedVersion="v3.0"
  />
);

export const HydraulicsDialog: React.FC = () => (
  <ComingSoonDialog
    modalKey="hydraulicsDesign"
    title="Hydraulics Design"
    description="Open channel and pipe flow analysis"
    features={[
      'Manning\'s equation for open channel design',
      'Pipe network analysis (Hardy Cross)',
      'Critical & normal depth calculations',
      'Hydraulic jump analysis',
      'Water hammer / surge analysis',
    ]}
    expectedVersion="v3.0"
  />
);

export const TransportDialog: React.FC = () => (
  <ComingSoonDialog
    modalKey="transportDesign"
    title="Transport Engineering"
    description="Highway geometry and pavement design"
    features={[
      'Horizontal & vertical curve design (IRC SP-23)',
      'Sight distance analysis',
      'Flexible & rigid pavement design per IRC 37 / IRC 58',
      'Traffic analysis and LOS estimation',
      'Super-elevation and widening calculations',
    ]}
    expectedVersion="v3.0"
  />
);

export const ConstructionMgmtDialog: React.FC = () => (
  <ComingSoonDialog
    modalKey="constructionMgmt"
    title="Construction Management"
    description="Project scheduling and resource planning tools"
    features={[
      'CPM / PERT network scheduling',
      'Gantt chart with resource leveling',
      'Earned value management (EVM) tracking',
      'Material quantity take-off from model',
      'Cost estimation and budget tracking',
    ]}
    expectedVersion="v3.0"
  />
);
