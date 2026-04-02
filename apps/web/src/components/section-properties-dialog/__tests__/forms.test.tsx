import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
    CalculateSectionForm,
    CustomSectionForm,
    MaterialSelectionForm,
} from '../forms';
import type { SectionDimensions } from '../helpers';

describe('section-properties-dialog forms', () => {
    it('emits dimension updates from CalculateSectionForm', () => {
        const onSectionShapeChange = vi.fn();
        const onDimensionsChange = vi.fn();
        const dimensions: SectionDimensions = {
            b: 300,
            h: 500,
            D: 400,
            d: 300,
            bf: 150,
            tf: 12,
            tw: 8,
        };

        render(
            <CalculateSectionForm
                sectionShape="rectangular"
                dimensions={dimensions}
                onSectionShapeChange={onSectionShapeChange}
                onDimensionsChange={onDimensionsChange}
            />
        );

        fireEvent.change(screen.getByDisplayValue('300'), { target: { value: '450' } });
        expect(onDimensionsChange).toHaveBeenCalled();
        expect(onDimensionsChange.mock.calls[0][0].b).toBe(450);

        fireEvent.click(screen.getByRole('button', { name: /circular/i }));
        expect(onSectionShapeChange).toHaveBeenCalledWith('circular');
    });

    it('emits custom section updates from CustomSectionForm', () => {
        const onCustomSectionChange = vi.fn();

        render(
            <CustomSectionForm
                customSection={{ name: 'Custom', A: 5000 }}
                onCustomSectionChange={onCustomSectionChange}
            />
        );

        fireEvent.change(screen.getByDisplayValue('Custom'), { target: { value: 'Edited Section' } });
        expect(onCustomSectionChange).toHaveBeenCalled();
        expect(onCustomSectionChange.mock.calls[0][0].name).toBe('Edited Section');
    });

    it('switches material type and updates custom material', () => {
        const onMaterialTypeChange = vi.fn();
        const onSelectedMaterialIdChange = vi.fn();
        const onCustomMaterialChange = vi.fn();

        render(
            <MaterialSelectionForm
                materialType="custom"
                selectedMaterialId="steel-a36"
                customMaterial={{ E: 200000, fy: 250 }}
                onMaterialTypeChange={onMaterialTypeChange}
                onSelectedMaterialIdChange={onSelectedMaterialIdChange}
                onCustomMaterialChange={onCustomMaterialChange}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /steel/i }));
        expect(onMaterialTypeChange).toHaveBeenCalledWith('steel');

        fireEvent.change(screen.getByDisplayValue('200000'), { target: { value: '215000' } });
        expect(onCustomMaterialChange).toHaveBeenCalled();
        expect(onCustomMaterialChange.mock.calls[0][0].E).toBe(215000);
    });
});
