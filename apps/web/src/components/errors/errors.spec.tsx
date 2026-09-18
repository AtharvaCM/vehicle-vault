import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ current: { isAuthenticated: false } }));

vi.mock('@sentry/react', () => ({ captureException }));
vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => auth.current }));
// The real shell pulls in the sidebar, topbar and their queries; what matters
// here is only whether the not-found page chose to render inside it.
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

import { AppErrorBoundary } from './app-error-boundary';
import { NotFoundScreen } from './not-found-screen';
import { RecoveryScreen } from './recovery-screen';
import { RouteError } from './route-error';

/** Flipped by tests to make the "broken" page start rendering again. */
const broken = { current: true };

function Boom() {
  if (broken.current) throw new Error('kaboom');
  return <p>page is fine now</p>;
}

/** The same two router defaults the app registers, on a tiny route tree. */
function renderAt(path: string) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const routeTree = root.addChildren([
    createRoute({ getParentRoute: () => root, path: '/boom', component: Boom }),
    createRoute({ getParentRoute: () => root, path: '/ok', component: () => <p>ok page</p> }),
    createRoute({
      getParentRoute: () => root,
      path: '/dashboard',
      component: () => <p>dashboard page</p>,
    }),
    createRoute({ getParentRoute: () => root, path: '/login', component: () => <p>login page</p> }),
  ]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFoundScreen,
  });

  render(<RouterProvider router={router} />);
  return router;
}

describe('route errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    broken.current = true;
    // React reports every error a boundary catches; that noise is the point here.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the recovery screen instead of a blank page when a page throws', async () => {
    renderAt('/boom');

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it('sends the error to the error-reporting client', async () => {
    renderAt('/boom');
    await screen.findByText('Something went wrong');

    expect(captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'kaboom' }));
  });

  it('clears as soon as the user navigates somewhere else', async () => {
    const router = renderAt('/boom');
    await screen.findByText('Something went wrong');

    // The app registers its route tree globally, so a typed `navigate` only accepts
    // the app's paths; this test tree's paths go through the history instead.
    await act(async () => {
      router.history.push('/ok');
    });

    expect(await screen.findByText('ok page')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('takes the user to the dashboard from the recovery screen', async () => {
    renderAt('/boom');
    fireEvent.click(await screen.findByRole('button', { name: /go to dashboard/i }));

    expect(await screen.findByText('dashboard page')).toBeInTheDocument();
  });
});

describe('RecoveryScreen', () => {
  it('reloads when asked to', () => {
    const onReload = vi.fn();
    render(<RecoveryScreen onGoToDashboard={vi.fn()} onReload={onReload} />);

    fireEvent.click(screen.getByRole('button', { name: /reload/i }));

    expect(onReload).toHaveBeenCalledTimes(1);
  });
});

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    broken.current = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children untouched when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>all good</p>
      </AppErrorBoundary>,
    );

    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('catches what throws outside any route and reports it with the component stack', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'kaboom' }),
      expect.objectContaining({ extra: { componentStack: expect.any(String) } }),
    );
  });

  it('clears on back or forward, since the router may be what broke', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    broken.current = false;
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByText('page is fine now')).toBeInTheDocument();
  });
});

describe('unknown addresses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a signed-in user a 404 inside the app shell, pointing at the dashboard', async () => {
    auth.current = { isAuthenticated: true };
    renderAt('/no-such-page');

    expect(await screen.findByText('Page not found')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('shows a guest a public 404 that points at sign-in', async () => {
    auth.current = { isAuthenticated: false };
    renderAt('/no-such-page');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /sign in/i })[0]).toHaveAttribute('href', '/login');
  });
});

describe('the app router', () => {
  it('registers both defaults, so every route without its own gets them', async () => {
    const { router } = await import('@/app/router');

    expect(router.options.defaultErrorComponent).toBe(RouteError);
    expect(router.options.defaultNotFoundComponent).toBe(NotFoundScreen);
  });
});
