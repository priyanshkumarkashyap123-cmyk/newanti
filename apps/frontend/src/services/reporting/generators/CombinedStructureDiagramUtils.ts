import type jsPDF from 'jspdf';

import { THEME } from '../reportTheme';

export interface CombinedStructureDiagramState {
  doc: jsPDF;
  margin: number;
  pageWidth: number;
  contentTop: number;
}

export interface CombinedStructureDiagramCallbacks {
  addPage: (title?: string) => void;
  addSectionHeading: (text: string) => void;
  ensureSpace: (neededMM: number, headerTitle?: string) => void;
}

export function addCombinedStructureDiagram(
  state: CombinedStructureDiagramState,
  callbacks: CombinedStructureDiagramCallbacks,
  nodes: Array<{ id: string; x: number; y: number; z: number }>,
  members: Array<{
    id: string;
    startNodeId: string;
    endNodeId: string;
    diagramData?: {
      x_values: number[];
      shear_values: number[];
      moment_values: number[];
      axial_values: number[];
    };
  }>,
  diagramType: 'SFD' | 'BMD' | 'AFD',
): void {
  callbacks.addPage(`Combined ${diagramType} - Entire Structure`);
  callbacks.addSectionHeading(
    `Combined ${diagramType === 'SFD' ? 'Shear Force' : diagramType === 'BMD' ? 'Bending Moment' : 'Axial Force'} Diagram`,
  );

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const canvasWidth = state.pageWidth - 2 * state.margin;
  const canvasHeight = 140;
  const padding = 35;
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

  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 4;
  for (const member of members) {
    const startNode = nodes.find((n) => n.id === member.startNodeId);
    const endNode = nodes.find((n) => n.id === member.endNodeId);
    if (startNode && endNode) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(startNode.x), toCanvasY(startNode.y));
      ctx.lineTo(toCanvasX(endNode.x), toCanvasY(endNode.y));
      ctx.stroke();
    }
  }

  const colors: Record<string, string> = {
    SFD: '#dc2626',
    BMD: '#2563eb',
    AFD: '#16a34a',
  };
  const color = colors[diagramType];

  let globalMax = 1;
  for (const member of members) {
    if (!member.diagramData) continue;
    const values =
      diagramType === 'SFD'
        ? member.diagramData.shear_values
        : diagramType === 'BMD'
          ? member.diagramData.moment_values
          : member.diagramData.axial_values;
    const maxVal = Math.max(...values.map(Math.abs));
    if (maxVal > globalMax) globalMax = maxVal;
  }

  const diagramScale = 30 / globalMax;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.fillStyle = color.replace(')', ', 0.15)').replace('rgb', 'rgba');

  for (const member of members) {
    const startNode = nodes.find((n) => n.id === member.startNodeId);
    const endNode = nodes.find((n) => n.id === member.endNodeId);
    if (!startNode || !endNode || !member.diagramData) continue;

    const values =
      diagramType === 'SFD'
        ? member.diagramData.shear_values
        : diagramType === 'BMD'
          ? member.diagramData.moment_values
          : member.diagramData.axial_values;
    const xValues = member.diagramData.x_values;

    if (values.length === 0) continue;

    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const memberLen = Math.sqrt(dx * dx + dy * dy) || 1;
    const perpX = -dy / memberLen;
    const perpY = dx / memberLen;

    const startPx = toCanvasX(startNode.x);
    const startPy = toCanvasY(startNode.y);
    const endPx = toCanvasX(endNode.x);
    const endPy = toCanvasY(endNode.y);

    ctx.beginPath();
    ctx.moveTo(startPx, startPy);

    for (let i = 0; i < values.length; i++) {
      const t = xValues[i] / (xValues[xValues.length - 1] || 1);
      const basePx = startPx + t * (endPx - startPx);
      const basePy = startPy + t * (endPy - startPy);
      const offset = values[i] * diagramScale;
      ctx.lineTo(basePx + perpX * offset, basePy - perpY * offset);
    }

    ctx.lineTo(endPx, endPy);
    ctx.closePath();

    const rgb = hexToRgb(color);
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.stroke();

    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const maxIdx = values.indexOf(Math.abs(maxVal) > Math.abs(minVal) ? maxVal : minVal);
    const t = xValues[maxIdx] / (xValues[xValues.length - 1] || 1);
    const labelPx = startPx + t * (endPx - startPx);
    const labelPy = startPy + t * (endPy - startPy);
    const labelOffset = (Math.abs(maxVal) > Math.abs(minVal) ? maxVal : minVal) * diagramScale;

    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = color;
    const labelValue = Math.abs(maxVal) > Math.abs(minVal) ? maxVal : minVal;
    ctx.fillText(`${labelValue.toFixed(1)}`, labelPx + perpX * labelOffset + 5, labelPy - perpY * labelOffset);
  }

  ctx.fillStyle = '#374151';
  for (const node of nodes) {
    const px = toCanvasX(node.x);
    const py = toCanvasY(node.y);
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, 2 * Math.PI);
    ctx.fill();
  }

  const imgData = canvas.toDataURL('image/png');
  callbacks.ensureSpace(canvasHeight + 20);
  state.doc.addImage(imgData, 'PNG', state.margin, state.contentTop, canvasWidth, canvasHeight);

  const legendY = state.contentTop + canvasHeight + 8;
  state.doc.setFontSize(9);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16));
  const unit = diagramType === 'BMD' ? 'kN·m' : 'kN';
  state.doc.text(`${diagramType} values in ${unit} | Max scale: ±${globalMax.toFixed(2)} ${unit}`, state.margin, legendY);
  state.doc.setTextColor(...THEME.text);

  state.contentTop = legendY + 10;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}
