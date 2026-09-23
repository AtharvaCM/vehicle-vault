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
  status: z.enum(['pending', 'accepted', 'revoked', 'expired', 'declined']),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  declinedAt: z.string().nullable(),
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

/**
 * What the owner gets back after inviting someone: the invite, the link to
 * share it with (always, since email may not reach them), and whether an
 * email actually went out.
 */
export const VehicleInviteCreatedSchema = z.object({
  invite: VehicleInviteSchema,
  acceptUrl: z.string().url(),
  emailSent: z.boolean(),
});
export type VehicleInviteCreated = z.infer<typeof VehicleInviteCreatedSchema>;

/**
 * An invite as the person holding its link sees it, signed in or not: enough
 * to decide, without revealing the invited address in full.
 */
export const VehicleInvitePreviewSchema = z.object({
  status: VehicleInviteSchema.shape.status,
  vehicleLabel: z.string(),
  inviterName: z.string(),
  role: VehicleRoleSchema,
  /** `r***@gmail.com`. */
  emailMasked: z.string(),
  expiresAt: z.string(),
  /** Only when asked signed in: whether the invite is addressed to this account. */
  addressedToYou: z.boolean().optional(),
});
export type VehicleInvitePreview = z.infer<typeof VehicleInvitePreviewSchema>;

export const UpdateVehicleMemberSchema = z.object({
  role: z.union([z.literal(VehicleRole.Editor), z.literal(VehicleRole.Viewer)]),
});
export type UpdateVehicleMemberInput = z.infer<typeof UpdateVehicleMemberSchema>;

export const TransferVehicleOwnershipSchema = z.object({
  memberId: z.string().uuid(),
});
export type TransferVehicleOwnershipInput = z.infer<typeof TransferVehicleOwnershipSchema>;
