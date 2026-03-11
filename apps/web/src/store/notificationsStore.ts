import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type NotificationType =
  | 'analysis'
  | 'collaboration'
  | 'system'
  | 'plan'
  | 'release';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
}

interface NotificationsState {
  notifications: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  unreadCount: () => number;
}

const seedNotifications: NotificationItem[] = [
  {
    id: 'seed-1',
    title: 'Welcome to BeamLab',
    message: 'Your workspace is ready. Open /app to start modeling.',
    type: 'system',
    createdAt: new Date().toISOString(),
    read: false,
  },
];

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: seedNotifications,

      addNotification: (notification) => {
        const next: NotificationItem = {
          id: `notif-${Date.now()}`,
          createdAt: new Date().toISOString(),
          read: false,
          ...notification,
        };

        set((state) => ({ notifications: [next, ...state.notifications] }));
      },

      markRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        }));
      },

      markAllRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }));
      },

      clearAll: () => set({ notifications: [] }),

      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    {
      name: 'beamlab-notifications',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
