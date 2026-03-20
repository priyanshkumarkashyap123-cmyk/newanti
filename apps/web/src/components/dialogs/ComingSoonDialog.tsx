/**
 * ComingSoonDialog.tsx — Reusable feature access dialog
 * Used as a lightweight routing/feature guidance surface.
 */

import React from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

type ModalKey = keyof ReturnType<typeof useUIStore.getState>['modals'];

interface ComingSoonDialogProps {
  modalKey: ModalKey;
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
    <Dialog open={isOpen} onOpenChange={(open) => setModal(modalKey, open)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-amber-500" />
            {title}
            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
              Feature Info
            </Badge>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-[#1a2333]">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium tracking-wide tracking-wide text-amber-900 dark:text-amber-200">
                Available Capabilities
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
              Version target: {expectedVersion}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => setModal(modalKey, false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComingSoonDialog;

// ===== Pre-configured wrappers for feature modules =====

const RedirectModal: React.FC<{ modalKey: ModalKey; path: string }> = ({ modalKey, path }) => {
  const navigate = useNavigate();
  const setModal = useUIStore((s) => s.setModal);

  useEffect(() => {
    setModal(modalKey, false);
    navigate(path);
  }, [modalKey, navigate, path, setModal]);

  return null;
};

export const RCDetailingDialog: React.FC = () => (
  <RedirectModal modalKey="rcDetailing" path="/design/detailing" />
);

export const SteelDetailingDialog: React.FC = () => (
  <RedirectModal modalKey="steelDetailing" path="/design/connections" />
);

export const SectionOptimizationDialog: React.FC = () => (
  <RedirectModal modalKey="sectionOptimization" path="/design-hub" />
);

export const DesignHubDialog: React.FC = () => (
  <RedirectModal modalKey="designHub" path="/design-hub" />
);

export const GeotechnicalDialog: React.FC = () => (
  <RedirectModal modalKey="geotechnicalDesign" path="/design/foundation" />
);

export const HydraulicsDialog: React.FC = () => (
  <RedirectModal modalKey="hydraulicsDesign" path="/analysis/plate-shell" />
);

export const TransportDialog: React.FC = () => (
  <RedirectModal modalKey="transportDesign" path="/space-planning" />
);

export const ConstructionMgmtDialog: React.FC = () => (
  <RedirectModal modalKey="constructionMgmt" path="/dashboard" />
);
