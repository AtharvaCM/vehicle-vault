import { useMutation } from '@tanstack/react-query';
import { ProfileUpdateSchema } from '@vehicle-vault/shared';
import { Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { updateProfile } from '../api/profile';
import { SettingsRow } from './settings-layout';

/** Settings → Profile's name: read, or edited in place with Save and Cancel. */
export function NameRow() {
  const auth = useAuth();
  const name = auth.user?.name ?? '';
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: updateProfile,
    // The session keeps a copy of the account: read it again so the shell's name follows.
    onSuccess: () => auth.refreshUser(),
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = ProfileUpdateSchema.safeParse({ name: draft ?? '' });
    if (!parsed.success) {
      setError('Enter a name, up to 120 characters.');
      return;
    }
    try {
      await mutation.mutateAsync(parsed.data);
      setDraft(null);
      setError(null);
      appToast.success({ title: 'Name saved', description: `You're ${parsed.data.name} now.` });
    } catch (caught) {
      setError(getApiErrorMessage(caught, "We couldn't save your name. Try again in a moment."));
    }
  }

  if (draft === null) {
    return (
      <SettingsRow
        action={
          <Button onClick={() => setDraft(name)} size="sm" type="button" variant="ghost">
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        }
        label="Name"
        value={name || '—'}
      />
    );
  }

  return (
    <form className="space-y-3 px-5 py-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <label className="block text-body font-medium text-fg" htmlFor="settings-name">
        Name
      </label>
      <Input
        aria-invalid={Boolean(error)}
        autoComplete="name"
        autoFocus
        id="settings-name"
        maxLength={120}
        onChange={(event) => setDraft(event.target.value)}
        value={draft}
      />
      {error ? <InlineError message={error} /> : null}
      <div className="flex gap-2">
        <Button disabled={mutation.isPending} size="sm" type="submit">
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          onClick={() => {
            setDraft(null);
            setError(null);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
