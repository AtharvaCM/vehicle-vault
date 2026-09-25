/**
 * A line under the sign-in title saying what signing in is for, when a return
 * path (`?next`) says where the visitor was going: "to accept your vehicle
 * invite". Null for an ordinary sign-in.
 */
export function nextContext(next: string | undefined): string | null {
  if (!next) return null;
  const path = next.split(/[?#]/)[0] ?? '';

  if (path.startsWith('/vehicle-invites/')) return 'to accept your vehicle invite';
  if (path.startsWith('/reminders/')) return 'to open that reminder';
  if (path.startsWith('/maintenance-records/')) return 'to open that service record';
  if (path.startsWith('/vehicles/new')) return 'to add your vehicle';
  if (path.startsWith('/vehicles/')) return 'to open that vehicle';
  if (path.startsWith('/settings')) return 'to open your settings';
  return 'to carry on where you were';
}
