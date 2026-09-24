import {
  Bell,
  CheckCheck,
  Info,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, Link } from '@tanstack/react-router';

import { useDashboardSummary } from '@/features/dashboard/hooks/use-dashboard-summary';
import { attentionCount } from '@/features/dashboard/utils/attention-set';

import {
  useNotifications,
  useOpenNotification,
  useMarkAllNotificationsRead,
} from '../hooks/use-notifications';
import type { Notification } from '../types/notification';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function NotificationCenter() {
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const openNotification = useOpenNotification();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  // Every open from the list is sent — read or not — so the API can count
  // revisits apart from the first open that followed the nudge.
  const handleNotificationClick = async (notif: Notification) => {
    await openNotification.mutateAsync(notif.id);
    if (notif.link) {
      await navigate({ href: notif.link });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-soon" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-late" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-ok" />;
      default:
        return <Info className="h-4 w-4 text-brand" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          variant="ghost"
          size="icon"
          className="relative rounded-full text-fg-3 hover:bg-page hover:text-fg md:h-9 md:w-9"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-surface bg-late text-caption font-bold text-on-late">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0 sm:w-96 rounded-xl border-line/60 overflow-hidden"
        align="end"
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h4 className="text-ui font-bold text-fg">Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-caption font-semibold text-primary hover:text-primary hover:bg-primary/5 px-2"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                Mark all as read
              </Button>
            )}
          </div>
        </div>

        <div className="h-px bg-line-subtle/80" />

        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyBell />
          ) : (
            <div className="divide-y divide-line-subtle/80">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    'w-full text-left p-4 transition-colors hover:bg-page/80 focus:outline-hidden focus:bg-page',
                    !notif.isRead && 'bg-primary/2',
                  )}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">{getIcon(notif.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'text-small leading-tight',
                            notif.isRead ? 'text-fg-2' : 'font-bold text-fg',
                          )}
                        >
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-1 text-caption text-fg-3 leading-normal line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-caption text-fg-3 font-medium">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </div>
                        {notif.link && (
                          <div className="flex items-center gap-1 text-caption font-bold text-primary group">
                            Details
                            <ExternalLink className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-line-subtle/80" />

        <div className="p-2 bg-page/50">
          <Button
            variant="ghost"
            className="w-full text-caption text-fg-3 font-semibold h-8 hover:bg-page/80"
            asChild
          >
            {/* Push for this device, and which alerts go by email or push, live there. */}
            <Link to="/settings/preferences" className="flex items-center justify-center">
              Notification preferences
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * No alerts is not the same as nothing due: the alert cron may not have run,
 * or every alert may have been read while the item is still overdue. "All
 * caught up" is only said when the dashboard's attention set is empty too.
 */
function EmptyBell() {
  const { data: summary } = useDashboardSummary();
  const pending = summary ? attentionCount(summary.attentionCounts) : 0;

  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="rounded-full bg-page p-3 mb-3">
        <Bell className="h-6 w-6 text-fg-3" />
      </div>
      {pending > 0 ? (
        <>
          <p className="text-ui font-medium text-fg">No new alerts</p>
          <Link to="/home" className="text-caption text-primary font-semibold mt-1 hover:underline">
            {pending === 1
              ? '1 thing needs your attention on Home'
              : `${pending} things need your attention on Home`}
          </Link>
        </>
      ) : (
        <>
          <p className="text-ui font-medium text-fg">All caught up!</p>
          <p className="text-caption text-fg-3 mt-1">
            No new maintenance alerts for your vehicles.
          </p>
        </>
      )}
    </div>
  );
}
