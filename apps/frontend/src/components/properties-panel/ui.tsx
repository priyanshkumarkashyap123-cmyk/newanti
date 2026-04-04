import React, { FC, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export const PanelSection: FC<{
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    accentColor?: string;
}> = ({ icon, label, children, defaultOpen = true, accentColor }) => {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="flex flex-col">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 py-1 text-left group"
            >
                {open ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
                <span className="w-3.5 h-3.5 flex-shrink-0" style={accentColor ? { color: accentColor } : undefined}>{icon}</span>
                <span className="text-xs font-medium tracking-wide text-slate-600 group-hover:text-[#dae2fd] transition-colors">{label}</span>
            </button>
            {open && <div className="pl-5 flex flex-col gap-1.5 mt-1">{children}</div>}
        </div>
    );
};

export const InfoRow: FC<{ label: string; value: string; color?: string; borderColor?: string }> = ({ label, value, color, borderColor }) => (
    <div className={`flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/50 px-1.5 py-1 rounded text-[11px] font-mono ${borderColor ? `border-l-2 ${borderColor}` : ''}`}>
        <span className="text-slate-500">{label}</span>
        <span className={`font-semibold ${color ?? 'text-slate-600 dark:text-slate-300'}`}>{value}</span>
    </div>
);

export const DofToggle: FC<{ label: string; sub: string; active: boolean; onChange: (v: boolean) => void }> = ({ label, sub, active, onChange }) => (
    <label className={`flex flex-col items-center py-1.5 px-1 rounded cursor-pointer border-2 transition-all select-none
        ${active ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#1a2333] bg-[#131b2e] hover:border-slate-300 dark:hover:border-slate-600'}`}>
        <input type="checkbox" checked={active} onChange={(e) => onChange(e.target.checked)} className="hidden" />
        <span className={`text-[10px] font-semibold ${active ? 'text-emerald-400' : 'text-slate-500'}`}>{label}</span>
        <span className="text-[8px] text-slate-600">{sub}</span>
    </label>
);

export const PresetBtn: FC<{ label: string; active: boolean; onClick: () => void; title?: string }> = ({ label, active, onClick, title }) => (
    <button
        type="button"
        onClick={onClick}
        title={title}
        className={`flex-1 py-1 px-2 rounded text-[10px] font-medium tracking-wide transition-all
            ${active ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
    >
        {label}
    </button>
);

export const PanelSelect: FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select
        {...props}
        className={`mt-1 bg-[#131b2e] border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-50 px-2 py-1.5 rounded text-xs w-full
                   cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors ${props.className ?? ''}`}
    />
);

export const Divider: FC = () => <hr className="border-slate-200/60 dark:border-slate-700/60 my-1.5" />;
