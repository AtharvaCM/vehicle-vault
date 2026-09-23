import {
  complianceDocumentKinds,
  type ComplianceDocumentKind,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

export const documentKindTitles: Record<VehicleDocumentKind, string> = {
  insurance: 'Insurance policy',
  warranty: 'Warranty coverage',
  registration: 'Registration certificate',
  puc: 'PUC certificate',
  road_tax: 'Road tax',
};

/** Short noun for toasts: "Registration added", "PUC certificate removed". */
export const documentKindNouns: Record<VehicleDocumentKind, string> = {
  insurance: 'Policy',
  warranty: 'Warranty',
  registration: 'Registration',
  puc: 'PUC certificate',
  road_tax: 'Road tax record',
};

export const complianceNumberLabels: Record<ComplianceDocumentKind, string> = {
  registration: 'RC number',
  puc: 'Certificate number',
  road_tax: 'Receipt number',
};

export function isComplianceKind(kind: VehicleDocumentKind): kind is ComplianceDocumentKind {
  return (complianceDocumentKinds as readonly string[]).includes(kind);
}
