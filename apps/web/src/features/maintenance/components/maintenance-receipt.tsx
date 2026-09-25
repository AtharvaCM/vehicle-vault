import { MaintenanceSource } from '@vehicle-vault/shared';

import { Card, CardContent } from '@/components/ui/card';
import { format } from '@/lib/format';

import type { MaintenanceRecord } from '../types/maintenance-record';

type MaintenanceReceiptProps = {
  record: MaintenanceRecord;
};

type ReceiptLine = {
  key: string;
  name: string;
  detail?: string;
  quantity?: string;
  amount: number;
};

/** How the record came to be, for its provenance line: "Typed in on 23 Sep 2026". */
const ADDED_BY: Record<MaintenanceSource, string> = {
  [MaintenanceSource.Manual]: 'Typed in',
  [MaintenanceSource.Ocr]: 'Read from a bill',
  [MaintenanceSource.Csv]: 'Imported',
  [MaintenanceSource.Api]: 'Added by an app',
};

/**
 * What the receipt itemises: each line item, then the costs recorded without
 * one (labour, fluids, parts, tax) and any discount taken off. The total is
 * the record's own, whatever the lines add up to.
 */
function receiptLines(record: MaintenanceRecord): ReceiptLine[] {
  const items: ReceiptLine[] = (record.lineItems ?? []).map((item) => ({
    key: item.id,
    name: item.name,
    detail: [item.brand, item.partNumber].filter(Boolean).join(' · ') || undefined,
    quantity:
      typeof item.quantity === 'number'
        ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
        : undefined,
    amount: item.lineTotal ?? 0,
  }));
  const costs: [string, number | undefined][] = [
    // Parts and fluids already have their own lines when there are line items.
    ...(items.length
      ? []
      : ([
          ['Parts', record.partsCost],
          ['Fluids', record.fluidsCost],
        ] as [string, number | undefined][])),
    ['Labour', record.laborCost],
    ['Tax', record.taxCost],
  ];
  const extras = costs
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([name, amount]) => ({ key: name, name, amount }));
  const discount =
    typeof record.discountAmount === 'number' && record.discountAmount > 0
      ? [{ key: 'discount', name: 'Discount', amount: -record.discountAmount }]
      : [];

  return [...items, ...extras, ...discount];
}

/**
 * A service record as the receipt it came from: the work and what it cost up
 * front, when, at what reading and where, what it set as next due, then the
 * items it was made of and anything written about it.
 */
export function MaintenanceReceipt({ record }: MaintenanceReceiptProps) {
  const money = (value: number) => format.money(value, { currency: record.currencyCode });
  const lines = receiptLines(record);
  const where = [
    format.date(record.serviceDate),
    format.odometer(record.odometer),
    record.workshopName?.trim(),
  ].filter(Boolean);
  const nextDue = [
    record.nextDueDate ? format.date(record.nextDueDate) : null,
    record.nextDueOdometer !== undefined ? format.odometer(record.nextDueOdometer) : null,
  ].filter(Boolean);
  const edited = record.updatedAt !== record.createdAt;

  return (
    <Card data-testid="maintenance-receipt">
      <CardContent className="space-y-6">
        <section aria-label="Service" className="space-y-1.5">
          <p
            className="text-display font-semibold tracking-tight text-fg"
            data-testid="receipt-total"
          >
            {money(record.totalCost)}
          </p>
          <p className="text-body text-fg-2">{where.join(' · ')}</p>
          {nextDue.length ? (
            <p className="text-small text-fg-2" data-testid="receipt-next-due">
              Next due {nextDue.join(' or ')}
              {record.status === 'confirmed' ? ' → reminder set' : null}
            </p>
          ) : null}
          {record.invoiceNumber?.trim() ? (
            <p className="text-small text-fg-3">Invoice {record.invoiceNumber.trim()}</p>
          ) : null}
        </section>

        {lines.length ? (
          <table aria-label="Items" className="w-full text-body" data-testid="receipt-items">
            <thead>
              <tr className="border-b border-line text-left text-small text-fg-3">
                <th className="py-2 font-medium" scope="col">
                  Item
                </th>
                <th className="py-2 text-right font-medium" scope="col">
                  Qty
                </th>
                <th className="py-2 pl-4 text-right font-medium" scope="col">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {lines.map((line) => (
                <tr key={line.key}>
                  <td className="py-2.5 pr-2">
                    <span className="font-medium text-fg">{line.name}</span>
                    {line.detail ? (
                      <span className="block text-small text-fg-3">{line.detail}</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-right text-fg-2 tabular-nums">
                    {line.quantity ?? ''}
                  </td>
                  <td className="py-2.5 pl-4 text-right text-fg tabular-nums">
                    {line.amount < 0 ? `− ${money(-line.amount)}` : money(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line">
                <th className="py-2.5 text-left font-semibold text-fg" colSpan={2} scope="row">
                  Total
                </th>
                <td className="py-2.5 pl-4 text-right font-semibold text-fg tabular-nums">
                  {money(record.totalCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        ) : null}

        {record.notes?.trim() ? (
          <section aria-labelledby="receipt-notes" className="space-y-1">
            <h2 className="text-small font-semibold text-fg-2" id="receipt-notes">
              Notes
            </h2>
            <p className="whitespace-pre-line text-body text-fg">{record.notes.trim()}</p>
          </section>
        ) : null}

        <p className="text-caption text-fg-3" data-testid="receipt-provenance">
          {ADDED_BY[record.source ?? MaintenanceSource.Manual]} on {format.date(record.createdAt)}
          {edited ? ` · last edited ${format.date(record.updatedAt)}` : null}
        </p>
      </CardContent>
    </Card>
  );
}
