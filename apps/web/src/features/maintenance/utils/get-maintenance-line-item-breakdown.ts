import type { MaintenanceLineItem } from '@vehicle-vault/shared';

type MaintenanceLineItemLike = Partial<
  Pick<
    MaintenanceLineItem,
    | 'kind'
    | 'name'
    | 'quantity'
    | 'unit'
    | 'unitPrice'
    | 'lineTotal'
    | 'brand'
    | 'partNumber'
    | 'notes'
    | 'normalizedCategory'
  >
>;

export type MaintenanceLineItemBreakdown = {
  totalCost: number;
  laborCost: number;
  partsCost: number;
  fluidsCost: number;
  taxCost: number;
  discountAmount: number;
};

export function getMaintenanceLineItemBreakdown(
  lineItems: MaintenanceLineItemLike[],
): MaintenanceLineItemBreakdown {
  const totals = lineItems.reduce<MaintenanceLineItemBreakdown>(
    (totals, lineItem) => {
      const amount = resolveMaintenanceLineItemTotal(lineItem);

      switch (lineItem.kind) {
        case 'labor':
          totals.laborCost += amount;
          totals.totalCost += amount;
          break;
        case 'part':
          totals.partsCost += amount;
          totals.totalCost += amount;
          break;
        case 'fluid':
          totals.fluidsCost += amount;
          totals.totalCost += amount;
          break;
        case 'tax':
          totals.taxCost += amount;
          totals.totalCost += amount;
          break;
        case 'discount':
          totals.discountAmount += amount;
          totals.totalCost -= amount;
          break;
        default:
          totals.totalCost += amount;
          break;
      }

      return totals;
    },
    {
      totalCost: 0,
      laborCost: 0,
      partsCost: 0,
      fluidsCost: 0,
      taxCost: 0,
      discountAmount: 0,
    },
  );

  return {
    totalCost: roundMoney(totals.totalCost),
    laborCost: roundMoney(totals.laborCost),
    partsCost: roundMoney(totals.partsCost),
    fluidsCost: roundMoney(totals.fluidsCost),
    taxCost: roundMoney(totals.taxCost),
    discountAmount: roundMoney(totals.discountAmount),
  };
}

export function resolveMaintenanceLineItemTotal(lineItem: MaintenanceLineItemLike) {
  if (typeof lineItem.lineTotal === 'number') {
    return roundMoney(lineItem.lineTotal);
  }

  if (typeof lineItem.quantity === 'number' && typeof lineItem.unitPrice === 'number') {
    return roundMoney(lineItem.quantity * lineItem.unitPrice);
  }

  return 0;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isMeaningfulMaintenanceLineItem(lineItem: MaintenanceLineItemLike) {
  return Boolean(
    lineItem.name?.trim() ||
    lineItem.normalizedCategory ||
    lineItem.brand?.trim() ||
    lineItem.partNumber?.trim() ||
    lineItem.unit?.trim() ||
    lineItem.notes?.trim() ||
    typeof lineItem.quantity === 'number' ||
    typeof lineItem.unitPrice === 'number' ||
    typeof lineItem.lineTotal === 'number',
  );
}
