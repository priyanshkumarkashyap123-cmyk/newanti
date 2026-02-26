/**
 * RangeSlider - Professional range slider with labels
 * Used for mesh density, quality settings, and numerical ranges
 */

import { FC } from 'react';

export interface RangeSliderProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    labels: string[];
    valueLabel: string;
    disabled?: boolean;
    unit?: string;
}

export const RangeSlider: FC<RangeSliderProps> = ({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    labels,
    valueLabel,
    disabled = false,
    unit,
}) => {
    // Calculate percentage for gradient
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-5">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <label className="text-white text-base font-medium">{label}</label>
                    <span className="px-2 py-1 rounded bg-blue-600/20 text-blue-400 text-xs font-bold uppercase">
                        {valueLabel}{unit && ` ${unit}`}
                    </span>
                </div>
                <div className="relative h-10 flex items-center">
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        disabled={disabled}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-blue-500"
                        style={{
                            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #3f3f46 ${percentage}%, #3f3f46 100%)`,
                        }}
                    />
                </div>
                <div className="flex justify-between text-xs text-zinc-400 font-mono uppercase">
                    {labels.map((l, i) => (
                        <span key={i}>{l}</span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RangeSlider;
