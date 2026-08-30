import { Injectable } from '@nestjs/common';

import type {
  AccessoryWarrantyExpiringPayload,
  AlertTemplate,
  RenderedNotification,
} from '../types';
import { daysBucket } from './document-expiring.template';

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
      title: `Warranty Expiring Soon: ${accessory.name}`,
      message: `The warranty on your ${item} expires in ${formattedDays} day${
        formattedDays === 1 ? '' : 's'
      } on ${expiryDate}. Raise any claim before it runs out.`,
      type: 'warning',
      link: `/vehicles/${accessory.vehicleId}?tab=accessories`,
    };
  }
}
