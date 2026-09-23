import type { Accessory } from '@vehicle-vault/shared';

import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from '@/lib/format';

import { daysUntilExpiry } from '../utils/warranty-status';

interface AccessoryCardProps {
  accessory: Accessory;
  /** Omitted for someone who cannot change the vehicle; the control goes with it. */
  onEdit?: (accessory: Accessory) => void;
  onDelete?: (accessory: Accessory) => Promise<void>;
  isDeleting?: boolean;
}

export function AccessoryCard({
  accessory,
  onEdit,
  onDelete,
  isDeleting = false,
}: AccessoryCardProps) {
  const isRemoved = accessory.removedDate != null;
  const isFitted = !isRemoved && accessory.fittedDate != null;
  const warrantyDays = accessory.warrantyExpiresAt
    ? daysUntilExpiry(accessory.warrantyExpiresAt, new Date())
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">{accessory.name}</CardTitle>
            {accessory.brand ? <p className="text-sm text-slate-500">{accessory.brand}</p> : null}
          </div>
          <Badge tone={isRemoved ? 'neutral' : isFitted ? 'accent' : 'warning'}>
            {isRemoved ? 'Removed' : isFitted ? 'Fitted' : 'Not fitted'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">Cost</dt>
            <dd className="mt-1 text-slate-900">
              {format.money(accessory.cost, { currency: accessory.currencyCode })}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">Bought</dt>
            <dd className="mt-1 text-slate-900">{format.date(accessory.purchaseDate)}</dd>
          </div>
          {accessory.category ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">Category</dt>
              <dd className="mt-1 text-slate-900">{accessory.category}</dd>
            </div>
          ) : null}
          {accessory.removedDate ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">Removed</dt>
              <dd className="mt-1 text-slate-900">
                {format.date(accessory.removedDate)}
                {accessory.removedOdometer != null
                  ? ` · ${format.distance(accessory.removedOdometer)}`
                  : ''}
              </dd>
            </div>
          ) : accessory.fittedDate ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-slate-500">Fitted</dt>
              <dd className="mt-1 text-slate-900">
                {format.date(accessory.fittedDate)}
                {accessory.fittedOdometer != null
                  ? ` · ${format.distance(accessory.fittedOdometer)}`
                  : ''}
              </dd>
            </div>
          ) : null}
        </dl>

        {accessory.warrantyExpiresAt ? (
          <p
            className={
              warrantyDays != null && warrantyDays <= 30
                ? 'text-sm text-amber-700'
                : 'text-sm text-slate-500'
            }
          >
            {warrantyDays != null && warrantyDays < 0
              ? `Warranty ended ${format.date(accessory.warrantyExpiresAt)}`
              : `Warranty until ${format.date(accessory.warrantyExpiresAt)}`}
          </p>
        ) : null}

        {accessory.notes ? <p className="text-sm text-slate-600">{accessory.notes}</p> : null}

        {onEdit || onDelete ? (
          <div className="flex items-center gap-2">
            {onEdit ? (
              <Button onClick={() => onEdit(accessory)} size="sm" variant="secondary">
                Edit
              </Button>
            ) : null}
            {onDelete ? (
              <ConfirmActionDialog
                confirmLabel="Delete"
                description={`${accessory.name} will be removed from this vehicle's accessories. This cannot be undone.`}
                isPending={isDeleting}
                onConfirm={() => onDelete(accessory)}
                title="Delete this accessory?"
                triggerLabel="Delete"
                triggerVariant="ghost"
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
