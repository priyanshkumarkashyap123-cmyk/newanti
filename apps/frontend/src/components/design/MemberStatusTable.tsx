/**
 * MemberStatusTable — Sortable table of member design results
 * Feature: space-planning-accuracy-and-tools
 * Requirements: 10.1, 10.2, 10.3
 */
import React from 'react';
import type { MemberDesignResult } from '../../pages/DetailingDesignPage';

interface MemberStatusTableProps {
  results: MemberDesignResult[];
  selectedMemberId: string | null;
  onMemberClick: (memberId: string) => void;
  sortBy?: 'memberId' | 'memberType' | 'sectionId' | 'utilizationRatio' | 'status';
  sortDir?: 'asc' | 'desc';
}

function getRowBg(result: MemberDesignResult): string {
  if (result.status === 'skipped') return '#374151'; // grey
  if (result.utilizationRatio > 1.0) return '#7f1d1d'; // red
  if (result.utilizationRatio >= 0.85) return '#78350f'; // amber
  return '#14532d'; // green
}

function getRowBgHover(result: MemberDesignResult): string {
  if (result.status === 'skipped') return '#4b5563';
  if (result.utilizationRatio > 1.0) return '#991b1b';
  if (result.utilizationRatio >= 0.85) return '#92400e';
  return '#166534';
}

type SortKey = NonNullable<MemberStatusTableProps['sortBy']>;

function sortResults(
  results: MemberDesignResult[],
  sortBy: SortKey,
  sortDir: 'asc' | 'desc'
): MemberDesignResult[] {
  const sorted = [...results].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'utilizationRatio') {
      cmp = a.utilizationRatio - b.utilizationRatio;
    } else {
      const av = a[sortBy] as string;
      const bv = b[sortBy] as string;
      cmp = av.localeCompare(bv);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

const STATUS_LABEL: Record<MemberDesignResult['status'], string> = {
  pass: 'Pass',
  fail: 'Fail',
  skipped: 'Skipped',
};

export const MemberStatusTable: React.FC<MemberStatusTableProps> = ({
  results,
  selectedMemberId,
  onMemberClick,
  sortBy = 'memberId',
  sortDir = 'asc',
}) => {
  if (results.length === 0) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '0.875rem',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
          background: '#1e293b',
        }}
      >
        No design results yet
      </div>
    );
  }

  const sorted = sortResults(results, sortBy, sortDir);

  return (
    <div style={{ overflowX: 'auto', borderRadius: '0.5rem', border: '1px solid #334155' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.8125rem',
          background: '#1e293b',
        }}
        aria-label="Member design results"
      >
        <thead>
          <tr style={{ background: '#0f172a', color: '#94a3b8' }}>
            <th style={thStyle}>Member ID</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Section</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Utilization (%)</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const isSelected = r.memberId === selectedMemberId;
            const bg = getRowBg(r);
            const hoverBg = getRowBgHover(r);
            return (
              <tr
                key={r.memberId}
                onClick={() => onMemberClick(r.memberId)}
                style={{
                  background: bg,
                  cursor: 'pointer',
                  outline: isSelected ? '2px solid #60a5fa' : 'none',
                  outlineOffset: '-2px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = hoverBg;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = bg;
                }}
                aria-selected={isSelected}
              >
                <td style={tdStyle}>{r.memberId}</td>
                <td style={tdStyle}>{r.memberType}</td>
                <td style={tdStyle}>{r.sectionId}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {r.status === 'skipped' ? '—' : `${(r.utilizationRatio * 100).toFixed(1)}%`}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: statusBadgeBg(r),
                      color: '#fff',
                    }}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

function statusBadgeBg(r: MemberDesignResult): string {
  if (r.status === 'skipped') return '#6b7280';
  if (r.status === 'fail') return '#dc2626';
  return '#16a34a';
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid #334155',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderBottom: '1px solid rgba(51,65,85,0.5)',
  color: '#e2e8f0',
  whiteSpace: 'nowrap',
};

export default MemberStatusTable;
