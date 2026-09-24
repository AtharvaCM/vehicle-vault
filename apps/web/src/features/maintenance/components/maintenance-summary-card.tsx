import { Figure } from '@/components/shared/figure';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from '@/lib/format';

import type { MaintenanceRecord } from '../types/maintenance-record';

type MaintenanceSummaryCardProps = {
  record: MaintenanceRecord;
};

export function MaintenanceSummaryCard({ record }: MaintenanceSummaryCardProps) {
  const hasStructuredCosts =
    record.laborCost !== undefined ||
    record.partsCost !== undefined ||
    record.fluidsCost !== undefined ||
    record.taxCost !== undefined ||
    record.discountAmount !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service summary</CardTitle>
        <CardDescription>Review the recorded details for this service record.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Figure
          label="Category"
          value={<Badge>{format.enumLabel('maintenanceCategory', record.category)}</Badge>}
        />
        <Figure label="Service date" value={format.date(record.serviceDate)} />
        <Figure label="Odometer" value={format.odometer(record.odometer)} />
        <Figure
          label="Total cost"
          value={format.money(record.totalCost, { currency: record.currencyCode })}
        />
        <Figure
          label="Workshop or garage"
          value={record.workshopName?.trim() || 'Workshop not specified'}
        />
        <Figure
          label="Invoice / job card"
          value={record.invoiceNumber?.trim() || 'Not specified'}
        />
        <Figure
          label="Next due date"
          value={record.nextDueDate ? format.date(record.nextDueDate) : 'Not specified'}
        />
        <Figure
          label="Next due odometer"
          value={
            record.nextDueOdometer !== undefined
              ? format.odometer(record.nextDueOdometer)
              : 'Not specified'
          }
        />
        <Figure
          label="Added via"
          value={
            <Badge tone="neutral">
              {format.enumLabel('maintenanceSource', record.source ?? 'manual')}
            </Badge>
          }
        />
        <Figure
          label="Status"
          value={
            <Badge tone="neutral">
              {format.enumLabel('maintenanceRecordStatus', record.status ?? 'confirmed')}
            </Badge>
          }
        />
        <Figure label="Added" value={format.date(record.createdAt, 'dateTime')} />
        <Figure label="Last updated" value={format.date(record.updatedAt, 'dateTime')} />
        <Figure
          label="Notes"
          value={record.notes?.trim() || 'No additional service notes were recorded.'}
          className="md:col-span-2"
        />

        {hasStructuredCosts ? (
          <Figure
            className="md:col-span-2"
            label="Structured breakdown"
            value={
              <div className="grid gap-3 sm:grid-cols-2">
                <BreakdownRow
                  label="Parts"
                  value={format.money(record.partsCost ?? 0, { currency: record.currencyCode })}
                />
                <BreakdownRow
                  label="Fluids"
                  value={format.money(record.fluidsCost ?? 0, { currency: record.currencyCode })}
                />
                <BreakdownRow
                  label="Labour"
                  value={format.money(record.laborCost ?? 0, { currency: record.currencyCode })}
                />
                <BreakdownRow
                  label="Tax"
                  value={format.money(record.taxCost ?? 0, { currency: record.currencyCode })}
                />
                <BreakdownRow
                  label="Discount"
                  value={format.money(record.discountAmount ?? 0, {
                    currency: record.currencyCode,
                  })}
                />
              </div>
            }
          />
        ) : null}

        {record.lineItems?.length ? (
          <Figure
            className="md:col-span-2"
            label="Structured items"
            value={
              <div className="space-y-3">
                {record.lineItems.map((lineItem) => (
                  <div
                    key={lineItem.id}
                    className="rounded-2xl border border-border/70 bg-page/70 px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-fg">{lineItem.name}</span>
                          <Badge tone="neutral">
                            {format.enumLabel('maintenanceLineItemKind', lineItem.kind)}
                          </Badge>
                          {lineItem.normalizedCategory ? (
                            <Badge>
                              {format.enumLabel('maintenanceCategory', lineItem.normalizedCategory)}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-fg-3">
                          {[
                            lineItem.brand,
                            lineItem.partNumber,
                            typeof lineItem.quantity === 'number'
                              ? `${lineItem.quantity}${lineItem.unit ? ` ${lineItem.unit}` : ''}`
                              : undefined,
                            typeof lineItem.unitPrice === 'number'
                              ? `${format.money(lineItem.unitPrice, { currency: record.currencyCode })} / unit`
                              : undefined,
                          ]
                            .filter(Boolean)
                            .join(' • ') || 'No extra item metadata'}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-fg">
                        {typeof lineItem.lineTotal === 'number'
                          ? format.money(lineItem.lineTotal, { currency: record.currencyCode })
                          : '—'}
                      </div>
                    </div>
                    {lineItem.notes ? (
                      <p className="mt-2 text-sm text-fg-2">{lineItem.notes}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            }
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-surface px-3 py-2">
      <Figure label={label} value={value} />
    </div>
  );
}
