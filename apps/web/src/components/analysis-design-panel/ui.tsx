import { FC } from 'react';

export const SummaryCard: FC<{ label: string; value: string | number; color: string; icon: string }> = ({
    label, value, color, icon
}) => {
    const colorClasses: Record<string, string> = {
        green: 'bg-green-500/10 text-green-400 border-green-500/30',
        red: 'bg-red-500/10 text-red-400 border-red-500/30',
        yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    };

    return (
        <div className={`rounded-lg p-3 border ${colorClasses[color]}`}>
            <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-[14px]">{icon}</span>
                <span className="text-[10px] uppercase font-medium tracking-wide opacity-70">{label}</span>
            </div>
            <p className="text-lg font-bold">{value}</p>
        </div>
    );
};

export const ForceValue: FC<{ label: string; value: number; unit: string }> = ({ label, value, unit }) => (
    <div className="bg-[#131b2e] rounded px-2 py-1">
        <p className="text-text-muted text-[10px]">{label}</p>
        <p className={`font-mono font-medium tracking-wide ${value < 0 ? 'text-blue-400' : 'text-[#dae2fd]'}`}>
            {value.toFixed(2)} <span className="text-text-muted text-[10px]">{unit}</span>
        </p>
    </div>
);

export const PropertyItem: FC<{ label: string; value: number; unit: string }> = ({ label, value, unit }) => (
    <div className="bg-[#131b2e] rounded px-2 py-1.5">
        <p className="text-text-muted text-[10px]">{label}</p>
        <p className="text-[#dae2fd] font-mono text-xs">
            {value > 1e5 ? value.toExponential(2) : value.toLocaleString()}
            <span className="text-text-muted text-[10px] ml-0.5">{unit}</span>
        </p>
    </div>
);

export const DesignCheckRow: FC<{ check: { checkType: string; ratio: number; status: string; details: string } }> = ({ check }) => {
    const statusColor = check.status === 'PASS' ? 'text-green-400' :
        check.status === 'FAIL' ? 'text-red-400' : 'text-yellow-400';

    return (
        <div className="flex items-center justify-between text-xs py-1 px-2 bg-slate-100/50 dark:bg-slate-800/50 rounded">
            <span className="text-text-muted">{check.checkType}</span>
            <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full ${check.ratio > 1 ? 'bg-red-500' : check.ratio > 0.9 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(check.ratio * 100, 100)}%` }}
                    />
                </div>
                <span className={`font-mono font-medium tracking-wide ${statusColor}`}>
                    {(check.ratio * 100).toFixed(0)}%
                </span>
            </div>
        </div>
    );
};

export const EmptyState: FC<{ message: string; icon: string }> = ({ message, icon }) => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <span className="material-symbols-outlined text-[48px] text-text-muted/50 mb-3">{icon}</span>
        <p className="text-text-muted">{message}</p>
    </div>
);
