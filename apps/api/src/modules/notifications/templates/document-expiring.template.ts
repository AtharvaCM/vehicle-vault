import { Injectable } from '@nestjs/common';

import type {
  AlertTemplate,
  DocumentExpiringPayload,
  RenderedNotification,
} from '../types';

/**
 * Bucket a day count into a coarse window so duplicate alerts within the
 * same window dedupe, but a document that crosses into a tighter window
 * gets a fresh alert. Mirrors the ADR-0003 stance that each template owns
 * its dedup identity.
 *
 *   ≤ 7 days  → "7d"   (the urgent renewal window)
 *   ≤ 30 days → "30d"  (the heads-up window)
 *   otherwise → "future"  (kept out-of-band: callers shouldn't request beyond 30)
 */
export function daysBucket(daysUntilExpiry: number): string {
  if (daysUntilExpiry <= 7) return '7d';
  if (daysUntilExpiry <= 30) return '30d';
  return 'future';
}

function kindLabel(kind: 'insurance' | 'warranty'): string {
  return kind === 'insurance' ? 'Insurance' : 'Warranty';
}

@Injectable()
export class DocumentExpiringTemplate implements AlertTemplate<'document-expiring'> {
  readonly kind = 'document-expiring' as const;

  dedupKey(payload: DocumentExpiringPayload): string {
    return `document-expiring:${payload.document.id}:${daysBucket(payload.daysUntilExpiry)}`;
  }

  render(payload: DocumentExpiringPayload): RenderedNotification {
    const { document, daysUntilExpiry } = payload;
    const label = kindLabel(document.kind);
    const formattedDays = Math.max(0, Math.round(daysUntilExpiry));
    const expiryDate = document.endDate
      ? document.endDate.toLocaleDateString('en-IN', {
          dateStyle: 'medium',
          timeZone: 'Asia/Kolkata',
        })
      : 'soon';

    const identifier = document.number ? ` (${document.number})` : '';

    return {
      title: `${label} Expiring Soon: ${document.provider}`,
      message: `Your ${label.toLowerCase()} with ${document.provider}${identifier} is expiring in ${formattedDays} day${formattedDays === 1 ? '' : 's'} on ${expiryDate}. Please ensure you renew it in time.`,
      type: 'warning',
      link: `/vehicles/${document.vehicleId}?tab=protection`,
    };
  }
}
