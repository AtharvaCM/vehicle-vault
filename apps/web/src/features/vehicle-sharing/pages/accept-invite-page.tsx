import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { useAcceptInvite } from '../hooks/use-sharing';

type Props = { token: string };

export function AcceptInvitePage({ token }: Props) {
  const navigate = useNavigate();
  const acceptMutation = useAcceptInvite();
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current || !token) return;
    triggered.current = true;
    acceptMutation.mutate(token, {
      onSuccess: (result) => {
        appToast.success({
          title: 'Invitation accepted',
          description: `You now have ${result.role} access to this vehicle.`,
        });
        void navigate({ to: '/vehicles/$vehicleId', params: { vehicleId: result.vehicleId } });
      },
      onError: (err) => {
        setError(getApiErrorMessage(err, 'Unable to accept invitation.'));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <PageContainer className="py-12">
      <Card className="mx-auto max-w-md border-slate-200/60 bg-white shadow-premium-sm">
        <CardHeader>
          <CardTitle>Accepting invitation</CardTitle>
          <CardDescription>
            {error ? 'Something went wrong.' : 'Validating your invitation token…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <>
              <p className="text-sm text-rose-700">{error}</p>
              <Button onClick={() => navigate({ to: '/dashboard' })}>Go to dashboard</Button>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {acceptMutation.isPending ? 'One moment…' : 'Redirecting…'}
            </p>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
