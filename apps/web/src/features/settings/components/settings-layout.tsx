import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';

/** One group of Settings rows under its heading. */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const id = `settings-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 className="px-1 text-body font-semibold text-fg-2" id={id}>
        {title}
      </h2>
      <Card className="divide-y divide-line-subtle p-0">{children}</Card>
    </section>
  );
}

/** A Settings row owns one decision: what it is, how it stands, and the way to change it. */
export function SettingsRow({
  label,
  value,
  action,
}: {
  label: ReactNode;
  value: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
      data-testid="settings-row"
    >
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-fg">{label}</p>
        <div className="text-small text-fg-2">{value}</div>
      </div>
      {action ? <div className="shrink-0 sm:-mr-2">{action}</div> : null}
    </div>
  );
}
