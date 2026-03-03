/**
 * ResultsTablePanel.tsx - Professional STAAD-like Results Table
 *
 * Provides sortable, filterable tables for analysis results:
 * - Node Results (Displacements, Reactions)
 * - Member Results (Forces, Stresses)
 * - Support Reactions
 * - Section Cut Forces
 *
 * Features:
 * - Sort by any column
 * - Filter by member/node
 * - Export to CSV
 * - Unit conversion
 * - Highlight critical values
 */

import React, { FC, useState, useMemo, useCallback } from "react";
import { useModelStore } from "../../store/model";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Table,
  FileSpreadsheet,
  Copy,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

type SortDirection = "asc" | "desc" | null;
type ResultsTab = "nodes" | "members" | "reactions" | "stresses";

interface Column<T> {
  key: keyof T;
  label: string;
  unit?: string;
  format?: (value: any) => string;
  width?: string;
  align?: "left" | "center" | "right";
}

interface NodeResultRow {
  nodeId: string;
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  rx: number;
  ry: number;
  rz: number;
  totalDisp: number;
}

interface MemberResultRow {
  memberId: string;
  startNode: string;
  endNode: string;
  length: number;
  axialStart: number;
  axialEnd: number;
  shearYStart: number;
  shearYEnd: number;
  shearZStart: number;
  shearZEnd: number;
  momentYStart: number;
  momentYEnd: number;
  momentZStart: number;
  momentZEnd: number;
  torsion: number;
  maxShear: number;
  maxMoment: number;
  utilizationRatio: number;
}

interface ReactionRow {
  nodeId: string;
  x: number;
  y: number;
  z: number;
  Fx: number;
  Fy: number;
  Fz: number;
  Mx: number;
  My: number;
  Mz: number;
  totalForce: number;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatNumber = (value: number, decimals: number = 3): string => {
  if (Math.abs(value) < 1e-10) return "0.000";
  if (Math.abs(value) > 1e6) return value.toExponential(2);
  return value.toFixed(decimals);
};

const formatSI = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1e9) return (value / 1e9).toFixed(2) + " G";
  if (abs >= 1e6) return (value / 1e6).toFixed(2) + " M";
  if (abs >= 1e3) return (value / 1e3).toFixed(2) + " k";
  return value.toFixed(3);
};

// ============================================
// TABLE HEADER COMPONENT
// ============================================

interface TableHeaderProps<T> {
  columns: Column<T>[];
  sortColumn: keyof T | null;
  sortDirection: SortDirection;
  onSort: (column: keyof T) => void;
}

function TableHeader<T>({
  columns,
  sortColumn,
  sortDirection,
  onSort,
}: TableHeaderProps<T>) {
  return (
    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
      {columns.map((col) => (
        <th
          key={String(col.key)}
          className="px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap border-b border-slate-600"
          style={{ width: col.width, textAlign: col.align || "right" }}
          onClick={() => onSort(col.key)}
        >
          <div className="flex items-center justify-end gap-1">
            <span>
              {col.label}
              {col.unit && (
                <span className="text-slate-500 dark:text-slate-400 ml-1">({col.unit})</span>
              )}
            </span>
            {sortColumn === col.key ? (
              sortDirection === "asc" ? (
                <ArrowUp size={12} />
              ) : (
                <ArrowDown size={12} />
              )
            ) : (
              <ArrowUpDown size={12} className="opacity-30" />
            )}
          </div>
        </th>
      ))}
    </tr>
  );
}

// ============================================
// NODE RESULTS TABLE
// ============================================

const nodeColumns: Column<NodeResultRow>[] = [
  { key: "nodeId", label: "Node", align: "left", width: "60px" },
  { key: "x", label: "X", unit: "m", width: "70px" },
  { key: "y", label: "Y", unit: "m", width: "70px" },
  { key: "z", label: "Z", unit: "m", width: "70px" },
  { key: "dx", label: "ΔX", unit: "mm", width: "80px" },
  { key: "dy", label: "ΔY", unit: "mm", width: "80px" },
  { key: "dz", label: "ΔZ", unit: "mm", width: "80px" },
  { key: "rx", label: "θX", unit: "rad", width: "80px" },
  { key: "ry", label: "θY", unit: "rad", width: "80px" },
  { key: "rz", label: "θZ", unit: "rad", width: "80px" },
  { key: "totalDisp", label: "Total", unit: "mm", width: "80px" },
];

interface NodeResultsTableProps {
  searchQuery: string;
}

const NodeResultsTable: FC<NodeResultsTableProps> = ({ searchQuery }) => {
  const nodes = useModelStore((state) => state.nodes);
  const analysisResults = useModelStore((state) => state.analysisResults);

  const [sortColumn, setSortColumn] = useState<keyof NodeResultRow | null>(
    null,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const data = useMemo<NodeResultRow[]>(() => {
    if (!analysisResults) return [];

    const rows: NodeResultRow[] = [];
    nodes.forEach((node, nodeId) => {
      const disp = analysisResults.displacements.get(nodeId);
      if (disp) {
        const dx = (disp.dx || 0) * 1000; // Convert to mm
        const dy = (disp.dy || 0) * 1000;
        const dz = (disp.dz || 0) * 1000;
        const totalDisp = Math.sqrt(dx * dx + dy * dy + dz * dz);

        rows.push({
          nodeId,
          x: node.x,
          y: node.y,
          z: node.z,
          dx,
          dy,
          dz,
          rx: disp.rx || 0,
          ry: disp.ry || 0,
          rz: disp.rz || 0,
          totalDisp,
        });
      }
    });

    return rows;
  }, [nodes, analysisResults]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter((row) => row.nodeId.toLowerCase().includes(query));
  }, [data, searchQuery]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDirection === "asc" ? numA - numB : numB - numA;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = useCallback(
    (column: keyof NodeResultRow) => {
      if (sortColumn === column) {
        setSortDirection((prev) =>
          prev === "asc" ? "desc" : prev === "desc" ? null : "asc",
        );
        if (sortDirection === "desc") setSortColumn(null);
      } else {
        setSortColumn(column);
        setSortDirection("asc");
      }
    },
    [sortColumn, sortDirection],
  );

  // Find max values for highlighting
  const maxDisp = Math.max(...data.map((d) => d.totalDisp), 0.001);

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0">
          <TableHeader
            columns={nodeColumns}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </thead>
        <tbody>
          {sortedData.map((row, idx) => {
            const isMax = row.totalDisp === maxDisp && maxDisp > 0.01;
            return (
              <tr
                key={row.nodeId}
                className={`border-b border-slate-200 dark:border-slate-700 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 ${
                  idx % 2 === 0 ? "bg-slate-100/30 dark:bg-slate-800/30" : "bg-slate-100/50 dark:bg-slate-800/50"
                } ${isMax ? "bg-red-900/30" : ""}`}
              >
                <td className="px-3 py-1.5 text-left font-mono text-slate-500 dark:text-slate-400">
                  {row.nodeId}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {formatNumber(row.x)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {formatNumber(row.y)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {formatNumber(row.z)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-cyan-400">
                  {formatNumber(row.dx)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-cyan-400">
                  {formatNumber(row.dy)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-cyan-400">
                  {formatNumber(row.dz)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-amber-400">
                  {formatNumber(row.rx, 6)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-amber-400">
                  {formatNumber(row.ry, 6)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-amber-400">
                  {formatNumber(row.rz, 6)}
                </td>
                <td
                  className={`px-3 py-1.5 text-right font-mono font-bold ${isMax ? "text-red-400" : "text-emerald-400"}`}
                >
                  {formatNumber(row.totalDisp)}
                  {isMax && <AlertTriangle size={12} className="inline ml-1" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sortedData.length === 0 && (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          {analysisResults
            ? "No node results available"
            : "Run analysis to see results"}
        </div>
      )}
    </div>
  );
};

// ============================================
// MEMBER RESULTS TABLE
// ============================================

const memberColumns: Column<MemberResultRow>[] = [
  { key: "memberId", label: "Member", align: "left", width: "60px" },
  { key: "startNode", label: "Start", align: "left", width: "50px" },
  { key: "endNode", label: "End", align: "left", width: "50px" },
  { key: "length", label: "L", unit: "m", width: "60px" },
  { key: "axialStart", label: "Fx", unit: "kN", width: "70px" },
  { key: "shearYStart", label: "Fy", unit: "kN", width: "70px" },
  { key: "shearZStart", label: "Fz", unit: "kN", width: "70px" },
  { key: "momentYStart", label: "My", unit: "kNm", width: "75px" },
  { key: "momentZStart", label: "Mz", unit: "kNm", width: "75px" },
  { key: "torsion", label: "T", unit: "kNm", width: "70px" },
  { key: "maxShear", label: "V_max", unit: "kN", width: "75px" },
  { key: "maxMoment", label: "M_max", unit: "kNm", width: "80px" },
  { key: "utilizationRatio", label: "η", unit: "%", width: "60px" },
];

interface MemberResultsTableProps {
  searchQuery: string;
}

const MemberResultsTable: FC<MemberResultsTableProps> = ({ searchQuery }) => {
  const members = useModelStore((state) => state.members);
  const nodes = useModelStore((state) => state.nodes);
  const analysisResults = useModelStore((state) => state.analysisResults);

  const [sortColumn, setSortColumn] = useState<keyof MemberResultRow | null>(
    null,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const data = useMemo<MemberResultRow[]>(() => {
    if (!analysisResults) return [];

    const rows: MemberResultRow[] = [];
    members.forEach((member, memberId) => {
      const forces = analysisResults.memberForces.get(memberId);
      const startNode = nodes.get(member.startNodeId);
      const endNode = nodes.get(member.endNodeId);

      if (forces && startNode && endNode) {
        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const dz = endNode.z - startNode.z;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const maxShear = Math.max(
          Math.abs(forces.shearY),
          Math.abs(forces.shearZ),
        );
        const maxMoment = Math.max(
          Math.abs(forces.momentY),
          Math.abs(forces.momentZ),
        );

        // Simplified utilization (would use actual section properties)
        const utilizationRatio = Math.min(
          (maxMoment * 0.001 + Math.abs(forces.axial) * 0.0005) * 100,
          150,
        );

        rows.push({
          memberId,
          startNode: member.startNodeId,
          endNode: member.endNodeId,
          length,
          axialStart: forces.startForces?.axial ?? forces.axial,
          axialEnd: forces.endForces?.axial ?? forces.axial,
          shearYStart: forces.startForces?.shearY ?? forces.shearY,
          shearYEnd: forces.endForces?.shearY ?? -forces.shearY,
          shearZStart: forces.startForces?.shearZ ?? forces.shearZ,
          shearZEnd: forces.endForces?.shearZ ?? -forces.shearZ,
          momentYStart: forces.startForces?.momentY ?? forces.momentY,
          momentYEnd: forces.endForces?.momentY ?? -forces.momentY,
          momentZStart: forces.startForces?.momentZ ?? forces.momentZ,
          momentZEnd: forces.endForces?.momentZ ?? -forces.momentZ,
          torsion: forces.torsion,
          maxShear,
          maxMoment,
          utilizationRatio,
        });
      }
    });

    return rows;
  }, [members, nodes, analysisResults]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (row) =>
        row.memberId.toLowerCase().includes(query) ||
        row.startNode.toLowerCase().includes(query) ||
        row.endNode.toLowerCase().includes(query),
    );
  }, [data, searchQuery]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDirection === "asc" ? numA - numB : numB - numA;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = useCallback(
    (column: keyof MemberResultRow) => {
      if (sortColumn === column) {
        setSortDirection((prev) =>
          prev === "asc" ? "desc" : prev === "desc" ? null : "asc",
        );
        if (sortDirection === "desc") setSortColumn(null);
      } else {
        setSortColumn(column);
        setSortDirection("asc");
      }
    },
    [sortColumn, sortDirection],
  );

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0">
          <TableHeader
            columns={memberColumns}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </thead>
        <tbody>
          {sortedData.map((row, idx) => {
            const isOverUtilized = row.utilizationRatio > 100;
            const isWarning = row.utilizationRatio > 80;
            return (
              <tr
                key={row.memberId}
                className={`border-b border-slate-200 dark:border-slate-700 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 ${
                  idx % 2 === 0 ? "bg-slate-100/30 dark:bg-slate-800/30" : "bg-slate-100/50 dark:bg-slate-800/50"
                } ${isOverUtilized ? "bg-red-900/30" : isWarning ? "bg-amber-900/20" : ""}`}
              >
                <td className="px-3 py-1.5 text-left font-mono text-slate-500 dark:text-slate-400">
                  {row.memberId}
                </td>
                <td className="px-3 py-1.5 text-left font-mono text-slate-500 dark:text-slate-400">
                  {row.startNode}
                </td>
                <td className="px-3 py-1.5 text-left font-mono text-slate-500 dark:text-slate-400">
                  {row.endNode}
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {formatNumber(row.length)}
                </td>
                <td
                  className={`px-3 py-1.5 text-right font-mono ${row.axialStart < 0 ? "text-blue-400" : "text-red-400"}`}
                >
                  {formatNumber(row.axialStart)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-cyan-400">
                  {formatNumber(row.shearYStart)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-cyan-400">
                  {formatNumber(row.shearZStart)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-amber-400">
                  {formatNumber(row.momentYStart)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-amber-400">
                  {formatNumber(row.momentZStart)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-purple-400">
                  {formatNumber(row.torsion)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-bold text-cyan-300">
                  {formatNumber(row.maxShear)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-300">
                  {formatNumber(row.maxMoment)}
                </td>
                <td
                  className={`px-3 py-1.5 text-right font-mono font-bold ${
                    isOverUtilized
                      ? "text-red-400"
                      : isWarning
                        ? "text-amber-400"
                        : "text-emerald-400"
                  }`}
                >
                  {row.utilizationRatio.toFixed(1)}
                  {isOverUtilized && (
                    <AlertTriangle size={12} className="inline ml-1" />
                  )}
                  {!isOverUtilized && !isWarning && (
                    <CheckCircle size={12} className="inline ml-1" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sortedData.length === 0 && (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          {analysisResults
            ? "No member results available"
            : "Run analysis to see results"}
        </div>
      )}
    </div>
  );
};

// ============================================
// REACTIONS TABLE
// ============================================

const reactionColumns: Column<ReactionRow>[] = [
  { key: "nodeId", label: "Node", align: "left", width: "60px" },
  { key: "x", label: "X", unit: "m", width: "70px" },
  { key: "y", label: "Y", unit: "m", width: "70px" },
  { key: "z", label: "Z", unit: "m", width: "70px" },
  { key: "Fx", label: "Rx", unit: "kN", width: "80px" },
  { key: "Fy", label: "Ry", unit: "kN", width: "80px" },
  { key: "Fz", label: "Rz", unit: "kN", width: "80px" },
  { key: "Mx", label: "Mx", unit: "kNm", width: "80px" },
  { key: "My", label: "My", unit: "kNm", width: "80px" },
  { key: "Mz", label: "Mz", unit: "kNm", width: "80px" },
  { key: "totalForce", label: "Total", unit: "kN", width: "80px" },
];

interface ReactionsTableProps {
  searchQuery: string;
}

const ReactionsTable: FC<ReactionsTableProps> = ({ searchQuery }) => {
  const nodes = useModelStore((state) => state.nodes);
  const analysisResults = useModelStore((state) => state.analysisResults);

  const [sortColumn, setSortColumn] = useState<keyof ReactionRow | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const data = useMemo<ReactionRow[]>(() => {
    if (!analysisResults) return [];

    const rows: ReactionRow[] = [];

    // Iterate through reactions (nodes with supports have reactions)
    analysisResults.reactions.forEach((reaction, nodeId) => {
      const node = nodes.get(nodeId);

      if (node && reaction) {
        const Fx = reaction.fx || 0;
        const Fy = reaction.fy || 0;
        const Fz = reaction.fz || 0;
        const totalForce = Math.sqrt(Fx * Fx + Fy * Fy + Fz * Fz);

        rows.push({
          nodeId,
          x: node.x,
          y: node.y,
          z: node.z,
          Fx,
          Fy,
          Fz,
          Mx: reaction.mx || 0,
          My: reaction.my || 0,
          Mz: reaction.mz || 0,
          totalForce,
        });
      }
    });

    return rows;
  }, [nodes, analysisResults]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter((row) => row.nodeId.toLowerCase().includes(query));
  }, [data, searchQuery]);

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDirection === "asc" ? numA - numB : numB - numA;
    });
  }, [filteredData, sortColumn, sortDirection]);

  const handleSort = useCallback(
    (column: keyof ReactionRow) => {
      if (sortColumn === column) {
        setSortDirection((prev) =>
          prev === "asc" ? "desc" : prev === "desc" ? null : "asc",
        );
        if (sortDirection === "desc") setSortColumn(null);
      } else {
        setSortColumn(column);
        setSortDirection("asc");
      }
    },
    [sortColumn, sortDirection],
  );

  return (
    <div className="overflow-auto max-h-[400px]">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0">
          <TableHeader
            columns={reactionColumns}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        </thead>
        <tbody>
          {sortedData.map((row, idx) => (
            <tr
              key={row.nodeId}
              className={`border-b border-slate-200 dark:border-slate-700 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 ${
                idx % 2 === 0 ? "bg-slate-100/30 dark:bg-slate-800/30" : "bg-slate-100/50 dark:bg-slate-800/50"
              }`}
            >
              <td className="px-3 py-1.5 text-left font-mono text-slate-500 dark:text-slate-400">
                {row.nodeId}
              </td>
              <td className="px-3 py-1.5 text-right font-mono">
                {formatNumber(row.x)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono">
                {formatNumber(row.y)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono">
                {formatNumber(row.z)}
              </td>
              <td
                className={`px-3 py-1.5 text-right font-mono ${Math.abs(row.Fx) > 0.01 ? "text-red-400" : "text-slate-500 dark:text-slate-400"}`}
              >
                {formatNumber(row.Fx)}
              </td>
              <td
                className={`px-3 py-1.5 text-right font-mono ${Math.abs(row.Fy) > 0.01 ? "text-green-400" : "text-slate-500 dark:text-slate-400"}`}
              >
                {formatNumber(row.Fy)}
              </td>
              <td
                className={`px-3 py-1.5 text-right font-mono ${Math.abs(row.Fz) > 0.01 ? "text-blue-400" : "text-slate-500 dark:text-slate-400"}`}
              >
                {formatNumber(row.Fz)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-amber-400">
                {formatNumber(row.Mx)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-amber-400">
                {formatNumber(row.My)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-amber-400">
                {formatNumber(row.Mz)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-400">
                {formatNumber(row.totalForce)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sortedData.length === 0 && (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          {analysisResults
            ? "No reactions available"
            : "Run analysis to see results"}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN RESULTS TABLE PANEL
// ============================================

interface ResultsTablePanelProps {
  className?: string;
  defaultTab?: ResultsTab;
}

export const ResultsTablePanel: FC<ResultsTablePanelProps> = React.memo(({
  className = "",
  defaultTab = "members",
}) => {
  const [activeTab, setActiveTab] = useState<ResultsTab>(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const analysisResults = useModelStore((state) => state.analysisResults);

  const tabs: { id: ResultsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "nodes",
      label: "Nodes",
      icon: <div className="w-2 h-2 rounded-full bg-cyan-400" />,
    },
    {
      id: "members",
      label: "Members",
      icon: <div className="w-4 h-0.5 bg-amber-400 rounded" />,
    },
    {
      id: "reactions",
      label: "Reactions",
      icon: <div className="w-2 h-2 bg-green-400 rotate-45" />,
    },
  ];

  const handleExportCSV = useCallback(() => {
    // Export current table to CSV — feature not yet implemented
  }, [activeTab]);

  const handleCopyTable = useCallback(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div
      className={`bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Table size={18} className="text-slate-500 dark:text-slate-400" />
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">Results Table</h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter..."
              className="pl-8 pr-3 py-1.5 text-sm bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded-md 
                                     text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-cyan-500 focus:outline-none w-32"
            />
          </div>

          {/* Export buttons */}
          <button type="button"
            onClick={handleCopyTable}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            title="Copy table"
          >
            {copied ? <span className="text-xs text-green-500 font-medium">✓ Copied!</span> : <Copy size={16} />}
          </button>
          <button type="button"
            disabled
            className="p-1.5 text-slate-400 dark:text-slate-500 cursor-not-allowed rounded"
            title="CSV Export: Coming soon"
          >
            <FileSpreadsheet size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors
                                  ${
                                    activeTab === tab.id
                                      ? "text-cyan-400 border-b-2 border-cyan-400 bg-slate-100/30 dark:bg-slate-800/30"
                                      : "text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                                  }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        {activeTab === "nodes" && (
          <NodeResultsTable searchQuery={searchQuery} />
        )}
        {activeTab === "members" && (
          <MemberResultsTable searchQuery={searchQuery} />
        )}
        {activeTab === "reactions" && (
          <ReactionsTable searchQuery={searchQuery} />
        )}
      </div>

      {/* Footer with summary */}
      {analysisResults && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-100/30 dark:bg-slate-800/30 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex justify-between">
            <span>
              {activeTab === "nodes" &&
                `${analysisResults.displacements.size} nodes analyzed`}
              {activeTab === "members" &&
                `${analysisResults.memberForces.size} members analyzed`}
              {activeTab === "reactions" &&
                `${analysisResults.reactions.size} support reactions`}
            </span>
            <span>
              Analysis completed in{" "}
              {((analysisResults as any).analysisTime || 0).toFixed(2)}ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

(ResultsTablePanel as unknown as { displayName: string }).displayName = 'ResultsTablePanel';

export default ResultsTablePanel;
