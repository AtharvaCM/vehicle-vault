import { useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { appToast } from '@/lib/toast';

/** Signing out from the shell: the account menu and the phone's More sheet. */
export function useSignOut() {
  const auth = useAuth();
  const navigate = useNavigate();

  return async () => {
    auth.logout();
    appToast.info({
      title: 'Signed out',
      description: 'Your Vehicle Vault session has been cleared.',
    });
    await navigate({ to: '/login' });
  };
}

/** Initials for the avatar: "Asha Kulkarni" → "AK", one name → its first letter. */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const letters = words.length === 1 ? [words[0]!] : [words[0]!, words[words.length - 1]!];
  return letters.map((word) => word.charAt(0).toUpperCase()).join('');
}
