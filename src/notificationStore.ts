import { create } from "zustand";
import type { Notification } from "./types";
import { nanoid } from "nanoid";
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFY_PREFS_KEY,
  normalizeNotificationPrefs,
  type BannerDuration,
  type NotificationCategory,
  type NotificationPrefs,
} from "./system/notificationPrefs";

export type { BannerDuration, NotificationCategory, NotificationPrefs } from "./system/notificationPrefs";

export const BANNER_DURATION_MS: Record<BannerDuration, number> = {
  short: 2000,
  standard: 3500,
  long: 6000,
};

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(NOTIFY_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    return normalizeNotificationPrefs(JSON.parse(raw) as Partial<NotificationPrefs>);
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

function isWithinDnd(prefs: NotificationPrefs, date = new Date()) {
  if (!prefs.dndEnabled) return false;
  const [startH, startM] = prefs.dndStart.split(":").map(Number);
  const [endH, endM] = prefs.dndEnd.split(":").map(Number);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

type NotificationStore = {
  notifications: Notification[];
  history: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => void;
  dismissNotification: (id: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  clearHistory: () => void;
};

const notificationTimers = new Map<string, number>();
const HISTORY_LIMIT = 30;
const EXIT_DELAY = 220;

function clearNotificationTimer(id: string) {
  const timer = notificationTimers.get(id);
  if (timer) {
    window.clearTimeout(timer);
    notificationTimers.delete(id);
  }
}

/** Flag a toast as leaving so it can play its exit animation before removal. */
function markLeaving(id: string) {
  useNotificationStore.setState((state) => ({
    notifications: state.notifications.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
  }));
}

/** Static snapshot: this surface has no notification settings UI. */
const notificationPrefs = loadPrefs();

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  history: [],
  addNotification: (n) => {
    const prefs = notificationPrefs;
    const category = (n.category ?? "system") as NotificationCategory;
    if (prefs.categories[category] === false && !n.sticky) {
      return;
    }

    const inDnd = isWithinDnd(prefs);
    const id = nanoid(6);
    const createdAt = Date.now();
    const defaultDuration = BANNER_DURATION_MS[prefs.bannerDuration] ?? 3500;
    const duration = n.duration === 0 ? 0 : (n.duration ?? defaultDuration);
    const entry = { ...n, id, createdAt, category, duration, progress: 1 };
    const duplicateKey = `${n.type ?? "info"}:${n.title}:${n.message}`;
    const duplicateIds = useNotificationStore.getState().notifications
      .filter((item) => `${item.type ?? "info"}:${item.title}:${item.message}` === duplicateKey)
      .map((item) => item.id);
    duplicateIds.forEach(clearNotificationTimer);

    set((state) => ({
      history: [entry, ...state.history].slice(0, HISTORY_LIMIT),
      notifications: inDnd && !n.sticky
        ? state.notifications.filter((item) => `${item.type ?? "info"}:${item.title}:${item.message}` !== duplicateKey)
        : [
          ...state.notifications.filter((item) => `${item.type ?? "info"}:${item.title}:${item.message}` !== duplicateKey),
          entry,
        ].slice(-5),
    }));

    if (inDnd && !n.sticky) return;
    if (duration !== 0) {
      const dismissAt = Math.max(150, duration - EXIT_DELAY);
      const timer = window.setTimeout(() => {
        markLeaving(id);
        notificationTimers.delete(id);
        window.setTimeout(() => {
          useNotificationStore.getState().removeNotification(id);
        }, EXIT_DELAY);
      }, dismissAt);
      notificationTimers.set(id, timer);
    }
  },
  dismissNotification: (id) => {
    clearNotificationTimer(id);
    markLeaving(id);
    window.setTimeout(() => {
      useNotificationStore.getState().removeNotification(id);
    }, EXIT_DELAY);
  },
  removeNotification: (id) => {
    clearNotificationTimer(id);
    set((state) => ({
      notifications: state.notifications.filter((item) => item.id !== id),
    }));
  },
  clearNotifications: () => {
    notificationTimers.forEach((_, id) => clearNotificationTimer(id));
    if (!useNotificationStore.getState().notifications.length) return;
    useNotificationStore.setState((state) => ({
      notifications: state.notifications.map((item) => ({ ...item, leaving: true })),
    }));
    window.setTimeout(() => {
      useNotificationStore.setState({ notifications: [] });
    }, EXIT_DELAY);
  },
  clearHistory: () => set({ history: [] }),
}));
