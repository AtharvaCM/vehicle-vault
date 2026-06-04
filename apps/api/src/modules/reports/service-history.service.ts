import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import { PrismaService } from '../../common/prisma/prisma.service';
import { decimalToNumber, drawRow, fmtDate, inr, intFmt } from './pdf-utils';

/**
 * Builds a printable Service History PDF for a single vehicle, covering
 * ownership metadata, lifetime cost summary, full maintenance log, fuel
 * usage roll-up, insurance policies, and claim history. The document is
 * intended for resale handover and personal record-keeping.
 */
@Injectable()
export class ServiceHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async buildPdf(userId: string, vehicleId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, userId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const [maintenance, fuelLogs, policies, claims] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({
        where: { vehicleId },
        orderBy: { serviceDate: 'desc' },
      }),
      this.prisma.fuelLog.findMany({
        where: { vehicleId },
        orderBy: { date: 'asc' },
      }),
      this.prisma.insurancePolicy.findMany({
        where: { vehicleId },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.claim.findMany({
        where: { insurancePolicy: { vehicleId } },
        orderBy: { filedDate: 'desc' },
        include: { maintenanceRecord: { select: { serviceDate: true, workshopName: true } } },
      }),
    ]);

    const totalMaintenance = maintenance.reduce(
      (acc, r) => acc + decimalToNumber(r.totalCost),
      0,
    );
    const totalFuelCost = fuelLogs.reduce((acc, l) => acc + decimalToNumber(l.totalCost), 0);
    const totalFuelLitres = fuelLogs.reduce((acc, l) => acc + l.quantity, 0);
    const insurerReimbursed = claims.reduce(
      (acc, c) => acc + decimalToNumber(c.insurerPaidAmount),
      0,
    );

    let kmDriven = 0;
    if (fuelLogs.length >= 2) {
      const first = fuelLogs[0];
      const last = fuelLogs[fuelLogs.length - 1];
      if (first && last) kmDriven = Math.max(0, last.odometer - first.odometer);
    }
    const totalSpend = totalMaintenance + totalFuelCost - insurerReimbursed;

    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<void>((resolve) => {
      doc.on('end', () => resolve());
    });

    // Header
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('Vehicle Service History', { align: 'left' });
    doc.moveDown(0.2);
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#475569')
      .text(`Generated ${new Date().toISOString().slice(0, 10)}`);
    doc.fillColor('#000000');
    doc.moveDown(1);

    // Vehicle block
    doc.font('Helvetica-Bold').fontSize(13).text('Vehicle');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    const displayName = vehicle.nickname?.trim() || `${vehicle.make} ${vehicle.model}`;
    const lines: [string, string][] = [
      ['Name', displayName],
      ['Make / Model / Variant', `${vehicle.make} ${vehicle.model} ${vehicle.variant}`],
      ['Year', String(vehicle.year)],
      ['Registration', vehicle.registrationNumber],
      ['Fuel type', vehicle.fuelType],
      ['Current odometer', `${intFmt.format(vehicle.odometer)} km`],
      ['Purchase date', fmtDate(vehicle.purchaseDate)],
      [
        'Purchase price',
        vehicle.purchasePrice ? inr.format(decimalToNumber(vehicle.purchasePrice)) : '—',
      ],
      [
        'Odometer at purchase',
        vehicle.purchaseOdometer != null
          ? `${intFmt.format(vehicle.purchaseOdometer)} km`
          : '—',
      ],
    ];
    for (const [k, v] of lines) {
      doc.text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(v).font('Helvetica');
    }
    doc.moveDown(0.8);

    // Lifetime summary
    doc.font('Helvetica-Bold').fontSize(13).text('Lifetime summary');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    const ownershipKm =
      vehicle.purchaseOdometer != null
        ? Math.max(0, vehicle.odometer - vehicle.purchaseOdometer)
        : kmDriven;
    const costPerKm = ownershipKm > 0 ? totalSpend / ownershipKm : null;
    const summary: [string, string][] = [
      ['Maintenance records', String(maintenance.length)],
      ['Maintenance total', inr.format(totalMaintenance)],
      ['Fuel logs', String(fuelLogs.length)],
      ['Fuel total cost', inr.format(totalFuelCost)],
      ['Fuel total volume', `${totalFuelLitres.toFixed(2)} L`],
      ['Insurer reimbursed (claims)', inr.format(insurerReimbursed)],
      ['Net out-of-pocket', inr.format(totalSpend)],
      ['Distance covered', `${intFmt.format(ownershipKm)} km`],
      ['Cost per km', costPerKm != null ? inr.format(costPerKm) : '—'],
    ];
    for (const [k, v] of summary) {
      doc.text(`${k}: `, { continued: true }).font('Helvetica-Bold').text(v).font('Helvetica');
    }
    doc.moveDown(0.8);

    // Maintenance log table
    doc.font('Helvetica-Bold').fontSize(13).text('Maintenance log');
    doc.moveDown(0.3);
    if (maintenance.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('No records.').fillColor('#000');
    } else {
      doc.font('Helvetica-Bold').fontSize(9);
      const headers = ['Date', 'Category', 'Workshop', 'Odometer', 'Cost'];
      const widths = [70, 110, 150, 70, 90];
      drawRow(doc, headers, widths);
      doc.font('Helvetica').fontSize(9);
      for (const record of maintenance) {
        drawRow(doc, [
          fmtDate(record.serviceDate),
          record.category,
          record.workshopName ?? '—',
          `${intFmt.format(record.odometer)} km`,
          inr.format(decimalToNumber(record.totalCost)),
        ], widths);
        if (doc.y > 760) doc.addPage();
      }
    }
    doc.moveDown(0.8);

    // Insurance policies
    if (doc.y > 680) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(13).text('Insurance policies');
    doc.moveDown(0.3);
    if (policies.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('No policies.').fillColor('#000');
    } else {
      doc.font('Helvetica').fontSize(10);
      for (const policy of policies) {
        doc
          .font('Helvetica-Bold')
          .text(`${policy.provider} — ${policy.policyNumber}`)
          .font('Helvetica')
          .text(
            `Valid ${fmtDate(policy.startDate)} → ${fmtDate(policy.endDate)} • Premium ${policy.premiumAmount ? inr.format(decimalToNumber(policy.premiumAmount)) : '—'}`,
          );
        doc.moveDown(0.4);
      }
    }
    doc.moveDown(0.4);

    // Claims
    if (doc.y > 680) doc.addPage();
    doc.font('Helvetica-Bold').fontSize(13).text('Claims');
    doc.moveDown(0.3);
    if (claims.length === 0) {
      doc.font('Helvetica').fontSize(10).fillColor('#64748b').text('No claims filed.').fillColor('#000');
    } else {
      doc.font('Helvetica-Bold').fontSize(9);
      const headers = ['Filed', 'Status', 'Workshop', 'Gross', 'Insurer paid'];
      const widths = [70, 90, 150, 90, 90];
      drawRow(doc, headers, widths);
      doc.font('Helvetica').fontSize(9);
      for (const c of claims) {
        drawRow(doc, [
          fmtDate(c.filedDate),
          c.status,
          c.maintenanceRecord?.workshopName ?? '—',
          inr.format(decimalToNumber(c.grossAmount)),
          inr.format(decimalToNumber(c.insurerPaidAmount)),
        ], widths);
        if (doc.y > 760) doc.addPage();
      }
    }

    doc.moveDown(2);
    doc
      .font('Helvetica-Oblique')
      .fontSize(9)
      .fillColor('#64748b')
      .text(
        'Generated by Vehicle Vault. Cost figures are computed from records logged in this account.',
        { align: 'center' },
      )
      .fillColor('#000');

    doc.end();
    await done;

    const fileName = `service-history-${vehicle.registrationNumber.replace(/[^A-Za-z0-9]/g, '')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    return { buffer: Buffer.concat(chunks), fileName };
  }
}

