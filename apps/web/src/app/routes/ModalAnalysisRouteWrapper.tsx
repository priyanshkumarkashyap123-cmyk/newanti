import React, { lazy } from 'react';
import { useNavigate } from 'react-router-dom';

const ModalAnalysisPanel = lazy(() =>
  import('../../components/analysis/ModalAnalysisPanel').then((module) => ({
    default: module.ModalAnalysisPanel,
  })),
);

export function ModalAnalysisRouteWrapper() {
  const navigate = useNavigate();
  return <ModalAnalysisPanel isOpen={true} onClose={() => navigate(-1)} />;
}
