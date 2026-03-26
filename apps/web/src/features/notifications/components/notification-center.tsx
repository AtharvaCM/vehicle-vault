import { 
  Bell, 
  CheckCheck, 
  Info, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2,
  X,
  Clock,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, Link } from '@tanstack/react-router';

import { 
  useNotifications, 
  useMarkNotificationRead, 
  useMarkAllNotificationsRead,
  type Notification 
} from '../hooks/use-notifications';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

export function NotificationCenter() {
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      await markRead.mutateAsync(notif.id);
    }
    if (notif.link) {
      // Handle navigation path
      // Note: router might need string for external or object for internal
      const route = notif.link.split('?')[0];
      const search = notif.link.includes('?') ? { tab: new URLSearchParams(notif.link.split('?')[1]).get('tab') } : {};
      
      // Simpler approach for now using window context if router is complex
      // but let's try standard navigate
      await navigate({ to: route as any, search: search as any });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-[8px] font-bold text-white dark:border-zinc-950">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 sm:w-96 rounded-xl shadow-premium-lg border-slate-200/60 overflow-hidden" align="end">
        <div className="flex items-center justify-between p-4 pb-2">
          <h4 className="text-sm font-bold text-slate-900">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/5 px-2"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark all as read
            </Button>
          )}
        </div>
        
        <div className="h-px bg-slate-100/80" />

        <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <div className="rounded-full bg-slate-50 p-3 mb-3">
                <Bell className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-900">All caught up!</p>
              <p className="text-xs text-slate-500 mt-1">No new maintenance alerts for your vehicles.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50/80">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={cn(
                    "w-full text-left p-4 transition-colors hover:bg-slate-50/80 focus:outline-none focus:bg-slate-50",
                    !notif.isRead && "bg-primary/[0.02]"
                  )}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-[13px] leading-tight",
                          notif.isRead ? "text-slate-600" : "font-bold text-slate-900"
                        )}>
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 leading-normal line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </div>
                        {notif.link && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-primary group">
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
        
        <div className="h-px bg-slate-100/80" />
        
        <div className="p-2 bg-slate-50/50">
          <Button 
            variant="ghost" 
            className="w-full text-xs text-slate-500 font-semibold h-8 hover:bg-slate-100/80"
            asChild
          >
            <Link to="/settings" className="flex items-center justify-center">
              Notification Settings
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
