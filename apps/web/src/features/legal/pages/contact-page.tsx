import { useMutation } from '@tanstack/react-query';
import { ContactMessageInputSchema } from '@vehicle-vault/shared';
import { useContext, useState, type FormEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { InlineError } from '@/components/shared/inline-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { AuthContext } from '@/features/auth/providers/auth-provider';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';

import { sendContactMessage } from '../api/contact';

type Field = 'name' | 'email' | 'message';

/**
 * /contact (#341): a form only, no address shown. The message is stored, listed
 * in the admin area, and mailed to the admins once production mail is on. A
 * signed-in visitor starts with their name and email filled in.
 */
export function ContactPage() {
  useDocumentTitle('Contact | Vehicle Vault');
  const user = useContext(AuthContext)?.user ?? null;
  const [values, setValues] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    message: '',
    website: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const mutation = useMutation({ mutationFn: sendContactMessage });

  function set(field: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = ContactMessageInputSchema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        next[field] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    await mutation.mutateAsync(parsed.data).catch(() => undefined);
  }

  if (mutation.isSuccess) {
    return (
      <AuthPageShell
        alternateAction={null}
        description="We read every message and reply to the email you gave."
        title="Thanks, it’s sent"
      >
        <div data-testid="contact-sent" />
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      alternateAction={null}
      description="A question, a wrong spec, an idea, or a request about your data."
      title="Contact"
    >
      <form className="space-y-4" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <FormField error={errors.name} htmlFor="contact-name" label="Your name">
          <Input
            aria-invalid={Boolean(errors.name)}
            autoComplete="name"
            id="contact-name"
            onChange={(event) => set('name', event.target.value)}
            value={values.name}
          />
        </FormField>
        <FormField error={errors.email} htmlFor="contact-email" label="Email to reply to">
          <Input
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            id="contact-email"
            inputMode="email"
            onChange={(event) => set('email', event.target.value)}
            type="email"
            value={values.email}
          />
        </FormField>
        <FormField error={errors.message} htmlFor="contact-message" label="Message">
          <Textarea
            aria-invalid={Boolean(errors.message)}
            id="contact-message"
            maxLength={4000}
            onChange={(event) => set('message', event.target.value)}
            rows={6}
            value={values.message}
          />
        </FormField>
        {/* A field people never see: anything in it came from a bot. */}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor="contact-website">Website</label>
          <input
            autoComplete="off"
            id="contact-website"
            onChange={(event) => set('website', event.target.value)}
            tabIndex={-1}
            value={values.website}
          />
        </div>
        {mutation.isError ? (
          <InlineError
            message={getApiErrorMessage(
              mutation.error,
              "We couldn't send that. Try again in a moment.",
            )}
          />
        ) : null}
        <Button className="w-full" disabled={mutation.isPending} size="lg" type="submit">
          {mutation.isPending ? 'Sending…' : 'Send message'}
        </Button>
      </form>
    </AuthPageShell>
  );
}
