/**
 * AdvancedToggle - Professional toggle switch component
 * Used for settings, preferences, and feature toggles
 */

import { FC, ReactNode } from 'react';

export interface AdvancedToggleProps {
    label: string;
    description?: string;
    statusText?: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    icon?: ReactNode;
    disabled?: boolean;
}

export const AdvancedToggle: FC<AdvancedToggleProps> = ({
    label,
    description,
    statusText,
    enabled,
    onChange,
    icon,
    disabled = false,
}) => {
    return (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-700 bg-zinc-800 p-5 hover:border-zinc-600 transition-colors">
            <div className="flex items-start gap-4">
                {icon && (
                    <div className="p-3 rounded bg-zinc-700/30 text-white flex items-center justify-center shrink-0">
                        {icon}
                    </div>
                )}
                <div className="flex flex-col gap-1">
                    <p className="text-white text-base font-bold">{label}</p>
                    {description && (
                        <p className="text-zinc-400 text-sm">{description}</p>
                    )}
                    {statusText && (
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-zinc-500'}`} />
                            <span className="text-xs text-zinc-400">{statusText}</span>
                        </div>
                    )}
                </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    className="sr-only peer"
                />
                <div className={`
                    w-11 h-6 rounded-full transition-colors
                    ${enabled ? 'bg-blue-600' : 'bg-zinc-600'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 peer-focus:ring-offset-2 peer-focus:ring-offset-zinc-800
                    after:content-[''] after:absolute after:top-[2px] 
                    ${enabled ? 'after:right-[2px]' : 'after:left-[2px]'}
                    after:bg-white after:border-gray-300 after:border 
                    after:rounded-full after:h-5 after:w-5 after:transition-all
                `} />
            </label>
        </div>
    );
};

export default AdvancedToggle;
