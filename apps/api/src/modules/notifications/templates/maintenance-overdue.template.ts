import { Injectable } from '@nestjs/common';

import type {
  AlertTemplate,
  MaintenanceOverduePayload,
  RenderedNotification,
} from '../types';

function formatCategoryLabel(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

@Injectable()
export class MaintenanceOverdueTemplate implements AlertTemplate<'maintenance-overdue'> {
  readonly kind = 'maintenance-overdue' as const;

  dedupKey(payload: MaintenanceOverduePayload): string {
    return `maintenance-overdue:${payload.vehicleId}:${payload.category}`;
  }

  render(payload: MaintenanceOverduePayload): RenderedNotification {
    const label = formatCategoryLabel(payload.category);
    const overdueKm = Math.abs(Math.round(payload.remainingDistanceKm));

    return {
      title: `Overdue Service: ${label}`,
      message: `Your ${label} is overdue by approx. ${overdueKm} km. Please schedule service soon.`,
      type: 'error',
      link: `/vehicles/${payload.vehicleId}?tab=maintenance`,
    };
  }
}
