export const VehicleRole = {
  Owner: 'owner',
  Editor: 'editor',
  Viewer: 'viewer',
} as const;

export type VehicleRole = (typeof VehicleRole)[keyof typeof VehicleRole];
