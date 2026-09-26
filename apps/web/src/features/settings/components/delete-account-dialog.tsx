import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Download } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';

import { InlineError } from '@/components/shared/inline-error';
import { LoadingState } from '@/components/shared/loading-state';
import { PasswordInput } from '@/components/shared/password-input';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { OAuthButtons } from '@/features/auth/components/oauth-buttons';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { accountDeletionCheckQueryOptions, deleteAccount } from '../api/account-deletion';

type DeleteAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Downloads the JSON backup, offered before anything goes. */
  onExport: () => void;
  isExporting: boolean;
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Settings → Delete account (#317). Nothing is deleted while a vehicle the
 * owner has shared is still theirs: the dialog lists them, to hand over first.
 * Otherwise it says what goes, offers the backup, and asks for the password (or,
 * with no password, a fresh sign-in) before deleting at once and signing out.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  onExport,
  isExporting,
}: DeleteAccountDialogProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const check = useQuery({ ...accountDeletionCheckQueryOptions(), enabled: open });
  const mutation = useMutation({ mutationFn: deleteAccount });

  function close(next: boolean) {
    if (!next) {
      setPassword('');
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (check.data?.hasPassword && !password) {
      setError('Enter your password to confirm.');
      return;
    }
    try {
      await mutation.mutateAsync(check.data?.hasPassword ? { password } : {});
      // Committed now, so the router's context reads signed out before it navigates.
      flushSync(() => auth.logout());
      appToast.success({
        title: 'Account deleted',
        description: 'Your account and everything in it are gone.',
      });
      await navigate({ to: '/login' });
    } catch (caught) {
      setError(getApiErrorMessage(caught, "We couldn't delete your account. Try again."));
    }
  }

  const data = check.data;
  const blocked = Boolean(data?.sharedVehicles.length);

  return (
    <Dialog onOpenChange={close} open={open}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            {blocked
              ? 'Other people use some of your vehicles. Hand them over, or stop sharing them, first.'
              : 'This happens at once and can’t be undone.'}
          </DialogDescription>
        </DialogHeader>

        {check.isPending ? (
          <LoadingState description="Checking what your account holds." title="Checking" />
        ) : check.isError ? (
          <InlineError
            message={getApiErrorMessage(check.error, "We couldn't check your account.")}
          />
        ) : blocked && data ? (
          <ul className="space-y-2" data-testid="delete-account-shared">
            {data.sharedVehicles.map((vehicle) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line px-3 py-2"
                key={vehicle.id}
              >
                <span className="text-ui text-fg">
                  <span className="font-semibold">{vehicle.label}</span>
                  <span className="text-fg-3">
                    {' '}
                    · shared with {plural(vehicle.otherMembers, 'person', 'people')}
                  </span>
                </span>
                <Link
                  className={buttonVariants({ size: 'sm', variant: 'outline' })}
                  params={{ vehicleId: vehicle.id }}
                  search={{ tab: 'more', section: 'members' }}
                  to="/vehicles/$vehicleId"
                >
                  Members
                </Link>
              </li>
            ))}
          </ul>
        ) : data ? (
          <form
            className="space-y-4"
            id="delete-account-form"
            noValidate
            onSubmit={(event) => void handleSubmit(event)}
          >
            <p className="text-ui text-fg-2" data-testid="delete-account-what-goes">
              {`Goes with it: ${plural(data.vehicleCount, 'vehicle', 'vehicles')} with their service history, reminders, fuel and papers, ${plural(data.fileCount, 'stored file', 'stored files')}, and your sign-in on every device.`}
            </p>
            <Button
              disabled={isExporting}
              onClick={onExport}
              size="sm"
              type="button"
              variant="outline"
            >
              <Download aria-hidden="true" />
              {isExporting ? 'Preparing…' : 'Download your data first'}
            </Button>
            {data.hasPassword ? (
              <div className="space-y-1.5">
                <Label htmlFor="delete-account-password">Password</Label>
                <PasswordInput
                  autoComplete="current-password"
                  id="delete-account-password"
                  onChange={(event) => setPassword(event.target.value)}
                  value={password}
                />
              </div>
            ) : data.needsFreshSignIn ? (
              <div className="space-y-2">
                <p className="text-ui text-fg-2">
                  Sign in again to confirm it’s you, then come back here.
                </p>
                <OAuthButtons next="/settings" />
              </div>
            ) : null}
            {error ? <InlineError message={error} /> : null}
          </form>
        ) : null}

        <DialogFooter>
          <Button onClick={() => close(false)} type="button" variant="ghost">
            {blocked ? 'Close' : 'Cancel'}
          </Button>
          {data && !blocked && !data.needsFreshSignIn ? (
            <Button
              disabled={mutation.isPending}
              form="delete-account-form"
              type="submit"
              variant="destructive"
            >
              {mutation.isPending ? 'Deleting…' : 'Delete my account'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
