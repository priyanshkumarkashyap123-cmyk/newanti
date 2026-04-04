import { useMemo } from 'react';
import { useNotificationsStore } from '../store/notificationsStore';

const typeClasses: Record<string, string> = {
  analysis: 'bg-blue-500/15 text-blue-500',
  collaboration: 'bg-purple-500/15 text-purple-500',
  system: 'bg-slate-500/15 text-slate-500',
  plan: 'bg-amber-500/15 text-amber-500',
  release: 'bg-emerald-500/15 text-emerald-500',
};

export const NotificationsPage = () => {
  const notifications = useNotificationsStore((state) => state.notifications);
  const markRead = useNotificationsStore((state) => state.markRead);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  const clearAll = useNotificationsStore((state) => state.clearAll);

  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <div className="min-h-full bg-[#0b1326] text-slate-900 dark:text-slate-50 p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-[#869ab8] mt-1">{unread} unread</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={markAllRead}
              className="px-3 py-2 text-sm rounded-lg border border-[#1a2333] bg-[#0b1326] hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="px-3 py-2 text-sm rounded-lg border border-[#1a2333] bg-[#0b1326] hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Clear all
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-xl border border-[#1a2333] bg-[#0b1326] p-6 text-sm text-[#869ab8]">
              You are all caught up. ✨
            </div>
          ) : (
            notifications.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => markRead(item.id)}
                className={`w-full text-left rounded-xl border p-4 transition-colors ${
                  item.read
                    ? 'border-[#1a2333] bg-[#0b1326]'
                    : 'border-blue-300/50 dark:border-blue-500/40 bg-blue-50/60 dark:bg-blue-950/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`inline-flex mb-2 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        typeClasses[item.type] ?? typeClasses.system
                      }`}
                    >
                      {item.type}
                    </span>
                    <h2 className="font-semibold">{item.title}</h2>
                    <p className="mt-1 text-sm text-[#869ab8]">{item.message}</p>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;
