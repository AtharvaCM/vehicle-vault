import { CarFront, ShieldCheck } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { PageTitle } from '@/components/shared/page-title';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils/format-date';

import { useAdminUsers } from '../hooks/use-admin-users';

export function AdminUsersPage() {
  const query = useAdminUsers();

  return (
    <PageContainer>
      <PageTitle
        description="Every account in Vehicle Vault, newest first."
        title="Users"
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-lg font-bold">All users</CardTitle>
          {query.data ? (
            <Badge variant="neutral">{query.data.users.length} total</Badge>
          ) : null}
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
            <p className="text-sm text-rose-600">Could not load users. Try again.</p>
          ) : null}

          {query.data && query.data.users.length === 0 ? (
            <p className="text-sm text-slate-500">No users yet.</p>
          ) : null}

          {query.data && query.data.users.length > 0 ? (
            <ul className="divide-y divide-slate-200/60">
              {query.data.users.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {user.name}
                      </p>
                      {user.role === 'admin' ? (
                        <Badge variant="accent">
                          <ShieldCheck />
                          Admin
                        </Badge>
                      ) : null}
                      {user.emailVerified ? null : (
                        <Badge variant="warning">Unverified</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CarFront className="h-3.5 w-3.5" />
                      {user.vehicleCount}
                    </span>
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
