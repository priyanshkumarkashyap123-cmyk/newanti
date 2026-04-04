/**
 * ClauseReference — Inline code clause reference link
 * Shows the clause number with a tooltip containing the full title, summary, and formula.
 * Used in design result cards to link checks back to their code basis.
 */

import { FC, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { codeClauses, type CodeClause } from '@/data/codeClauses';
import { Tooltip } from './Tooltip';

interface ClauseRefProps {
  /** Key in codeClauses map, e.g. 'IS456_38.1' */
  clauseKey: string;
  /** Override display text (defaults to "Code Cl. X.Y") */
  label?: string;
}

export const ClauseReference: FC<ClauseRefProps> = ({ clauseKey, label }) => {
  const clause = codeClauses[clauseKey];
  if (!clause) return null;

  const displayText = label || `${clause.code} ${clause.clause}`;
  const tooltipContent = `${clause.title}${clause.formula ? ` — ${clause.formula}` : ''}`;

  return (
    <Tooltip
      content={tooltipContent}
      description={clause.summary}
      side="top"
      delay={200}
    >
      <span className="inline-flex items-center gap-1 text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 cursor-help transition-colors">
        <BookOpen className="w-3 h-3" />
        {displayText}
      </span>
    </Tooltip>
  );
};

/**
 * ClauseTag — Compact clause badge for use in result check lists.
 * Shows just the clause number as a small badge.
 */
export const ClauseTag: FC<{ clauseKey: string }> = ({ clauseKey }) => {
  const clause = codeClauses[clauseKey];
  if (!clause) return null;

  return (
    <ClauseReference clauseKey={clauseKey} label={clause.clause} />
  );
};
