import type jsPDF from 'jspdf';

import { THEME } from '../reportTheme';
import { safeAbsMax } from '../reportUtils';

export interface DetailedDiagramState {
  doc: jsPDF;
  margin: number;
  pageWidth: number;
  usableBottom: number;
  contentTop: number;
}

export interface DetailedDiagramCallbacks {
  addPage: (title?: string) => void;
  ensureSpace: (neededMM: number, headerTitle?: string) => void;
}

export interface DetailedMemberInput {
  id: string;
  startNodeId: string;
  endNodeId: string;
  length: number;
  sectionId?: string;
  E?: number;
  I?: number;
  A?: number;
  maxShear?: number;
  maxMoment?: number;
  maxAxial?: number;
  startReactions?: { shear: number; moment: number; axial: number };
  endReactions?: { shear: number; moment: number; axial: number };
  diagramData?: {
    x_values: number[];
    shear_values: number[];
    moment_values: number[];
    axial_values: number[];
    deflection_values: number[];
  };
}

export function addDetailedMemberDiagrams(
  state: DetailedDiagramState,
  callbacks: DetailedDiagramCallbacks,
  members: DetailedMemberInput[],
): void {
  if (members.length === 0) return;

  members.forEach((member, index) => {
    callbacks.addPage(`Member ${index + 1} Analysis`);

    state.doc.setFontSize(14);
    state.doc.setFont('helvetica', 'bold');
    state.doc.setTextColor(...THEME.primary);
    state.doc.text(`Member: ${member.id}`, state.margin, state.contentTop);
    state.contentTop += 8;

    state.doc.setFillColor(...THEME.calcBoxBg);
    state.doc.roundedRect(
      state.margin,
      state.contentTop,
      state.pageWidth - 2 * state.margin,
      25,
      2,
      2,
      'F',
    );

    state.doc.setFontSize(9);
    state.doc.setFont('helvetica', 'normal');
    state.doc.setTextColor(...THEME.text);

    const infoY = state.contentTop + 6;
    state.doc.text(`Start Node: ${member.startNodeId}`, state.margin + 5, infoY);
    state.doc.text(`End Node: ${member.endNodeId}`, state.margin + 55, infoY);
    state.doc.text(`Length: ${member.length.toFixed(3)} m`, state.margin + 105, infoY);
    state.doc.text(`Section: ${member.sectionId || 'Default'}`, state.margin + 5, infoY + 8);
    state.doc.text(`E: ${member.E ? (member.E / 1e6).toFixed(0) : '200'} GPa`, state.margin + 55, infoY + 8);
    state.doc.text(`I: ${member.I ? (member.I * 1e8).toFixed(2) : '—'} cm⁴`, state.margin + 105, infoY + 8);
    state.doc.text(`A: ${member.A ? (member.A * 1e4).toFixed(2) : '—'} cm²`, state.margin + 155, infoY + 8);

    state.contentTop += 30;
    state.doc.setTextColor(...THEME.text);

    if (!member.diagramData) {
      state.doc.setFontSize(10);
      state.doc.text('No diagram data available for this member.', state.margin, state.contentTop);
      return;
    }

    const diagrams: Array<{
      type: string;
      values: number[];
      maxVal: number;
      unit: string;
      color: string;
    }> = [
      {
        type: 'Shear Force Diagram (SFD)',
        values: member.diagramData.shear_values,
        maxVal: Math.max(member.maxShear ?? safeAbsMax(member.diagramData.shear_values, 10), 0.01),
        unit: 'kN',
        color: '#dc2626',
      },
      {
        type: 'Bending Moment Diagram (BMD)',
        values: member.diagramData.moment_values,
        maxVal: Math.max(member.maxMoment ?? safeAbsMax(member.diagramData.moment_values, 10), 0.01),
        unit: 'kN·m',
        color: '#2563eb',
      },
      {
        type: 'Axial Force Diagram (AFD)',
        values: member.diagramData.axial_values,
        maxVal: Math.max(member.maxAxial ?? safeAbsMax(member.diagramData.axial_values, 10), 0.01),
        unit: 'kN',
        color: '#16a34a',
      },
    ];

    diagrams.forEach((diagram) => {
      const blockHeight = 65;
      callbacks.ensureSpace(blockHeight, `Member ${member.id} - Continued`);

      state.doc.setFontSize(11);
      state.doc.setFont('helvetica', 'bold');
      state.doc.setTextColor(...THEME.primary);
      state.doc.text(diagram.type, state.margin, state.contentTop);
      state.contentTop += 5;

      const availableHeight = Math.max(Math.min(state.usableBottom - state.contentTop - 5, 50), 35);
      drawEnhancedDiagram(
        state,
        member.diagramData!.x_values,
        diagram.values,
        diagram.maxVal,
        diagram.unit,
        diagram.color,
        member.length,
        availableHeight,
      );

      state.contentTop += 5;
    });

    addMemberCalculations(state, callbacks, member);
  });
}

function drawEnhancedDiagram(
  state: DetailedDiagramState,
  xValues: number[],
  values: number[],
  maxValue: number,
  unit: string,
  color: string,
  memberLength: number,
  heightMM: number = 50,
): void {
  const width = state.pageWidth - 2 * state.margin;
  const height = heightMM;
  const canvas = document.createElement('canvas');
  canvas.width = width * 3.78;
  canvas.height = height * 3.78;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const padding = { left: 45, right: 20, top: 15, bottom: 20 };
  const graphWidth = canvas.width - padding.left - padding.right;
  const graphHeight = canvas.height - padding.top - padding.bottom;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const x = padding.left + (graphWidth / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, canvas.height - padding.bottom);
    ctx.stroke();
  }
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (graphHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(canvas.width - padding.right, y);
    ctx.stroke();
  }

  const zeroY = padding.top + graphHeight / 2;
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left, zeroY);
  ctx.lineTo(canvas.width - padding.right, zeroY);
  ctx.stroke();

  ctx.fillStyle = '#6b7280';
  ctx.fillRect(padding.left, zeroY - 3, graphWidth, 6);

  if (values.length > 0 && xValues.length > 0) {
    const maxX = xValues[xValues.length - 1] || memberLength || 1;
    const scale = graphHeight / 2 / Math.max(Math.abs(maxValue), 1e-9);

    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);

    for (let i = 0; i < values.length; i++) {
      const x = padding.left + (xValues[i] / maxX) * graphWidth;
      const y = zeroY - values[i] * scale;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(canvas.width - padding.right, zeroY);
    ctx.closePath();

    const rgb = hexToRgb(color);
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const x = padding.left + (xValues[i] / maxX) * graphWidth;
      const y = zeroY - values[i] * scale;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const maxIdx = values.indexOf(maxVal);
    const minIdx = values.indexOf(minVal);

    ctx.font = 'bold 11px Arial';
    ctx.fillStyle = color;

    if (Math.abs(maxVal) > 0.01) {
      const xMax = padding.left + (xValues[maxIdx] / (xValues[xValues.length - 1] || 1)) * graphWidth;
      const yMax = zeroY - maxVal * scale;
      ctx.beginPath();
      ctx.arc(xMax, yMax, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText(`${maxVal.toFixed(2)} ${unit}`, xMax + 5, yMax - 5);
    }

    if (Math.abs(minVal) > 0.01 && minIdx !== maxIdx) {
      const xMin = padding.left + (xValues[minIdx] / (xValues[xValues.length - 1] || 1)) * graphWidth;
      const yMin = zeroY - minVal * scale;
      ctx.beginPath();
      ctx.arc(xMin, yMin, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText(`${minVal.toFixed(2)} ${unit}`, xMin + 5, yMin + 15);
    }
  }

  ctx.fillStyle = '#374151';
  ctx.font = '10px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`+${maxValue.toFixed(1)} ${unit}`, padding.left - 5, padding.top + 10);
  ctx.fillText(`-${maxValue.toFixed(1)} ${unit}`, padding.left - 5, canvas.height - padding.bottom - 5);
  ctx.fillText('0', padding.left - 5, zeroY + 4);

  ctx.textAlign = 'center';
  ctx.fillText('0', padding.left, canvas.height - 5);
  ctx.fillText(`${memberLength.toFixed(2)} m`, canvas.width - padding.right, canvas.height - 5);

  const imgData = canvas.toDataURL('image/png');
  state.doc.addImage(imgData, 'PNG', state.margin, state.contentTop, width, height);
  state.contentTop += height + 3;
}

function addMemberCalculations(
  state: DetailedDiagramState,
  callbacks: Pick<DetailedDiagramCallbacks, 'ensureSpace'>,
  member: DetailedMemberInput,
): void {
  callbacks.ensureSpace(90, `Member ${member.id} — Calculations`);

  const L = member.length;
  const I = member.I || 1e-4;
  const A = member.A || 1e-2;

  const shearValues = member.diagramData?.shear_values || [];
  const momentValues = member.diagramData?.moment_values || [];
  const axialValues = member.diagramData?.axial_values || [];
  const deflectionValues = member.diagramData?.deflection_values || [];

  const vmax = shearValues.length > 0 ? Math.max(...shearValues.map(Math.abs)) : member.maxShear || 0;
  const mmax = momentValues.length > 0 ? Math.max(...momentValues.map(Math.abs)) : member.maxMoment || 0;
  const nmax = axialValues.length > 0 ? Math.max(...axialValues.map(Math.abs)) : member.maxAxial || 0;
  const deltaMax = deflectionValues.length > 0 ? Math.max(...deflectionValues.map(Math.abs)) : 0;

  const vStart = shearValues[0] || 0;
  const vEnd = shearValues[shearValues.length - 1] || 0;
  const mStart = momentValues[0] || 0;
  const mEnd = momentValues[momentValues.length - 1] || 0;
  const nStart = axialValues[0] || 0;
  const nEnd = axialValues[axialValues.length - 1] || 0;

  const boxWidth = state.pageWidth - 2 * state.margin;
  const boxHeight = 78;

  state.doc.setFillColor(...THEME.calcBoxBg);
  state.doc.roundedRect(state.margin, state.contentTop, boxWidth, boxHeight, 2, 2, 'F');

  state.doc.setFillColor(...THEME.primary);
  state.doc.rect(state.margin, state.contentTop, 2.5, boxHeight, 'F');

  state.doc.setDrawColor(...THEME.calcBoxBorder);
  state.doc.setLineWidth(0.3);
  state.doc.roundedRect(state.margin, state.contentTop, boxWidth, boxHeight, 2, 2, 'S');

  let calcY = state.contentTop + 6;
  const col1 = state.margin + 7;
  const col2 = state.margin + 95;

  state.doc.setFontSize(9);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primary);
  state.doc.text('CALCULATION SHEET', col1, calcY);
  state.doc.setFontSize(7);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.textMuted);
  state.doc.text(`Ref: Member ${member.id.slice(0, 12)}  |  L = ${L.toFixed(3)} m`, col2, calcY);

  state.doc.setDrawColor(...THEME.calcBoxBorder);
  state.doc.setLineWidth(0.2);
  state.doc.line(col1, calcY + 2, state.margin + boxWidth - 5, calcY + 2);
  calcY += 7;

  state.doc.setFontSize(7.5);
  state.doc.setTextColor(...THEME.text);

  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primaryLight);
  state.doc.text('Shear Force:', col1, calcY);
  calcY += 4;
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.text);
  state.doc.text(`Vᵢ = ${vStart.toFixed(3)} kN`, col1, calcY);
  state.doc.text(`Vⱼ = ${vEnd.toFixed(3)} kN`, col1 + 50, calcY);
  state.doc.text(`V(max) = ${vmax.toFixed(3)} kN`, col2, calcY);
  calcY += 5;

  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primaryLight);
  state.doc.text('Bending Moment:', col1, calcY);
  calcY += 4;
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.text);
  state.doc.text(`Mᵢ = ${mStart.toFixed(3)} kN·m`, col1, calcY);
  state.doc.text(`Mⱼ = ${mEnd.toFixed(3)} kN·m`, col1 + 50, calcY);
  state.doc.text(`M(max) = ${mmax.toFixed(3)} kN·m`, col2, calcY);
  calcY += 4;
  const yMax = 0.15;
  const sigmaB = I > 1e-12 ? (mmax * yMax) / I / 1000 : 0;
  state.doc.setTextColor(...THEME.textSecondary);
  state.doc.text(`σb ≈ M·y/I = ${sigmaB.toFixed(2)} MPa`, col2, calcY);
  calcY += 5;

  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primaryLight);
  state.doc.text('Axial Force:', col1, calcY);
  calcY += 4;
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.text);
  state.doc.text(`Nᵢ = ${nStart.toFixed(3)} kN`, col1, calcY);
  state.doc.text(`Nⱼ = ${nEnd.toFixed(3)} kN`, col1 + 50, calcY);
  state.doc.text(`N(max) = ${nmax.toFixed(3)} kN`, col2, calcY);
  calcY += 4;
  const sigmaA = A > 1e-12 ? nmax / A / 1000 : 0;
  state.doc.setTextColor(...THEME.textSecondary);
  state.doc.text(`σa = N/A = ${sigmaA.toFixed(2)} MPa`, col2, calcY);
  calcY += 5;

  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primaryLight);
  state.doc.text('Deflection:', col1, calcY);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.text);
  state.doc.text(`δ(max) = ${(deltaMax * 1000).toFixed(3)} mm`, col1 + 40, calcY);
  state.doc.text(`L/δ = ${deltaMax > 0 ? (L / deltaMax).toFixed(0) : '∞'}`, col2, calcY);

  const lOverDelta = deltaMax > 0 ? L / deltaMax : Infinity;
  const deflStatus = lOverDelta >= 300 ? 'OK' : 'REVIEW';
  const deflColor = deflStatus === 'OK' ? THEME.pass : THEME.fail;
  state.doc.setFillColor(...deflColor);
  state.doc.roundedRect(col2 + 40, calcY - 3, 14, 5, 1, 1, 'F');
  state.doc.setTextColor(...THEME.white);
  state.doc.setFontSize(6);
  state.doc.setFont('helvetica', 'bold');
  state.doc.text(deflStatus, col2 + 47, calcY + 0.5, { align: 'center' });

  state.doc.setTextColor(...THEME.text);
  state.contentTop += boxHeight + 5;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };

  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}
