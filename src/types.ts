export type WallpaperId =
  | "system"
  | "alpine-lake"
  | "star-field"
  | "pacific"
  | "green-meadow"
  | "forest"
  | "cabin"
  | "desert-dunes"
  | "aurora-sky"
  | "snow-peak"
  | "city-lights"
  | "sunset-coast"
  | "misty-forest"
  | "granite-lake"
  | "glass-towers"
  | "neon-street";

export type ThemeSettings = {
  accentColor:
    | "blue"
    | "cyan"
    | "emerald"
    | "mint"
    | "amber"
    | "coral"
    | "rose"
    | "purple"
    | "violet"
    | "slate";
  density: "compact" | "cozy";
  theme: "system" | "light" | "dark";
  wallpaperId: WallpaperId;
  wallpaperLightId: WallpaperId;
  wallpaperDarkId: WallpaperId;
  wallpaperFit: "cover" | "contain" | "stretch" | "tile";
  wallpaperOverlay: "off" | "soft" | "standard";
};

export type NotificationCategory = "system" | "files" | "apps" | "media";

export type Notification = {
  id: string;
  title: string;
  message: string;
  type?: "info" | "success" | "warning" | "error";
  category?: NotificationCategory;
  appId?: string;
  duration?: number;
  createdAt?: number;
  progress?: number;
  sticky?: boolean;
  leaving?: boolean;
};
