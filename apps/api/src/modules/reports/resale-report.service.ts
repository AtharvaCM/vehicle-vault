import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import { PrismaService } from '../../common/prisma/prisma.service';
import { summarize, type LoanParams, type Prepayment } from '../vehicle-loans/amortization';
import { decimalToNumber, drawKeyValue, drawRow, fmtDate, inr, intFmt } from './pdf-utils';

interface ResaleReportOptions {
  askingPrice?: number;
}

/**
 * Buyer-facing resale report. Discloses outstanding loan, pending reminders,
 * insurance status, and document checklist. Suppresses owner-only financial
 * analytics (cost-per-km, fuel totals, insurer payouts) that aren't relevant
 * to a prospective buyer.
 */
@Injectable()
export class ResaleReportService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPdf(
    userId: string,
    vehicleId: string,
    options: ResaleReportOptions = {},
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, members: { some: { userId } } },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const [maintenance, fuelLogs, policies, claims, loans, reminders] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({
        where: { vehicleId },
        orderBy: { serviceDate: 'desc' },
      }),
      this.prisma.fuelLog.findMany({
        where: { vehicleId },
        orderBy: { date: 'asc' },
        select: { date: true, odometer: true },
      }),
      this.prisma.insurancePolicy.findMany({
        where: { vehicleId },
        orderBy: { endDate: 'desc' },
      }),
      this.prisma.claim.findMany({
        where: { insurancePolicy: { vehicleId } },
        select: { id: true, status: true },
      }),
      this.prisma.vehicleLoan.findMany({
        where: { vehicleId },
        include: { prepayments: true },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.reminder.findMany({
        where: { vehicleId, status: { in: ['overdue', 'due_today', 'upcoming'] } },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      }),
    ]);

    let kmDriven = 0;
    if (fuelLogs.length >= 2) {
      const first = fuelLogs[0];
      const last = fuelLogs[fuelLogs.length - 1];
      if (first && last) kmDriven = Math.max(0, last.odometer - first.odometer);
    }
    const ownershipKm =
      vehicle.purchaseOdometer != null
        ? Math.max(0, vehicle.odometer - vehicle.purchaseOdometer)
        : kmDriven;

    const today = new Date();
    const activePolicy = policies.find(
      (p) => p.startDate.getTime() <= today.getTime() && p.endDate.getTime() >= today.getTime(),
    );

    const loanSummaries = loans.map((loan) => {
      const params: LoanParams = {
        principal: loan.principal,
        interestRate: loan.interestRate,
        tenureMonths: loan.tenureMonths,
        startDate: loan.startDate,
        closedAt: loan.closedAt,
        prepayments: loan.prepayments.map(
          (p): Prepayment => ({ date: p.date, amount: p.amount }),
        ),
      };
      return { loan, summary: summarize(params, today) };
    });
    const activeLoans = loanSummaries.filter(({ loan }) => loan.status === 'active');

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<void>((resolve) => {
      doc.on('end', () => resolve());
    });

    // Cover
    doc.font('Helvetica-Bold').fontSize(22).text('Vehicle Resale Report', { align: 'left' });
    doc.moveDown(0.2);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#475569')
      .text(`Generated ${fmtDate(today)}`)
      .fillColor('#000');
    doc.moveDown(1);

    const displayName = vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
    doc.font('Helvetica-Bold').fontSize(13).text('Vehicle');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    const ownerSince = vehicle.purchaseDate
      ? `${fmtDate(vehicle.purchaseDate)} (${monthsBetween(vehicle.purchaseDate, today)} months)`
      : '—';
    drawKeyValue(doc, [
      ['Name', displayName],
      ['Make / Model / Variant', `${vehicle.make} ${vehicle.model} ${vehicle.variant}`],
      ['Year', String(vehicle.year)],
      ['Registration', vehicle.registrationNumber],
      ['Fuel type', vehicle.fuelType],
      ['Current odometer', `${intFmt.format(vehicle.odometer)} km`],
      ['Owner since', ownerSince],
      ['Distance covered under owner', `${intFmt.format(ownershipKm)} km`],
      ...(options.askingPrice != null
        ? ([['Asking price', inr.format(options.askingPrice)]] as [string, string][])
        : []),
    ]);
    doc.moveDown(0.8);

    // Loan disclosure
    if (doc.y > 680) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(13).text('Loan disclosure');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    if (loanSummaries.length === 0) {
      doc.fillColor('#16a34a').text('No active or closed loan on file.').fillColor('#000');
    } else if (activeLoans.length === 0) {
      doc
        .fillColor('#16a34a')
        .text('All loans on this vehicle are closed.')
        .fillColor('#000');
      doc.moveDown(0.3);
      for (const { loan } of loanSummaries) {
        doc
          .font('Helvetica-Bold')
          .text(`${loan.lender} — closed`)
          .font('Helvetica')
          .text(`Closed on ${fmtDate(loan.closedAt)}. NOC should be available.`);
        doc.moveDown(0.3);
      }
    } else {
      doc
        .fillColor('#b45309')
        .text(`${activeLoans.length} active loan${activeLoans.length > 1 ? 's' : ''} on this vehicle. Outstanding amount must be settled at transfer.`)
        .fillColor('#000');
      doc.moveDown(0.3);
      for (const { loan, summary } of activeLoans) {
        doc.font('Helvetica-Bold').text(loan.lender).font('Helvetica');
        drawKeyValue(doc, [
          ['Outstanding principal', inr.format(decimalToNumber(summary.outstandingBalance))],
          ['EMI', inr.format(decimalToNumber(loan.emiAmount))],
          ['Tenure remaining', `${summary.monthsRemaining} months`],
          ['Scheduled end', fmtDate(summary.endDate)],
        ]);
        doc.moveDown(0.4);
      }
    }
    doc.moveDown(0.4);

    // Insurance
    if (doc.y > 680) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(13).text('Insurance');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    if (activePolicy) {
      drawKeyValue(doc, [
        ['Provider', activePolicy.provider],
        ['Policy number', activePolicy.policyNumber],
        ['Valid until', fmtDate(activePolicy.endDate)],
        ['Claims filed (lifetime)', String(claims.length)],
      ]);
    } else {
      doc.fillColor('#b45309').text('No active insurance policy on file.').fillColor('#000');
      if (claims.length > 0) {
        doc.text(`Lifetime claims filed: ${claims.length}`);
      }
    }
    doc.moveDown(0.8);

    // Pending reminders
    if (doc.y > 680) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(13).text('Open service items');
    doc.moveDown(0.3);
    if (reminders.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#16a34a').text('No pending or overdue reminders.').fillColor('#000');
    } else {
      doc.font('Helvetica-Bold').fontSize(9);
      const headers = ['Status', 'Title', 'Type', 'Due'];
      const widths = [80, 200, 100, 110];
      drawRow(doc, headers, widths);
      doc.font('Helvetica').fontSize(9);
      for (const r of reminders) {
        const due = r.dueDate
          ? fmtDate(r.dueDate)
          : r.dueOdometer != null
            ? `${intFmt.format(r.dueOdometer)} km`
            : '—';
        drawRow(doc, [r.status, r.title, r.type, due], widths);
        if (doc.y > 760) doc.addPage();
      }
    }
    doc.moveDown(0.8);

    // Document checklist
    if (doc.y > 600) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(13).text('Document checklist');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    const loanClosed = loanSummaries.length > 0 && activeLoans.length === 0;
    const checklist: [string, boolean, string][] = [
      ['Registration certificate (RC)', true, 'Required for transfer'],
      ['Active insurance policy', !!activePolicy, activePolicy ? `Valid until ${fmtDate(activePolicy.endDate)}` : 'Renew before transfer'],
      ['Pollution under control (PUC)', true, 'Provide latest certificate'],
      [
        'Loan NOC',
        loanClosed,
        loanSummaries.length === 0
          ? 'Not applicable — no loan on file'
          : loanClosed
            ? 'Available — loan closed'
            : 'Required after loan settlement',
      ],
    ];
    for (const [label, ok, note] of checklist) {
      const mark = ok ? '[x]' : '[ ]';
      doc
        .text(`${mark}  `, { continued: true })
        .font('Helvetica-Bold')
        .text(label, { continued: true })
        .font('Helvetica')
        .text(` — ${note}`);
    }
    doc.moveDown(0.8);

    // Maintenance log (summary count, then list)
    if (doc.y > 600) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(13).text(`Maintenance log (${maintenance.length})`);
    doc.moveDown(0.3);
    if (maintenance.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('No records.').fillColor('#000');
    } else {
      doc.font('Helvetica-Bold').fontSize(9);
      const headers = ['Date', 'Category', 'Workshop', 'Odometer'];
      const widths = [80, 140, 180, 90];
      drawRow(doc, headers, widths);
      doc.font('Helvetica').fontSize(9);
      for (const record of maintenance) {
        drawRow(
          doc,
          [
            fmtDate(record.serviceDate),
            record.category,
            record.workshopName ?? '—',
            `${intFmt.format(record.odometer)} km`,
          ],
          widths,
        );
        if (doc.y > 760) doc.addPage();
      }
    }

    doc.moveDown(2);
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor('#64748b')
      .text(
        'Data in this report is self-reported by the current owner via Vehicle Vault. Buyers should independently verify registration, loan status, and document authenticity before purchase.',
        { align: 'center' },
      )
      .fillColor('#000');

    doc.end();
    await done;

    const fileName = `resale-report-${vehicle.registrationNumber.replace(/[^A-Za-z0-9]/g, '')}-${fmtDate(today)}.pdf`;
    return { buffer: Buffer.concat(chunks), fileName };
  }
}

function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(0, months);
}
