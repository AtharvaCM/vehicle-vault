import { Prisma } from '@prisma/client';

export const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export const intFmt = new Intl.NumberFormat('en-IN');

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  return d.toISOString().slice(0, 10);
}

export function decimalToNumber(d: Prisma.Decimal | null | undefined): number {
  if (!d) return 0;
  return Number(d.toString());
}

export function drawRow(
  doc: PDFKit.PDFDocument,
  cells: string[],
  widths: number[],
): void {
  const startX = doc.x;
  const startY = doc.y;
  let x = startX;
  for (let i = 0; i < cells.length; i += 1) {
    const w = widths[i] ?? 80;
    doc.text(cells[i] ?? '', x, startY, { width: w - 4, ellipsis: true });
    x += w;
  }
  doc.x = startX;
  doc.y = startY + 14;
}

export function drawKeyValue(
  doc: PDFKit.PDFDocument,
  rows: [string, string][],
): void {
  for (const [k, v] of rows) {
    doc.text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(v).font('Helvetica');
  }
}
