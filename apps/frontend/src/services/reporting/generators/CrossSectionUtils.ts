import type jsPDF from 'jspdf';

import { THEME } from '../reportTheme';

export interface CrossSectionState {
  doc: jsPDF;
  margin: number;
  pageWidth: number;
  contentTop: number;
  tableCount: number;
}

export interface CrossSectionCallbacks {
  addPage: (title?: string) => void;
  addSectionHeading: (text: string) => void;
  ensureSpace: (neededMM: number, headerTitle?: string) => void;
  syncYAfterTable: (fallbackGap?: number) => void;
  getContentTop: () => number;
  addResultsTable: (title: string, headers: string[], data: (string | number)[][]) => void;
}

export interface CrossSectionMemberInput {
  id: string;
  sectionId: string;
  E?: number;
  A?: number;
  Iy?: number;
  Iz?: number;
  J?: number;
  length?: number;
}

export function addCrossSectionalDetails(
  state: CrossSectionState,
  callbacks: CrossSectionCallbacks,
  members: CrossSectionMemberInput[],
): void {
  if (members.length === 0) return;

  callbacks.addPage('Cross-Sectional Properties');
  callbacks.addSectionHeading('Member Cross-Section Details');

  state.tableCount += 1;
  const headers = [
    'Member ID',
    'Section',
    'E (GPa)',
    'A (cm²)',
    'Iy (cm⁴)',
    'Iz (cm⁴)',
    'J (cm⁴)',
    'Length (m)',
  ];

  const data = members.map((member) => [
    member.id.slice(0, 10),
    member.sectionId || 'Custom',
    member.E ? (member.E / 1e6).toFixed(0) : '200',
    member.A ? (member.A * 1e4).toFixed(2) : '—',
    member.Iy ? (member.Iy * 1e8).toFixed(2) : '—',
    member.Iz ? (member.Iz * 1e8).toFixed(2) : '—',
    member.J ? (member.J * 1e8).toFixed(2) : '—',
    member.length?.toFixed(3) || '—',
  ]);

  callbacks.addResultsTable(`Table ${state.tableCount}: Cross-Sectional Properties`, headers, data);
  state.contentTop = callbacks.getContentTop();

  const uniqueSections = [...new Set(members.map((member) => member.sectionId))];
  if (uniqueSections.length > 0 && uniqueSections.length <= 6) {
    addCrossSectionVisualizations(state, callbacks, uniqueSections.filter((sectionId) => sectionId && sectionId !== 'Custom'));
  }
}

function addCrossSectionVisualizations(
  state: CrossSectionState,
  callbacks: Pick<CrossSectionCallbacks, 'syncYAfterTable' | 'ensureSpace'>,
  sectionIds: string[],
): void {
  callbacks.syncYAfterTable(15);
  callbacks.ensureSpace(80, 'Cross-Section Details');
  let y = state.contentTop;

  state.doc.setFontSize(11);
  state.doc.setFont('helvetica', 'bold');
  state.doc.text('Section Profiles', state.margin, y);
  y += 8;

  const sectionWidth = 50;
  const sectionHeight = 40;
  let x = state.margin;

  for (const sectionId of sectionIds) {
    if (x + sectionWidth > state.pageWidth - state.margin) {
      x = state.margin;
      y += sectionHeight + 20;
    }

    state.doc.setDrawColor(100, 100, 100);
    state.doc.setLineWidth(0.3);
    state.doc.rect(x, y, sectionWidth, sectionHeight);

    drawSectionProfile(state.doc, x + sectionWidth / 2, y + sectionHeight / 2, sectionId);

    state.doc.setFontSize(8);
    state.doc.setFont('helvetica', 'normal');
    state.doc.text(sectionId.slice(0, 12), x + sectionWidth / 2, y + sectionHeight + 5, {
      align: 'center',
    });

    x += sectionWidth + 10;
  }
}

function drawSectionProfile(doc: jsPDF, cx: number, cy: number, sectionId: string): void {
  doc.setDrawColor(50, 50, 50);
  doc.setFillColor(200, 200, 200);
  doc.setLineWidth(0.5);

  const sectionType = sectionId.toLowerCase();

  if (sectionType.includes('ismb') || sectionType.includes('w') || sectionType.includes('ipe')) {
    const w = 18;
    const h = 24;
    const tf = 3;
    const tw = 2;
    doc.rect(cx - w / 2, cy - h / 2, w, tf, 'FD');
    doc.rect(cx - tw / 2, cy - h / 2 + tf, tw, h - 2 * tf, 'FD');
    doc.rect(cx - w / 2, cy + h / 2 - tf, w, tf, 'FD');
  } else if (sectionType.includes('ismc') || sectionType.includes('c') || sectionType.includes('channel')) {
    const w = 14;
    const h = 24;
    const tf = 3;
    const tw = 2;
    doc.rect(cx - w / 2, cy - h / 2, w, tf, 'FD');
    doc.rect(cx - w / 2, cy - h / 2 + tf, tw, h - 2 * tf, 'FD');
    doc.rect(cx - w / 2, cy + h / 2 - tf, w, tf, 'FD');
  } else if (sectionType.includes('isa') || sectionType.includes('angle') || sectionType.includes('l')) {
    const w = 16;
    const t = 3;
    doc.rect(cx - w / 2, cy - w / 2, t, w, 'FD');
    doc.rect(cx - w / 2, cy + w / 2 - t, w, t, 'FD');
  } else if (sectionType.includes('rect') || sectionType.includes('rhs')) {
    const w = 16;
    const h = 20;
    const t = 2;
    doc.setFillColor(200, 200, 200);
    doc.rect(cx - w / 2, cy - h / 2, w, h, 'FD');
    doc.setFillColor(255, 255, 255);
    doc.rect(cx - w / 2 + t, cy - h / 2 + t, w - 2 * t, h - 2 * t, 'FD');
  } else if (sectionType.includes('chs') || sectionType.includes('pipe') || sectionType.includes('circular')) {
    const r = 10;
    const t = 2;
    doc.setFillColor(200, 200, 200);
    doc.circle(cx, cy, r, 'FD');
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, r - t, 'FD');
  } else {
    const w = 12;
    const h = 20;
    doc.rect(cx - w / 2, cy - h / 2, w, h, 'FD');
  }
}
