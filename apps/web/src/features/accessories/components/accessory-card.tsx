import type { Accessory } from '@vehicle-vault/shared';

import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { Figure } from '@/components/shared/figure';
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
            <CardTitle className="text-lead">{accessory.name}</CardTitle>
            {accessory.brand ? <p className="text-ui text-fg-3">{accessory.brand}</p> : null}
          </div>
          <Badge tone={isRemoved ? 'neutral' : isFitted ? 'accent' : 'warning'}>
            {isRemoved ? 'Removed' : isFitted ? 'Fitted' : 'Not fitted'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-ui">
          <Figure
            label="Cost"
            value={format.money(accessory.cost, { currency: accessory.currencyCode })}
          />
          <Figure label="Bought" value={format.date(accessory.purchaseDate)} />
          {accessory.category ? <Figure label="Category" value={accessory.category} /> : null}
          {accessory.removedDate ? (
            <Figure
              label="Removed"
              value={
                <>
                  {format.date(accessory.removedDate)}
                  {accessory.removedOdometer != null
                    ? ` · ${format.distance(accessory.removedOdometer)}`
                    : ''}
                </>
              }
            />
          ) : accessory.fittedDate ? (
            <Figure
              label="Fitted"
              value={
                <>
                  {format.date(accessory.fittedDate)}
                  {accessory.fittedOdometer != null
                    ? ` · ${format.distance(accessory.fittedOdometer)}`
                    : ''}
                </>
              }
            />
          ) : null}
        </div>

        {accessory.warrantyExpiresAt ? (
          <p
            className={
              warrantyDays != null && warrantyDays <= 30 ? 'text-ui text-soon' : 'text-ui text-fg-3'
            }
          >
            {warrantyDays != null && warrantyDays < 0
              ? `Warranty ended ${format.date(accessory.warrantyExpiresAt)}`
              : `Warranty until ${format.date(accessory.warrantyExpiresAt)}`}
          </p>
        ) : null}

        {accessory.notes ? <p className="text-ui text-fg-2">{accessory.notes}</p> : null}

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
