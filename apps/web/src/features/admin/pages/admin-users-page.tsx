import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CarFront, LogOut, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import { PageTitle } from '@/components/shared/page-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';
import { queryKeys } from '@/lib/query/query-keys';
import { appToast } from '@/lib/toast';

import { forceLogoutUser } from '../api/force-logout-user';
import { AdminSectionNav } from '../components/admin-section-nav';
import { useAdminUsers } from '../hooks/use-admin-users';

const PAGE_SIZE = 25;

export function AdminUsersPage() {
  const currentUserId = useAuth().user?.id;
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const query = useAdminUsers({ search: search || undefined, page, limit: PAGE_SIZE });

  const forceLogoutMutation = useMutation({
    mutationFn: (userId: string) => forceLogoutUser(userId),
    onSuccess: async (result) => {
      appToast.success({
        title: 'Session invalidated',
        description: result.refreshTokenCleared
          ? 'Refresh token cleared. User must sign in again.'
          : 'User had no active session.',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all() });
    },
    onError: (error) => {
      appToast.error({
        title: 'Force sign-out failed',
        description: getApiErrorMessage(error),
      });
    },
  });

  const meta = query.data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageContainer>
      <PageTitle description="Search, audit, and force-sign-out user accounts." title="Users" />
      <AdminSectionNav />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lead font-bold">All users</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
              <Input
                className="w-full pl-8 sm:w-64"
                placeholder="Search by email or name"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </div>
            {query.data ? <Badge variant="neutral">{total} total</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}

          {query.isError ? (
            <p className="text-ui text-late">Could not load users. Try again.</p>
          ) : null}

          {query.data && query.data.users.length === 0 ? (
            <p className="text-ui text-fg-3">
              {search ? `No users matching "${search}".` : 'No users yet.'}
            </p>
          ) : null}

          {query.data && query.data.users.length > 0 ? (
            <ul className="divide-y divide-line-subtle/60">
              {query.data.users.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-ui font-semibold text-fg">{user.name}</p>
                      {user.role === 'admin' ? (
                        <Badge variant="accent">
                          <ShieldCheck />
                          Admin
                        </Badge>
                      ) : null}
                      {user.id === currentUserId ? <Badge variant="neutral">You</Badge> : null}
                      {user.emailVerified ? (
                        <Badge variant="success">Verified</Badge>
                      ) : (
                        <Badge variant="warning">Not verified</Badge>
                      )}
                    </div>
                    <p className="truncate text-caption text-fg-3">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-fg-3">
                    <span className="inline-flex items-center gap-1">
                      <CarFront aria-hidden="true" className="h-3.5 w-3.5" />
                      {user.vehicleCount} {user.vehicleCount === 1 ? 'vehicle' : 'vehicles'}
                    </span>
                    <span>Joined {format.date(user.createdAt)}</span>
                    <span data-testid="admin-user-last-sign-in">
                      {user.lastSignInAt
                        ? `Last signed in ${format.date(user.lastSignInAt)}`
                        : 'No sign-in on record'}
                    </span>
                    {/* Your own row: signing yourself out is Settings' job, not an admin action. */}
                    {user.id === currentUserId ? null : (
                      <ConfirmActionDialog
                        confirmLabel="Force sign-out"
                        description={`Clears ${user.email}'s refresh token. They will need to sign in again on their next session refresh.`}
                        isPending={
                          forceLogoutMutation.isPending && forceLogoutMutation.variables === user.id
                        }
                        onConfirm={() => forceLogoutMutation.mutate(user.id)}
                        title="Force this user to sign out?"
                        triggerLabel="Force sign-out"
                        triggerIcon={<LogOut className="h-3.5 w-3.5" />}
                        triggerVariant="ghost"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {total > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between border-t border-line-subtle pt-4 text-caption text-fg-3">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= totalPages || query.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
