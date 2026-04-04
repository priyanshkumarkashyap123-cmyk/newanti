import jsPDF from 'jspdf';

import { THEME } from '../reportTheme';

export interface DiagramState {
  doc: jsPDF;
  margin: number;
  pageWidth: number;
  contentTop: number;
  figureCount: number;
}

export interface DiagramCallbacks {
  ensureSpace: (neededMM: number, headerTitle?: string) => void;
  addPage: (title?: string) => void;
  addNumberedSectionHeading: (number: string, title: string) => void;
}

export type DiagramType = 'BMD' | 'SFD' | 'AFD';

/**
 * Draw a professional force/moment curve with axes, fill and labels.
 */
export function drawDiagramOnCanvas(
  ctx: CanvasRenderingContext2D,
  xValues: number[],
  values: number[],
  maxValue: number,
  canvasWidth: number,
  canvasHeight: number,
): void {
  const padding = 50;
  const graphWidth = canvasWidth - 2 * padding;
  const graphHeight = canvasHeight - 2 * padding;

  ctx.fillStyle = '#FAFBFE';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.strokeStyle = '#D2D7E1';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, canvasWidth, canvasHeight);

  ctx.strokeStyle = '#E8ECF2';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 8; i++) {
    const x = padding + (graphWidth / 8) * i;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, canvasHeight - padding);
    ctx.stroke();
  }
  for (let i = 0; i <= 6; i++) {
    const y = padding + (graphHeight / 6) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvasWidth - padding, y);
    ctx.stroke();
  }

  const zeroY = canvasHeight / 2;
  ctx.strokeStyle = '#AAB0BA';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 3]);
  ctx.beginPath();
  ctx.moveTo(padding, zeroY);
  ctx.lineTo(canvasWidth - padding, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = `rgb(${THEME.primary.join(',')})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvasHeight - padding);
  ctx.lineTo(canvasWidth - padding, canvasHeight - padding);
  ctx.stroke();

  const maxAbsValue = Math.max(Math.abs(maxValue), 1e-9);

  if (values.length > 0 && xValues.length > 0) {
    const xRange = xValues[xValues.length - 1] || 1;

    ctx.fillStyle = 'rgba(0, 133, 202, 0.08)';
    ctx.beginPath();
    ctx.moveTo(padding, zeroY);
    for (let i = 0; i < values.length; i++) {
      const x = padding + (xValues[i] / xRange) * graphWidth;
      const y = zeroY - (values[i] / maxAbsValue) * (graphHeight / 2);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padding + (xValues[xValues.length - 1] / xRange) * graphWidth, zeroY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgb(${THEME.accent.join(',')})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < values.length; i++) {
      const x = padding + (xValues[i] / xRange) * graphWidth;
      const y = zeroY - (values[i] / maxAbsValue) * (graphHeight / 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    let peakIdx = 0;
    let peakAbs = 0;
    for (let i = 0; i < values.length; i++) {
      if (Math.abs(values[i]) > peakAbs) {
        peakAbs = Math.abs(values[i]);
        peakIdx = i;
      }
    }

    if (peakAbs > 0) {
      const px = padding + (xValues[peakIdx] / xRange) * graphWidth;
      const py = zeroY - (values[peakIdx] / maxAbsValue) * (graphHeight / 2);
      ctx.fillStyle = `rgb(${THEME.fail.join(',')})`;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgb(${THEME.primary.join(',')})`;
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${values[peakIdx].toFixed(2)}`, px, py - 8);
    }
  }

  ctx.fillStyle = `rgb(${THEME.textSecondary.join(',')})`;
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('0', padding, canvasHeight - padding + 18);
  ctx.fillText('L', canvasWidth - padding, canvasHeight - padding + 18);
  ctx.fillText('Position along member', canvasWidth / 2, canvasHeight - 8);

  ctx.textAlign = 'right';
  ctx.fillText(`+${maxAbsValue.toFixed(1)}`, padding - 5, padding + 5);
  ctx.fillText(`-${maxAbsValue.toFixed(1)}`, padding - 5, canvasHeight - padding + 5);
  ctx.fillText('0', padding - 5, zeroY + 4);
}

/**
 * Add a single member diagram frame and caption.
 */
export function addMemberDiagram(
  state: DiagramState,
  callbacks: Pick<DiagramCallbacks, 'ensureSpace'>,
  memberId: string,
  diagramType: DiagramType,
  data: { x_values: number[]; values: number[] },
  maxValue: number,
): void {
  const diagramHeight = 60;
  const frameH = diagramHeight + 18;
  callbacks.ensureSpace(frameH + 10);

  state.figureCount++;
  const typeLabel =
    diagramType === 'BMD'
      ? 'Bending Moment'
      : diagramType === 'SFD'
        ? 'Shear Force'
        : 'Axial Force';
  const unitLabel = diagramType === 'BMD' ? 'kN·m' : 'kN';

  const width = state.pageWidth - 2 * state.margin;
  const y = state.contentTop;

  state.doc.setDrawColor(...THEME.border);
  state.doc.setLineWidth(0.3);
  state.doc.roundedRect(state.margin, y, width, frameH, 1, 1, 'S');

  state.doc.setFillColor(...THEME.rowAlt);
  state.doc.rect(state.margin + 0.15, y + 0.15, width - 0.3, 8, 'F');
  state.doc.setFontSize(8);
  state.doc.setFont('helvetica', 'bold');
  state.doc.setTextColor(...THEME.primary);
  state.doc.text(`Member ${memberId}  —  ${typeLabel} Diagram  (${unitLabel})`, state.margin + 4, y + 5.5);

  const canvas = document.createElement('canvas');
  canvas.width = width * 3.78;
  canvas.height = diagramHeight * 3.78;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawDiagramOnCanvas(ctx, data.x_values, data.values, maxValue, canvas.width, canvas.height);

    const imgData = canvas.toDataURL('image/png');
    state.doc.addImage(imgData, 'PNG', state.margin + 1, y + 9, width - 2, diagramHeight);
  }

  const captionY = y + 9 + diagramHeight + 4;
  state.doc.setFontSize(7);
  state.doc.setFont('helvetica', 'italic');
  state.doc.setTextColor(...THEME.textSecondary);
  state.doc.text(
    `Figure ${state.figureCount} — ${typeLabel} diagram for Member ${memberId}`,
    state.margin + width / 2,
    captionY,
    { align: 'center' },
  );

  state.contentTop = captionY + 6;
  state.doc.setTextColor(...THEME.text);
}

/**
 * Add diagram suites for each member and requested diagram type.
 */
export function addAllMemberDiagrams(
  state: DiagramState,
  callbacks: DiagramCallbacks & {
    addMemberDiagram: (
      memberId: string,
      diagramType: DiagramType,
      data: { x_values: number[]; values: number[] },
      maxValue: number,
    ) => void;
  },
  members: Array<{
    id: string;
    maxShear?: number;
    maxMoment?: number;
    maxAxial?: number;
    diagramData?: {
      x_values: number[];
      shear_values: number[];
      moment_values: number[];
      axial_values: number[];
      deflection_values: number[];
    };
  }>,
  diagramTypes: DiagramType[] = ['SFD', 'BMD'],
): void {
  if (members.length === 0) return;

  callbacks.addPage('Force & Moment Diagrams');
  callbacks.addNumberedSectionHeading('', 'FORCE & MOMENT DIAGRAMS');

  state.doc.setFontSize(8);
  state.doc.setFont('helvetica', 'normal');
  state.doc.setTextColor(...THEME.textSecondary);
  state.doc.text(
    'The following diagrams show the distribution of internal forces along each member. Positive values follow the adopted sign convention.',
    state.margin,
    state.contentTop,
  );
  state.contentTop += 6;

  members.forEach((member) => {
    if (!member.diagramData) return;

    diagramTypes.forEach((type) => {
      const values =
        type === 'SFD'
          ? member.diagramData!.shear_values
          : type === 'BMD'
            ? member.diagramData!.moment_values
            : member.diagramData!.axial_values;
      const maxVal =
        type === 'SFD'
          ? member.maxShear || 10
          : type === 'BMD'
            ? member.maxMoment || 10
            : member.maxAxial || 10;

      callbacks.addMemberDiagram(
        member.id,
        type,
        {
          x_values: member.diagramData!.x_values,
          values,
        },
        maxVal,
      );
    });
  });
}
