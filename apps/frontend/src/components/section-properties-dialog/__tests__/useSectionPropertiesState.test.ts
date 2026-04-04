import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSectionPropertiesState } from '../useSectionPropertiesState';

describe('useSectionPropertiesState', () => {
    it('derives custom section/material and applies them', () => {
        const onApply = vi.fn();
        const onClose = vi.fn();

        const { result } = renderHook(() =>
            useSectionPropertiesState({
                onApply,
                onClose,
            })
        );

        act(() => {
            result.current.setActiveTab('custom');
            result.current.setCustomSection({
                ...result.current.customSection,
                name: 'My Custom Section',
                A: 7777,
            });
            result.current.setMaterialType('custom');
            result.current.setCustomMaterial({
                ...result.current.customMaterial,
                E: 210000,
                fy: 345,
            });
        });

        expect(result.current.selectedSection.id).toBe('custom');
        expect(result.current.selectedSection.name).toBe('My Custom Section');
        expect(result.current.selectedMaterial.id).toBe('custom');
        expect(result.current.selectedMaterial.E).toBe(210000);

        act(() => {
            result.current.handleApply();
        });

        expect(onApply).toHaveBeenCalledTimes(1);
        const [sectionArg, materialArg] = onApply.mock.calls[0];
        expect(sectionArg.id).toBe('custom');
        expect(sectionArg.name).toBe('My Custom Section');
        expect(materialArg.id).toBe('custom');
        expect(materialArg.fy).toBe(345);
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
