import type jsPDF from 'jspdf';

import { THEME } from '../reportTheme';
import type { ReactionRow } from '../reportTypes';

export interface FreeBodyState {
  doc: jsPDF;
  margin: number;
  pageWidth: number;
  contentTop: number;
  tableCount: number;
}

export interface FreeBodyCallbacks {
  addPage: (title?: string) => void;
  addSectionHeading: (text: string) => void;
  syncYAfterTable: (fallbackGap?: number) => void;
  ensureSpace: (neededMM: number, headerTitle?: string) => void;
  addResultsTable: (title: string, headers: string[], data: (string | number)[][]) => void;
}

export function addFreeBodyDiagram(
  state: FreeBodyState,
  callbacks: Pick<FreeBodyCallbacks, 'addPage' | 'addSectionHeading' | 'syncYAfterTable' | 'ensureSpace'>,
  nodes: Array<{ id: string; x: number; y: number; z: number }>,
  members: Array<{ id: string; startNodeId: string; endNodeId: string }>,
  loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>,
  reactions: Array<{
    nodeId: string;
    fx: number;
    fy: number;
    fz?: number;
    mx?: number;
    my?: number;
    mz?: number;
  }>,
  supports: Array<{ nodeId: string; type: 'fixed' | 'pinned' | 'roller' }>,
): void {
  callbacks.addPage('Free Body Diagram');
  callbacks.addSectionHeading('Structural Free Body Diagram (FBD)');

  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const canvasWidth = state.pageWidth - 2 * state.margin;
  const canvasHeight = 120;
  const padding = 30;
  const drawWidth = canvasWidth - 2 * padding;
  const drawHeight = canvasHeight - 2 * padding;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth * 3.78;
  canvas.height = canvasHeight * 3.78;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const scale = 3.78;
  const pxPadding = padding * scale;
  const pxDrawWidth = drawWidth * scale;
  const pxDrawHeight = drawHeight * scale;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const toCanvasX = (x: number) => pxPadding + ((x - minX) / rangeX) * pxDrawWidth;
  const toCanvasY = (y: number) => canvas.height - pxPadding - ((y - minY) / rangeY) * pxDrawHeight;

  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const x = pxPadding + (pxDrawWidth / 10) * i;
    const y = pxPadding + (pxDrawHeight / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, pxPadding);
    ctx.lineTo(x, canvas.height - pxPadding);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pxPadding, y);
    ctx.lineTo(canvas.width - pxPadding, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 4;
  for (const member of members) {
    const startNode = nodes.find((node) => node.id === member.startNodeId);
    const endNode = nodes.find((node) => node.id === member.endNodeId);
    if (!startNode || !endNode) continue;
    ctx.beginPath();
    ctx.moveTo(toCanvasX(startNode.x), toCanvasY(startNode.y));
    ctx.lineTo(toCanvasX(endNode.x), toCanvasY(endNode.y));
    ctx.stroke();
  }

  for (const support of supports) {
    const node = nodes.find((entry) => entry.id === support.nodeId);
    if (!node) continue;

    const px = toCanvasX(node.x);
    const py = toCanvasY(node.y);

    if (support.type === 'fixed') {
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(px - 15, py, 30, 15);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(px - 15 + i * 8, py);
        ctx.lineTo(px - 15 + i * 8 + 8, py + 15);
        ctx.stroke();
      }
    } else if (support.type === 'pinned') {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 12, py + 20);
      ctx.lineTo(px + 12, py + 20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#064e3b';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (support.type === 'roller') {
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 10, py + 15);
      ctx.lineTo(px + 10, py + 15);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py + 20, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#ef4444';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3;
  for (const load of loads) {
    const node = nodes.find((entry) => entry.id === load.nodeId);
    if (!node) continue;

    const px = toCanvasX(node.x);
    const py = toCanvasY(node.y);

    if (load.fy && load.fy !== 0) {
      const arrowLen = Math.min(40, Math.abs(load.fy) * 2);
      const dir = load.fy < 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(px, py - dir * 10);
      ctx.lineTo(px, py - dir * (10 + arrowLen));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py - dir * 10);
      ctx.lineTo(px - 6, py - dir * 20);
      ctx.lineTo(px + 6, py - dir * 20);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 12px Arial';
      ctx.fillText(`${Math.abs(load.fy).toFixed(1)} kN`, px + 8, py - dir * 25);
    }

    if (load.fx && load.fx !== 0) {
      const arrowLen = Math.min(40, Math.abs(load.fx) * 2);
      const dir = load.fx > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(px + dir * 10, py);
      ctx.lineTo(px + dir * (10 + arrowLen), py);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + dir * 10, py);
      ctx.lineTo(px + dir * 20, py - 6);
      ctx.lineTo(px + dir * 20, py + 6);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 12px Arial';
      ctx.fillText(`${Math.abs(load.fx).toFixed(1)} kN`, px + dir * 45, py + 5);
    }
  }

  ctx.fillStyle = '#22c55e';
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 3;
  for (const reaction of reactions) {
    const node = nodes.find((entry) => entry.id === reaction.nodeId);
    if (!node) continue;

    const px = toCanvasX(node.x);
    const py = toCanvasY(node.y);

    if (Math.abs(reaction.fy) > 0.01) {
      const arrowLen = Math.min(40, Math.abs(reaction.fy) * 2);
      const dir = reaction.fy > 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(px, py + dir * 25);
      ctx.lineTo(px, py + dir * (25 + arrowLen));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px, py + dir * 25);
      ctx.lineTo(px - 6, py + dir * 35);
      ctx.lineTo(px + 6, py + dir * 35);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 11px Arial';
      ctx.fillText(`R=${Math.abs(reaction.fy).toFixed(2)} kN`, px + 10, py + dir * 50);
    }

    if (Math.abs(reaction.fx) > 0.01) {
      const arrowLen = Math.min(40, Math.abs(reaction.fx) * 2);
      const dir = reaction.fx > 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(px + dir * 25, py);
      ctx.lineTo(px + dir * (25 + arrowLen), py);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + dir * 25, py);
      ctx.lineTo(px + dir * 35, py - 6);
      ctx.lineTo(px + dir * 35, py + 6);
      ctx.closePath();
      ctx.fill();
      ctx.font = 'bold 11px Arial';
      ctx.fillText(`H=${Math.abs(reaction.fx).toFixed(2)} kN`, px + dir * 50, py - 8);
    }
  }

  ctx.fillStyle = '#1f2937';
  for (const node of nodes) {
    const px = toCanvasX(node.x);
    const py = toCanvasY(node.y);
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, 2 * Math.PI);
    ctx.fill();

    ctx.font = '10px Arial';
    ctx.fillStyle = '#374151';
    ctx.fillText(node.id.slice(0, 8), px + 10, py - 10);
    ctx.fillStyle = '#1f2937';
  }

  const imgData = canvas.toDataURL('image/png');
  callbacks.syncYAfterTable(10);
  callbacks.ensureSpace(canvasHeight + 20);
  const y = state.contentTop;
  state.doc.addImage(imgData, 'PNG', state.margin, y, canvasWidth, canvasHeight);

  const legendY = y + canvasHeight + 8;
  state.doc.setFontSize(9);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.fail);
  state.doc.text('● Applied Loads (Red)', state.margin, legendY);
  state.doc.setTextColor(...THEME.pass);
  state.doc.text('● Reaction Forces (Green)', state.margin + 50, legendY);
  state.doc.setTextColor(...THEME.textSecondary);
  state.doc.text('● Members (Grey)', state.margin + 110, legendY);
  state.doc.setTextColor(...THEME.text);

  state.contentTop = legendY + 10;
}

export function addDetailedReactionsTable(
  state: FreeBodyState,
  callbacks: FreeBodyCallbacks,
  reactions: ReactionRow[],
  loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>,
): void {
  callbacks.addPage('Reaction Forces');
  callbacks.addSectionHeading('Support Reactions Summary');

  const totalRx = reactions.reduce((sum, reaction) => sum + reaction.fx, 0);
  const totalRy = reactions.reduce((sum, reaction) => sum + reaction.fy, 0);
  const totalRz = reactions.reduce((sum, reaction) => sum + (reaction.fz ?? 0), 0);
  const totalMx = reactions.reduce((sum, reaction) => sum + (reaction.mx ?? 0), 0);
  const totalMy = reactions.reduce((sum, reaction) => sum + (reaction.my ?? 0), 0);
  const totalMz = reactions.reduce((sum, reaction) => sum + (reaction.mz ?? 0), 0);

  const totalLoadFx = loads.reduce((sum, load) => sum + (load.fx ?? 0), 0);
  const totalLoadFy = loads.reduce((sum, load) => sum + (load.fy ?? 0), 0);
  const totalLoadFz = loads.reduce((sum, load) => sum + (load.fz ?? 0), 0);

  state.tableCount += 1;
  const headers = ['Support', 'Rx (kN)', 'Ry (kN)', 'Rz (kN)', 'Mx (kN·m)', 'My (kN·m)', 'Mz (kN·m)'];
  const data = reactions.map((reaction) => [
    reaction.nodeId.slice(0, 10),
    reaction.fx.toFixed(3),
    reaction.fy.toFixed(3),
    (reaction.fz ?? 0).toFixed(3),
    (reaction.mx ?? 0).toFixed(3),
    (reaction.my ?? 0).toFixed(3),
    (reaction.mz ?? 0).toFixed(3),
  ]);

  data.push([
    'TOTAL',
    totalRx.toFixed(3),
    totalRy.toFixed(3),
    totalRz.toFixed(3),
    totalMx.toFixed(3),
    totalMy.toFixed(3),
    totalMz.toFixed(3),
  ]);

  callbacks.addResultsTable(`Table ${state.tableCount}: Reaction Forces`, headers, data);

  callbacks.syncYAfterTable(15);
  callbacks.ensureSpace(30);
  let checkY = state.contentTop;

  state.doc.setFontSize(11);
  state.doc.setFont('helvetica', 'bold');
  state.doc.text('Equilibrium Check', state.margin, checkY);
  checkY += 6;

  state.doc.setFontSize(9);
  state.doc.setFont('helvetica', 'normal');

  const equilibriumX = Math.abs(totalRx + totalLoadFx) < 0.01;
  const equilibriumY = Math.abs(totalRy + totalLoadFy) < 0.01;
  const equilibriumZ = Math.abs(totalRz + totalLoadFz) < 0.01;

  state.doc.setTextColor(...(equilibriumX ? THEME.pass : THEME.fail));
  state.doc.text(`ΣFx = ${(totalRx + totalLoadFx).toFixed(4)} kN ${equilibriumX ? '✓' : '✗'}`, state.margin, checkY);

  state.doc.setTextColor(...(equilibriumY ? THEME.pass : THEME.fail));
  state.doc.text(`ΣFy = ${(totalRy + totalLoadFy).toFixed(4)} kN ${equilibriumY ? '✓' : '✗'}`, state.margin + 60, checkY);

  state.doc.setTextColor(...(equilibriumZ ? THEME.pass : THEME.fail));
  state.doc.text(`ΣFz = ${(totalRz + totalLoadFz).toFixed(4)} kN ${equilibriumZ ? '✓' : '✗'}`, state.margin + 120, checkY);

  state.doc.setTextColor(...THEME.text);
}
