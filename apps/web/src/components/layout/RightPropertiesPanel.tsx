/**
 * PropertiesPanel - Right-side Properties Editor
 * 
 * Context-sensitive panel showing selected element properties.
 */

import React from 'react';
import { FC } from 'react';
import { Settings, Layers, Box, ArrowDown, Info } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface PropertyItem {
    label: string;
    value: string | number;
    unit?: string;
    editable?: boolean;
}

interface PropertyGroup {
    title: string;
    icon: React.ElementType;
    properties: PropertyItem[];
}

interface PropertiesPanelProps {
    selectedType?: 'node' | 'member' | 'load' | null;
    selectedId?: string;
    propertyGroups?: PropertyGroup[];
}

// ============================================
// DEFAULT GROUPS (for demo)
// ============================================

const DEFAULT_GROUPS: PropertyGroup[] = [
    {
        title: 'Selection',
        icon: Info,
        properties: [
            { label: 'Type', value: 'None' },
            { label: 'ID', value: '-' }
        ]
    },
    {
        title: 'Transform',
        icon: Box,
        properties: [
            { label: 'X', value: 0, unit: 'm', editable: true },
            { label: 'Y', value: 0, unit: 'm', editable: true },
            { label: 'Z', value: 0, unit: 'm', editable: true }
        ]
    }
];

const MEMBER_GROUPS: PropertyGroup[] = [
    {
        title: 'Member',
        icon: Box,
        properties: [
            { label: 'ID', value: 'M001' },
            { label: 'Start Node', value: 'N001' },
            { label: 'End Node', value: 'N002' },
            { label: 'Length', value: 5.0, unit: 'm' }
        ]
    },
    {
        title: 'Section',
        icon: Layers,
        properties: [
            { label: 'Section', value: 'ISMB 300', editable: true },
            { label: 'Material', value: 'Steel Fe 250', editable: true },
            { label: 'Area', value: 56.26, unit: 'cm²' },
            { label: 'Ix', value: 8600, unit: 'cm⁴' }
        ]
    }
];

// ============================================
// COMPONENT
// ============================================

export const RightPropertiesPanel: FC<PropertiesPanelProps> = ({
    selectedType,
    selectedId,
    propertyGroups
}) => {
    const groups = propertyGroups || (selectedType === 'member' ? MEMBER_GROUPS : DEFAULT_GROUPS);

    return (
        <div className="h-full flex flex-col bg-[#0b1326] border-l border-[#1a2333]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#1a2333] flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#869ab8]" />
                <h2 className="text-sm font-semibold text-[#adc6ff]">
                    Properties
                </h2>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
                {groups.map((group, idx) => {
                    const Icon = group.icon;

                    return (
                        <div key={idx} className="border-b border-slate-100 dark:border-slate-800">
                            {/* Group Header */}
                            <div className="px-4 py-2 bg-[#131b2e] flex items-center gap-2">
                                <Icon className="w-3.5 h-3.5 text-[#869ab8]" />
                                <span className="text-xs font-semibold text-[#869ab8] uppercase tracking-wider">
                                    {group.title}
                                </span>
                            </div>

                            {/* Properties */}
                            <div className="px-4 py-2">
                                {group.properties.map((prop, propIdx) => (
                                    <div key={propIdx} className="flex items-center justify-between py-1.5">
                                        <span className="text-xs text-[#869ab8]">
                                            {prop.label}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {prop.editable ? (
                                                <input
                                                    type="text"
                                                    defaultValue={prop.value}
                                                    className="w-20 px-2 py-0.5 text-xs text-right bg-[#131b2e] border border-[#1a2333] rounded text-[#adc6ff] focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                                                />
                                            ) : (
                                                <span className="text-xs font-medium tracking-wide tracking-wide text-[#adc6ff]">
                                                    {prop.value}
                                                </span>
                                            )}
                                            {prop.unit && (
                                                <span className="text-[10px] text-[#869ab8]">
                                                    {prop.unit}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RightPropertiesPanel;
