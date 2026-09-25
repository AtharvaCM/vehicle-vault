import type { VehicleRole } from '@vehicle-vault/shared';

/**
 * Each role's name and what it can do, in plain words — the one place this
 * copy lives, so the invite dialog, the members list and the invite preview
 * an invitee opens (signed in or not) all say the same thing.
 */
export const ROLE_COPY: Record<VehicleRole, { label: string; title: string; detail: string }> = {
  viewer: {
    label: 'Viewer',
    title: 'can view',
    detail: 'Sees papers, history and reminders.',
  },
  editor: {
    label: 'Editor',
    title: 'can edit',
    detail: 'Can also log services, fuel and papers.',
  },
  owner: {
    label: 'Owner',
    title: 'owns',
    detail: 'Full control — can invite, change roles, remove people and delete the vehicle.',
  },
};

export type EditableRole = Exclude<VehicleRole, 'owner'>;

export const EDITABLE_ROLES: EditableRole[] = ['editor', 'viewer'];
