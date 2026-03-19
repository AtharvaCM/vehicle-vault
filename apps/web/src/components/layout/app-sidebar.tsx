import { Link } from '@tanstack/react-router';

import { cn } from '@/lib/utils/cn';

import { appNavigation } from './app-navigation';

export function AppSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="border-b border-slate-200 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Vehicle Vault
        </p>
        <h1 className="mt-2 text-lg font-semibold text-slate-950">Maintenance tracking</h1>
      </div>

      <nav className="flex flex-1 flex-col gap-2 px-4 py-6">
        {appNavigation.map((item) => (
          <Link
            key={item.to}
            activeOptions={{ exact: item.exact ?? false }}
            activeProps={{
              className: 'bg-slate-900 text-white shadow-sm',
            }}
            className={cn(
              'rounded-2xl px-4 py-3 transition-colors hover:bg-slate-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300',
            )}
            to={item.to}
          >
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500 data-[status=active]:text-slate-300">
              {item.subtitle}
            </p>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
