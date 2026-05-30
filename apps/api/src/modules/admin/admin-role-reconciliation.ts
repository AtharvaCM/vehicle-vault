type ReconciliationInput = {
  currentAdminEmails: string[];
  desiredAdminEmails: string[];
};

export type AdminRoleReconciliation = {
  promote: string[];
  demote: string[];
};

function normalise(emails: string[]): string[] {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export function computeAdminRoleReconciliation(
  input: ReconciliationInput,
): AdminRoleReconciliation {
  const current = new Set(normalise(input.currentAdminEmails));
  const desired = new Set(normalise(input.desiredAdminEmails));

  return {
    promote: [...desired].filter((email) => !current.has(email)),
    demote: [...current].filter((email) => !desired.has(email)),
  };
}
