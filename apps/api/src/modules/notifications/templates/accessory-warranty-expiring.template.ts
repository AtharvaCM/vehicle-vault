import { Injectable } from '@nestjs/common';

import type {
  AccessoryWarrantyExpiringPayload,
  AlertTemplate,
  RenderedNotification,
} from '../types';
import { daysBucket } from './document-expiring.template';

/**
 * Notification.title is VARCHAR(120) and an accessory name may itself be 120
 * characters, so the name is trimmed to what is left after the fixed prefix
 * rather than letting the insert throw.
 */
const TITLE_PREFIX = 'Warranty Expiring Soon: ';
const TITLE_NAME_BUDGET = 120 - TITLE_PREFIX.length;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}\u2026`;
}

/**
 * An accessory warranty is a date-based expiry like a document's, so it reuses
 * the document bucketing rather than inventing a second dedup rhythm — the two
 * alerts should feel like one behaviour.
 */
@Injectable()
export class AccessoryWarrantyExpiringTemplate
  implements AlertTemplate<'accessory-warranty-expiring'>
{
  readonly kind = 'accessory-warranty-expiring' as const;

  dedupKey(payload: AccessoryWarrantyExpiringPayload): string {
    return `accessory-warranty-expiring:${payload.accessory.id}:${daysBucket(
      payload.daysUntilExpiry,
    )}`;
  }

  render(payload: AccessoryWarrantyExpiringPayload): RenderedNotification {
    const { accessory, daysUntilExpiry } = payload;
    const formattedDays = Math.max(0, Math.round(daysUntilExpiry));
    const expiryDate = accessory.warrantyExpiresAt
      ? accessory.warrantyExpiresAt.toLocaleDateString('en-IN', {
          dateStyle: 'medium',
          timeZone: 'Asia/Kolkata',
        })
      : 'soon';

    const item = accessory.brand ? `${accessory.brand} ${accessory.name}` : accessory.name;

    return {
      title: `${TITLE_PREFIX}${truncate(accessory.name, TITLE_NAME_BUDGET)}`,
      message: `The warranty on your ${item} expires in ${formattedDays} day${
        formattedDays === 1 ? '' : 's'
      } on ${expiryDate}. Raise any claim before it runs out.`,
      type: 'warning',
      link: `/vehicles/${accessory.vehicleId}?tab=accessories`,
    };
  }
}
