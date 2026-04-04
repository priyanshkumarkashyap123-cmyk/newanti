/**
 * FieldLabel — Label with engineering tooltip
 * Wraps a form label with an info icon that shows a contextual tooltip
 * explaining the engineering parameter and its code reference.
 */

import { FC } from 'react';
import { Info } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { engineeringTooltips } from '@/data/engineeringTooltips';

interface FieldLabelProps {
  /** Key from engineeringTooltips map */
  field: string;
  /** Override display label (defaults to tooltip label) */
  label?: string;
  className?: string;
}

export const FieldLabel: FC<FieldLabelProps> = ({ field, label, className = '' }) => {
  const tip = engineeringTooltips[field];
  const displayLabel = label || tip?.label || field;

  if (!tip) {
    return <span className={className}>{displayLabel}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {displayLabel}
      <Tooltip
        content={tip.description}
        description={tip.clause}
        side="right"
        delay={300}
      >
        <Info className="w-3.5 h-3.5 text-slate-400 hover:text-blue-400 cursor-help shrink-0" />
      </Tooltip>
    </span>
  );
};
