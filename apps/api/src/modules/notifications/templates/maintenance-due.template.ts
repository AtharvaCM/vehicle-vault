import { Injectable } from '@nestjs/common';

import type { AlertTemplate, MaintenanceDuePayload, RenderedNotification } from '../types';

function formatCategoryLabel(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

@Injectable()
export class MaintenanceDueTemplate implements AlertTemplate<'maintenance-due'> {
  readonly kind = 'maintenance-due' as const;

  dedupKey(payload: MaintenanceDuePayload): string {
    return `maintenance-due:${payload.vehicleId}:${payload.category}`;
  }

  render(payload: MaintenanceDuePayload): RenderedNotification {
    const label = formatCategoryLabel(payload.category);
    const remainingKm = Math.round(payload.remainingDistanceKm);

    return {
      title: `Service Due Soon: ${label}`,
      message: `Your ${label} is due in approx. ${remainingKm} km. Time to plan a visit to the workshop.`,
      type: 'warning',
      link: `/vehicles/${payload.vehicleId}?tab=maintenance`,
    };
  }
}
