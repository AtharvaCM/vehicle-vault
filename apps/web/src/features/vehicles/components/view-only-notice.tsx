import { Eye } from 'lucide-react';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/shared/empty-state';

type ViewOnlyNoticeProps = {
  /** What this page would have let an editor do, in the page's own words. */
  description: string;
  /** Usually the link back to the record the viewer came from. */
  action?: ReactNode;
};

/**
 * Stands in for a form a viewer cannot submit. The API refuses the write, so
 * rendering the form would only collect edits and then 403 on save; this says
 * why the page is empty and how to get access, in the same words everywhere.
 */
export function ViewOnlyNotice({ action, description }: ViewOnlyNoticeProps) {
  return (
    <EmptyState
      action={action}
      description={`${description} Ask the vehicle's owner for editor access if you need to make changes.`}
      icon={Eye}
      title="You have view-only access"
    />
  );
}
