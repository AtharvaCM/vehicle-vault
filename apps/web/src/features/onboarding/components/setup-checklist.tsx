import { Link } from '@tanstack/react-router';
import type { DashboardVehicleHealth } from '@vehicle-vault/shared';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useResendVerification } from '@/features/auth/hooks/use-resend-verification';
import { cn } from '@/lib/utils';

import type { SetupStep, SetupStepId } from '../lib/setup-steps';

const TITLES: Record<SetupStepId, string> = {
  account: 'Create your account',
  vehicle: 'Add your vehicle',
  papers: 'Add insurance and PUC expiry',
  service: 'Log your last service',
  email: 'Verify your email',
};

type SetupChecklistProps = {
  heading: string;
  steps: SetupStep[];
  /** The vehicle the papers and service steps open; null before there is one. */
  vehicle: Pick<DashboardVehicleHealth, 'id'> | null;
  /** Days left to verify, while the grace period runs. */
  verifyDaysLeft: number | null;
};

const actionClass = cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'shrink-0');

/**
 * Home for a new account (#346): the steps to a first live reminder, each one
 * tap into its form, until every one is done. It carries the email check too,
 * so a new account sees one list rather than a list, a banner and a toast.
 */
export function SetupChecklist({ heading, steps, vehicle, verifyDaysLeft }: SetupChecklistProps) {
  const { user } = useAuth();
  const { resend, isResending, hasSent } = useResendVerification(user?.email);
  const doneCount = steps.filter((step) => step.done).length;
  const nextStep = steps.find((step) => !step.done)?.id;

  function action(id: SetupStepId): ReactNode {
    switch (id) {
      case 'account':
        return null;
      case 'vehicle':
        return (
          <Link
            className={
              id === nextStep ? cn(buttonVariants({ size: 'sm' }), 'shrink-0') : actionClass
            }
            to="/vehicles/new"
          >
            Add vehicle
          </Link>
        );
      case 'papers':
        return vehicle ? (
          <Link
            className={actionClass}
            params={{ vehicleId: vehicle.id }}
            search={{ tab: 'papers' }}
            to="/vehicles/$vehicleId"
          >
            Add dates
          </Link>
        ) : (
          <span className="text-small text-fg-3">After a vehicle</span>
        );
      case 'service':
        return vehicle ? (
          <Link
            className={actionClass}
            params={{ vehicleId: vehicle.id }}
            to="/vehicles/$vehicleId/maintenance/new"
          >
            Log service
          </Link>
        ) : (
          <span className="text-small text-fg-3">After a vehicle</span>
        );
      case 'email':
        return (
          <Button
            className="shrink-0"
            disabled={isResending || hasSent}
            onClick={() => void resend()}
            size="sm"
            variant="outline"
          >
            {isResending ? 'Sending…' : hasSent ? 'Sent' : 'Resend'}
          </Button>
        );
    }
  }

  return (
    <section
      aria-labelledby="setup-heading"
      className="rounded-card border border-line bg-surface"
      data-testid="setup-checklist"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-line-subtle px-5 py-3.5">
        <h2 className="font-semibold text-fg" id="setup-heading">
          {heading}
        </h2>
        <p className="shrink-0 text-small text-fg-3 tabular-nums">
          {doneCount} of {steps.length} done
        </p>
      </div>
      <ol className="divide-y divide-line-subtle">
        {steps.map((step) => (
          <li
            className="flex min-h-14 items-center gap-3 px-5 py-3"
            data-done={step.done || undefined}
            key={step.id}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border',
                step.done ? 'border-ok bg-ok text-surface' : 'border-line',
              )}
            >
              {step.done ? <Check className="size-3.5" /> : null}
            </span>
            <p
              className={cn(
                'min-w-0 flex-1 text-ui',
                step.done ? 'text-fg-3' : 'font-medium text-fg',
              )}
            >
              {TITLES[step.id]}
              {step.id === 'email' && !step.done && verifyDaysLeft !== null ? (
                <span className="font-normal text-fg-3">
                  {' '}
                  · {verifyDaysLeft <= 1 ? 'last day' : `${verifyDaysLeft} days left`}
                </span>
              ) : null}
              <span className="sr-only">{step.done ? ' (done)' : ' (to do)'}</span>
            </p>
            {step.done ? null : action(step.id)}
          </li>
        ))}
      </ol>
    </section>
  );
}
