import * as Sentry from '@sentry/react';
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';

import { RecoveryScreen } from './recovery-screen';

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { error: unknown };

/**
 * The last line: anything that throws outside a route — a provider, the router
 * itself — and would otherwise leave a blank white page.
 *
 * Hand-rolled rather than `Sentry.ErrorBoundary` so it reports through the same
 * `captureException` call as the route boundary, and so it can reset on back and
 * forward. With the router possibly the thing that broke, its "go to dashboard"
 * is a full page load rather than a client-side navigation.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  private readonly reset = () => this.setState({ error: null });

  render() {
    if (this.state.error !== null) {
      return <AppErrorFallback onNavigate={this.reset} />;
    }

    return this.props.children;
  }
}

function AppErrorFallback({ onNavigate }: { onNavigate: () => void }) {
  useEffect(() => {
    window.addEventListener('popstate', onNavigate);
    return () => window.removeEventListener('popstate', onNavigate);
  }, [onNavigate]);

  return <RecoveryScreen onGoToDashboard={() => window.location.assign('/home')} />;
}
