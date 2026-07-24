import {
  complianceDocumentKinds,
  type ComplianceDocumentKind,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

export const documentKindTitles: Record<VehicleDocumentKind, string> = {
  insurance: 'Insurance Policy',
  warranty: 'Warranty Coverage',
  registration: 'Registration Certificate',
  puc: 'PUC Certificate',
  road_tax: 'Road Tax',
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
  registration: 'RC Number',
  puc: 'Certificate Number',
  road_tax: 'Receipt Number',
};

export function isComplianceKind(kind: VehicleDocumentKind): kind is ComplianceDocumentKind {
  return (complianceDocumentKinds as readonly string[]).includes(kind);
}
