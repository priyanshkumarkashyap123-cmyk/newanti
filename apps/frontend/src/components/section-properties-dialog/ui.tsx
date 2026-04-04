import { FC } from 'react';
import { Button } from '../ui/button';
import type { InputMode, MaterialType } from './helpers';

interface PropertyCardProps {
    label: string;
    value: number;
    unit: string;
    scientific?: boolean;
    small?: boolean;
}

export const PropertyCard: FC<PropertyCardProps> = ({ label, value, unit, scientific, small }) => {
    const formattedValue = scientific
        ? value.toExponential(2)
        : value.toLocaleString(undefined, { maximumFractionDigits: 2 });

    return (
        <div className={`bg-[#131b2e] rounded-lg ${small ? 'p-2' : 'p-3'}`}>
            <p className={`text-[#869ab8] ${small ? 'text-[10px]' : 'text-xs'} mb-0.5`}>{label}</p>
            <p className={`text-[#dae2fd] font-mono ${small ? 'text-xs' : 'text-sm'} font-medium tracking-wide`}>
                {formattedValue} <span className="text-[#869ab8] text-[10px]">{unit}</span>
            </p>
        </div>
    );
};

interface ModeTabButtonProps {
    tab: InputMode;
    activeTab: InputMode;
    icon: string;
    label: string;
    onSelect: (tab: InputMode) => void;
}

export const ModeTabButton: FC<ModeTabButtonProps> = ({ tab, activeTab, icon, label, onSelect }) => {
    return (
        <Button
            variant="ghost"
            onClick={() => onSelect(tab)}
            className={`flex-1 px-4 py-3 text-sm font-medium tracking-wide rounded-none transition-colors ${activeTab === tab
                    ? 'bg-primary/10 text-primary border-b-2 border-primary'
                    : 'text-[#869ab8] hover:text-slate-900 dark:hover:text-white'
                }`}
        >
            <span className="material-symbols-outlined text-[16px] mr-1 align-middle">{icon}</span>
            {label}
        </Button>
    );
};

interface MaterialTypeButtonProps {
    type: MaterialType;
    selectedType: MaterialType;
    onSelect: (type: MaterialType) => void;
}

export const MaterialTypeButton: FC<MaterialTypeButtonProps> = ({ type, selectedType, onSelect }) => {
    return (
        <Button
            variant={selectedType === type ? 'default' : 'secondary'}
            onClick={() => onSelect(type)}
            className={`flex-1 py-2 text-xs font-medium tracking-wide rounded-lg transition-all ${selectedType === type
                    ? 'bg-primary text-[#dae2fd]'
                    : 'bg-[#131b2e] text-[#869ab8] hover:text-slate-900 dark:hover:text-white'
                }`}
        >
            {type.charAt(0).toUpperCase() + type.slice(1)}
        </Button>
    );
};
