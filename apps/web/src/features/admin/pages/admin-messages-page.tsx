import { useQuery } from '@tanstack/react-query';

import { PageContainer } from '@/components/layout/page-container';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingState } from '@/components/shared/loading-state';
import { PageTitle } from '@/components/shared/page-title';
import { contactMessagesQueryOptions } from '@/features/legal/api/contact';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { format } from '@/lib/format';

import { AdminSectionNav } from '../components/admin-section-nav';

/** Messages from the public Contact page, newest first (#341). Reply by email. */
export function AdminMessagesPage() {
  const query = useQuery(contactMessagesQueryOptions());

  return (
    <PageContainer>
      <PageTitle description="What people sent from the Contact page." title="Messages" />
      <AdminSectionNav />
      {query.isPending ? (
        <LoadingState description="Loading the messages." title="Loading" />
      ) : query.isError ? (
        <ErrorState
          description={getApiErrorMessage(query.error, "We couldn't load the messages.")}
          title="Couldn’t load messages"
        />
      ) : query.data.length === 0 ? (
        <EmptyState
          description="Nothing has come in from the Contact page yet."
          title="No messages"
        />
      ) : (
        <ul className="divide-y divide-line-subtle rounded-card border border-line bg-surface">
          {query.data.map((message) => (
            <li className="space-y-1 px-4 py-3" data-testid="admin-message" key={message.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-ui font-semibold text-fg">
                  {message.name}{' '}
                  <a
                    className="font-normal text-brand underline-offset-4 hover:underline"
                    href={`mailto:${message.email}`}
                  >
                    {message.email}
                  </a>
                </p>
                <p className="text-caption text-fg-3">{format.date(message.createdAt)}</p>
              </div>
              <p className="whitespace-pre-wrap text-ui text-fg-2">{message.message}</p>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
