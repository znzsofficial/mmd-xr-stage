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
