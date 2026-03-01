/**
 * PropertiesPanel - Right sidebar for member/node properties
 * Displays and allows editing of element properties with accordion sections
 */

import { FC, ReactNode } from 'react';
import * as Accordion from '@radix-ui/react-accordion';

export interface PropertySection {
    id: string;
    title: string;
    badge?: string;
    content: ReactNode;
    defaultOpen?: boolean;
}

export interface PropertiesPanelProps {
    sections: PropertySection[];
    title?: string;
    actions?: ReactNode;
}

export const PropertiesPanel: FC<PropertiesPanelProps> = ({
    sections,
    title = 'Properties',
    actions,
}) => {
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">{title}</h3>
                {actions}
            </div>

            {/* Scrollable Content */}
            <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
                <Accordion.Root
                    type="multiple"
                    defaultValue={sections.filter(s => s.defaultOpen).map(s => s.id)}
                    className="flex flex-col gap-2"
                >
                    {sections.map((section) => (
                        <Accordion.Item
                            key={section.id}
                            value={section.id}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50 overflow-hidden"
                        >
                            <Accordion.Header>
                                <Accordion.Trigger className="flex items-center justify-between cursor-pointer py-2 px-3 hover:bg-slate-700/30 w-full text-left select-none group">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{section.title}</span>
                                        {section.badge && (
                                            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                                                {section.badge}
                                            </span>
                                        )}
                                    </div>
                                    <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-[18px] transition-transform group-data-[state=open]:rotate-180">
                                        expand_more
                                    </span>
                                </Accordion.Trigger>
                            </Accordion.Header>
                            <Accordion.Content className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
                                <div className="p-3 pt-0">
                                    {section.content}
                                </div>
                            </Accordion.Content>
                        </Accordion.Item>
                    ))}
                </Accordion.Root>
            </div>

            {/* Footer Actions (if needed) */}
            {actions && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    {actions}
                </div>
            )}
        </div>
    );
};

export default PropertiesPanel;
