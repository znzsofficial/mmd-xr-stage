export type NotificationCategory = "system" | "files" | "apps" | "media";
export type BannerDuration = "short" | "standard" | "long";

export type NotificationPrefs = {
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  bannerDuration: BannerDuration;
  categories: Record<NotificationCategory, boolean>;
};

export const NOTIFY_PREFS_KEY = "neko-virt-os.notification-prefs.v1";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dndEnabled: false,
  dndStart: "22:00",
  dndEnd: "08:00",
  bannerDuration: "standard",
  categories: {
    system: true,
    files: true,
    apps: true,
    media: true,
  },
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function normalizeNotificationPrefs(
  value: Partial<NotificationPrefs> & { categories?: Partial<Record<NotificationCategory, boolean>> } = {},
): NotificationPrefs {
  const bannerDuration = (["short", "standard", "long"] as const).includes(value.bannerDuration as BannerDuration)
    ? (value.bannerDuration as BannerDuration)
    : DEFAULT_NOTIFICATION_PREFS.bannerDuration;
  return {
    dndEnabled: Boolean(value.dndEnabled),
    dndStart: typeof value.dndStart === "string" && TIME_PATTERN.test(value.dndStart)
      ? value.dndStart
      : DEFAULT_NOTIFICATION_PREFS.dndStart,
    dndEnd: typeof value.dndEnd === "string" && TIME_PATTERN.test(value.dndEnd)
      ? value.dndEnd
      : DEFAULT_NOTIFICATION_PREFS.dndEnd,
    bannerDuration,
    categories: {
      system: value.categories?.system !== false,
      files: value.categories?.files !== false,
      apps: value.categories?.apps !== false,
      media: value.categories?.media !== false,
    },
  };
}
