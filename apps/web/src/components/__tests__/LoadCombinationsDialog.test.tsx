import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoadCombinationsDialog from '../LoadCombinationsDialog';
import { useModelStore } from '@/store/model';
import { useUIStore } from '@/store/uiStore';

vi.mock('@/store/model', () => {
  const actual = vi.importActual<any>('@/store/model');
  const mockState = {
    loadCases: [
      { id: 'LC1', name: 'Dead', type: 'DEAD' },
      { id: 'LC2', name: 'Live', type: 'LIVE' },
    ],
    loadCombinations: [],
    addLoadCombination: vi.fn(),
  };
  const useModelStore = (selector: any) => selector(mockState);
  (useModelStore as any).mockState = mockState;
  return { __esModule: true, ...actual, useModelStore, mockState };
});

vi.mock('@/store/uiStore', () => {
  const actual = vi.importActual<any>('@/store/uiStore');
  const mockState = {
    modals: { loadCombinationsDialog: true },
    setModal: vi.fn(),
  };
  const useUIStore = (selector: any) => selector(mockState);
  return { __esModule: true, ...actual, useUIStore, mockState };
});

describe('LoadCombinationsDialog', () => {
  it('maps generated factors to load_case_id and is_service', async () => {
    const mockResponse = {
      combinations: [
        {
          id: 'C1',
          name: '1.5DL + 1.5LL',
          code: 'IS456_LSM',
          limit_state: 'ULS',
          factors: [
            { load_type: 'D', factor: 1.5 },
            { load_type: 'L', factor: 1.5 },
          ],
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => mockResponse } as any);

    render(<LoadCombinationsDialog />);

    const generateButton = await screen.findByRole('button', { name: /IS 456 \(LSM\)/i });
    fireEvent.click(generateButton);

    const applyButton = await screen.findByRole('button', { name: /Apply/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      const state = (useModelStore as any).mockState;
      expect(state.addLoadCombination).toHaveBeenCalled();
      const combo = state.addLoadCombination.mock.calls[0][0];
      expect(combo.factors[0]).toHaveProperty('load_case_id', 'LC1');
      expect(combo).toHaveProperty('is_service', false);
    });
  });
});
