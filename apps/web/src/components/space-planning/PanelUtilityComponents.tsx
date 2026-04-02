/**
 * PanelUtilityComponents.tsx
 * Small reusable components used across space planning panels
 */

export const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <div className="text-[10px] text-slate-400">{label}</div>
    <div className="text-xs font-medium tracking-wide text-soft">{value}</div>
  </div>
);

export const InfoMini: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-md bg-surface px-2 py-1.5 border border-border">
    <div className="text-[10px] text-dim">{label}</div>
    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{value}</div>
  </div>
);

export const SummaryCard: React.FC<{
  label: string;
  value: string;
  detail: string;
  color: string;
}> = ({ label, value, detail, color }) => (
  <div
    className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-lg px-3 py-2.5 border border-${color}-200 dark:border-${color}-800/30`}
  >
    <div className={`text-[10px] text-${color}-600 dark:text-${color}-400`}>{label}</div>
    <div className={`text-sm font-bold text-${color}-800 dark:text-${color}-300`}>{value}</div>
    <div className={`text-[10px] text-${color}-500 dark:text-${color}-400/70 capitalize`}>
      {detail}
    </div>
  </div>
);
