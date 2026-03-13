export type Primitive = string | number | boolean | null | undefined;

function flattenObject(
  value: unknown,
  prefix = '',
  out: Record<string, Primitive> = {},
): Record<string, Primitive> {
  if (value === null || value === undefined) {
    out[prefix || 'value'] = value as Primitive;
    return out;
  }

  if (typeof value !== 'object') {
    out[prefix || 'value'] = value as Primitive;
    return out;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      out[prefix || 'value'] = '';
      return out;
    }
    value.forEach((item, index) => {
      flattenObject(item, `${prefix}[${index}]`, out);
    });
    return out;
  }

  Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    flattenObject(val, nextKey, out);
  });
  return out;
}

function csvEscape(value: Primitive): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function exportRowsToCsv(filename: string, rows: Array<Record<string, Primitive>>): void {
  if (!rows.length) return;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportObjectToPdf(filename: string, title: string, payload: unknown): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const flat = flattenObject(payload);
  const entries = Object.entries(flat);

  let y = 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 14, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  for (const [key, value] of entries) {
    if (y > 285) {
      doc.addPage();
      y = 16;
    }
    const line = `${key}: ${value ?? ''}`;
    const wrapped = doc.splitTextToSize(line, 182);
    doc.text(wrapped, 14, y);
    y += Math.max(4, wrapped.length * 3.8);
  }

  doc.save(filename);
}

export function flattenForExport(value: unknown): Record<string, Primitive> {
  return flattenObject(value);
}
