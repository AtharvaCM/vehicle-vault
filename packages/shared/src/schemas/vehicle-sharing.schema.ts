import { z } from 'zod';

import { VehicleRole } from '../enums/vehicle-role.enum';

const VehicleRoleSchema = z.nativeEnum(VehicleRole);

export const VehicleMemberSchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  userId: z.string().uuid(),
  role: VehicleRoleSchema,
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string(),
  isSelf: z.boolean(),
});
export type VehicleMember = z.infer<typeof VehicleMemberSchema>;

export const VehicleInviteSchema = z.object({
  id: z.string().uuid(),
  vehicleId: z.string().uuid(),
  email: z.string().email(),
  role: VehicleRoleSchema,
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  invitedByUserId: z.string().uuid(),
  createdAt: z.string(),
});
export type VehicleInvite = z.infer<typeof VehicleInviteSchema>;

export const CreateVehicleInviteSchema = z.object({
  email: z.string().email().max(255),
  role: z.union([z.literal(VehicleRole.Editor), z.literal(VehicleRole.Viewer)]),
});
export type CreateVehicleInviteInput = z.infer<typeof CreateVehicleInviteSchema>;

export const AcceptVehicleInviteSchema = z.object({
  token: z.string().min(16),
});
export type AcceptVehicleInviteInput = z.infer<typeof AcceptVehicleInviteSchema>;

export const UpdateVehicleMemberSchema = z.object({
  role: z.union([z.literal(VehicleRole.Editor), z.literal(VehicleRole.Viewer)]),
});
export type UpdateVehicleMemberInput = z.infer<typeof UpdateVehicleMemberSchema>;

export const TransferVehicleOwnershipSchema = z.object({
  memberId: z.string().uuid(),
});
export type TransferVehicleOwnershipInput = z.infer<typeof TransferVehicleOwnershipSchema>;
