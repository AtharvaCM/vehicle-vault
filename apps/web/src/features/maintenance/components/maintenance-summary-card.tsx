import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/format-currency';
import { formatDate } from '@/lib/utils/format-date';

import type { MaintenanceRecord } from '../types/maintenance-record';
import { formatMaintenanceCategory } from '../utils/format-maintenance-category';

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
        <CardTitle>Maintenance summary</CardTitle>
        <CardDescription>Review the recorded details for this service entry.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Detail
          label="Category"
          value={<Badge>{formatMaintenanceCategory(record.category)}</Badge>}
        />
        <Detail label="Service date" value={formatDate(record.serviceDate)} />
        <Detail label="Odometer" value={`${record.odometer.toLocaleString('en-IN')} km`} />
        <Detail label="Total cost" value={formatCurrency(record.totalCost, record.currencyCode)} />
        <Detail
          label="Workshop or garage"
          value={record.workshopName?.trim() || 'Workshop not specified'}
        />
        <Detail
          label="Invoice / job card"
          value={record.invoiceNumber?.trim() || 'Not specified'}
        />
        <Detail
          label="Next due date"
          value={record.nextDueDate ? formatDate(record.nextDueDate) : 'Not specified'}
        />
        <Detail
          label="Next due odometer"
          value={
            record.nextDueOdometer !== undefined
              ? `${record.nextDueOdometer.toLocaleString('en-IN')} km`
              : 'Not specified'
          }
        />
        <Detail
          label="Entry source"
          value={<Badge tone="neutral">{formatLabel(record.source ?? 'manual')}</Badge>}
        />
        <Detail
          label="Status"
          value={<Badge tone="neutral">{formatLabel(record.status ?? 'confirmed')}</Badge>}
        />
        <Detail
          label="Added"
          value={formatDate(record.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
        />
        <Detail
          label="Last updated"
          value={formatDate(record.updatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
        />
        <Detail
          label="Notes"
          value={record.notes?.trim() || 'No additional service notes were recorded.'}
          className="md:col-span-2"
        />

        {hasStructuredCosts ? (
          <Detail
            className="md:col-span-2"
            label="Structured breakdown"
            value={
              <div className="grid gap-3 sm:grid-cols-2">
                <BreakdownRow
                  label="Parts"
                  value={formatCurrency(record.partsCost ?? 0, record.currencyCode)}
                />
                <BreakdownRow
                  label="Fluids"
                  value={formatCurrency(record.fluidsCost ?? 0, record.currencyCode)}
                />
                <BreakdownRow
                  label="Labor"
                  value={formatCurrency(record.laborCost ?? 0, record.currencyCode)}
                />
                <BreakdownRow
                  label="Tax"
                  value={formatCurrency(record.taxCost ?? 0, record.currencyCode)}
                />
                <BreakdownRow
                  label="Discount"
                  value={formatCurrency(record.discountAmount ?? 0, record.currencyCode)}
                />
              </div>
            }
          />
        ) : null}

        {record.lineItems?.length ? (
          <Detail
            className="md:col-span-2"
            label="Structured items"
            value={
              <div className="space-y-3">
                {record.lineItems.map((lineItem) => (
                  <div
                    key={lineItem.id}
                    className="rounded-2xl border border-border/70 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-900">{lineItem.name}</span>
                          <Badge tone="neutral">{formatLabel(lineItem.kind)}</Badge>
                          {lineItem.normalizedCategory ? (
                            <Badge>{formatMaintenanceCategory(lineItem.normalizedCategory)}</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500">
                          {[
                            lineItem.brand,
                            lineItem.partNumber,
                            typeof lineItem.quantity === 'number'
                              ? `${lineItem.quantity}${lineItem.unit ? ` ${lineItem.unit}` : ''}`
                              : undefined,
                            typeof lineItem.unitPrice === 'number'
                              ? `${formatCurrency(lineItem.unitPrice, record.currencyCode)} / unit`
                              : undefined,
                          ]
                            .filter(Boolean)
                            .join(' • ') || 'No extra item metadata'}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {formatCurrency(lineItem.lineTotal ?? 0, record.currencyCode)}
                      </div>
                    </div>
                    {lineItem.notes ? (
                      <p className="mt-2 text-sm text-slate-600">{lineItem.notes}</p>
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

type DetailProps = {
  className?: string;
  label: string;
  value: ReactNode;
};

function Detail({ className, label, value }: DetailProps) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm text-slate-900">{value}</div>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
