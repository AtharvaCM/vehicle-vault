import { Link } from '@tanstack/react-router';
import { APP_NAME } from '@vehicle-vault/shared';
import { Compass } from 'lucide-react';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { AuthPageLink, AuthPageShell } from '@/features/auth/components/auth-page-shell';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useDocumentTitle } from '@/hooks/use-document-title';

/**
 * The router's default not-found component. An unknown address matches nothing
 * below the root, so this renders at the root for everyone — and chooses its own
 * frame: inside the app shell for someone signed in, so the sidebar is still
 * there, and in the public frame for a guest, pointing home and at the catalog.
 */
export function NotFoundScreen() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    // A way forward, not only a way in (#365): home and the catalog, with
    // Sign in below for anyone who has an account.
    return (
      <AuthPageShell
        alternateAction={<AuthPageLink label="Sign in" text="Have an account?" to="/login" />}
        description="There is nothing at this address. It may have moved, or the link may be mistyped."
        title="Page not found"
      >
        <div className="grid gap-2">
          <Button asChild className="w-full">
            <Link to="/">Go to the home page</Link>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <Link to="/cars">Browse cars</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/bikes">Browse bikes</Link>
            </Button>
          </div>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AppShell>
      <InShellNotFound />
    </AppShell>
  );
}

function InShellNotFound() {
  useDocumentTitle(`Page not found | ${APP_NAME}`);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-page ring-8 ring-page/60">
        <Compass aria-hidden="true" className="h-6 w-6 text-fg-2" />
      </div>
      <h1 className="text-heading font-semibold text-fg">Page not found</h1>
      <p className="text-ui leading-6 text-fg-2">
        There is nothing at this address. It may have moved, or the link may be mistyped.
      </p>
      <Button asChild>
        <Link to="/home">Back to Home</Link>
      </Button>
    </div>
  );
}
