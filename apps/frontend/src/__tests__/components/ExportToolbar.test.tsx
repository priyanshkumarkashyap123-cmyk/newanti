/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportToolbar } from '../../components/export/ExportToolbar';
import type { ExportData } from '../../services/ExportService';

vi.mock('framer-motion', () => {
  const motionHandler = {
    get(_target: unknown, prop: string) {
      return React.forwardRef((props: any, ref: any) => {
        const {
          initial,
          animate,
          exit,
          variants,
          whileInView,
          viewport,
          transition,
          whileHover,
          whileTap,
          ...rest
        } = props;
        return React.createElement(prop, { ...rest, ref });
      });
    },
  };

  return {
    motion: new Proxy({}, motionHandler),
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

const exportData: ExportData = {
  projectName: 'QA Tower',
  projectNumber: 'BL-2026-011',
  engineer: 'BeamLab QA',
  client: 'Internal',
  timestamp: new Date('2026-03-11T00:00:00Z'),
  nodes: [],
  members: [],
  reactions: [],
  designChecks: [],
  loadCases: ['LC1'],
  units: {
    length: 'm',
    force: 'kN',
    moment: 'kN·m',
    stress: 'MPa',
  },
  analysisInfo: {
    method: 'Direct Stiffness',
    dofCount: 0,
    solveTimeMs: 0,
    warnings: [],
  },
};

describe('ExportToolbar', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('dispatches the unified PDF export event from the dropdown option', async () => {
    const user = userEvent.setup();
    const onExportComplete = vi.fn();
    const triggerListener = vi.fn();
    document.addEventListener('trigger-pdf-report', triggerListener);

    render(
      <ExportToolbar exportData={exportData} onExportComplete={onExportComplete} />,
    );

    await user.click(screen.getByRole('button', { name: /open export options/i }));
    await user.click(screen.getByRole('button', { name: /clean pdf report/i }));

    expect(triggerListener).toHaveBeenCalledTimes(1);
    expect(onExportComplete).toHaveBeenCalledWith('pdf');

    document.removeEventListener('trigger-pdf-report', triggerListener);
  });
});
