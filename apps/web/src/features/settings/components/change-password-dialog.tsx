import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { accountSecurityQueryOptions, changePassword } from '../api/account-security';
import { sessionsQueryOptions } from '../api/sessions';

type ChangePasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** False for an account that only signs in with Google or GitHub: it sets a first one. */
  hasPassword: boolean;
};

function schemaFor(hasPassword: boolean) {
  return z
    .object({
      currentPassword: hasPassword ? z.string().min(1, 'Enter your current password') : z.string(),
      newPassword: z
        .string()
        .min(8, 'Use at least 8 characters')
        .max(72, 'Use at most 72 characters'),
      confirmPassword: z.string(),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: 'The two passwords do not match',
      path: ['confirmPassword'],
    });
}

type Values = { currentPassword: string; newPassword: string; confirmPassword: string };

/**
 * Change the password (or set a first one) without leaving the app. On success
 * this device keeps its session, with the fresh tokens the API returns, and
 * every other device is signed out.
 */
export function ChangePasswordDialog({
  open,
  onOpenChange,
  hasPassword,
}: ChangePasswordDialogProps) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schemaFor(hasPassword)),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const mutation = useMutation({ mutationFn: changePassword });
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (values) => {
    try {
      const session = await mutation.mutateAsync({
        ...(hasPassword ? { currentPassword: values.currentPassword } : {}),
        newPassword: values.newPassword,
      });
      auth.setSession(session);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountSecurityQueryOptions().queryKey }),
        queryClient.invalidateQueries({ queryKey: sessionsQueryOptions().queryKey }),
      ]);
      appToast.success({
        title: hasPassword ? 'Password changed' : 'Password set',
        description: 'Any other device signed in to your account has been signed out.',
      });
      form.reset();
      onOpenChange(false);
    } catch {
      // Shown in the dialog, under the fields.
    }
  });

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          form.reset();
          mutation.reset();
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasPassword ? 'Change password' : 'Set a password'}</DialogTitle>
          <DialogDescription>
            {hasPassword
              ? 'Other devices will be signed out; this one stays signed in.'
              : 'Sign in with your email as well as Google or GitHub.'}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={submit}>
          {hasPassword ? (
            <FormField
              error={errors.currentPassword?.message}
              htmlFor="current-password"
              label="Current password"
            >
              <Input
                autoComplete="current-password"
                id="current-password"
                type="password"
                {...form.register('currentPassword')}
              />
            </FormField>
          ) : null}
          <FormField
            error={errors.newPassword?.message}
            htmlFor="new-password"
            label="New password"
          >
            <Input
              autoComplete="new-password"
              id="new-password"
              type="password"
              {...form.register('newPassword')}
            />
          </FormField>
          <FormField
            error={errors.confirmPassword?.message}
            htmlFor="confirm-password"
            label="New password again"
          >
            <Input
              autoComplete="new-password"
              id="confirm-password"
              type="password"
              {...form.register('confirmPassword')}
            />
          </FormField>
          {mutation.isError ? (
            <InlineError
              message={getApiErrorMessage(mutation.error, 'Your password could not be changed.')}
            />
          ) : null}
          <DialogFooter>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
