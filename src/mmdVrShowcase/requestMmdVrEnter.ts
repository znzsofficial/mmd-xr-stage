import type { TranslationKey } from "../languageStore";
import { requestImmersiveEnter } from "../xr";
import type { MmdVrAssetSlot } from "./mmdVrAssets";
import { beginMmdVrAssetSession, endMmdVrAssetSession } from "./mmdVrAssets";
import { useMmdVrStore } from "./mmdVrStore";
import { beginMmdVrSessionFromClick } from "./mmdVrSession";
import { preloadMmdVrScene } from "./preloadMmdVrScene";

type Notify = (payload: {
  title: string;
  message: string;
  type: "error" | "warning";
  category: "system" | "media";
  appId: "settings" | "mmd-studio";
}) => void;

/**
 * Call only from a button onClick (user activation).
 */
export function requestMmdVrEnter(opts: {
  t: (key: TranslationKey) => string;
  addNotification: Notify;
  assets?: readonly MmdVrAssetSlot[];
  appId?: "settings" | "mmd-studio";
}): Promise<"entered" | "failed"> {
  const { t, addNotification, assets, appId = "settings" } = opts;
  const store = useMmdVrStore.getState();

  return requestImmersiveEnter({
    isSelfBusy: () =>
      store.overlayOpen || store.phase === "entering" || store.phase === "active",
    setEntering: () => {
      if (assets?.length) beginMmdVrAssetSession(assets);
      store.setPhase("entering");
    },
    setLastError: (v) => store.setLastError(v),
    openOverlay: () => store.openOverlay(),
    preloadScene: () => {
      void preloadMmdVrScene();
    },
    beginSessionFromClick: beginMmdVrSessionFromClick,
    markEntered: () => store.markEntered(),
    failEnter: (detail) => store.failEnter(detail),
    onFailCleanup: () => {
      endMmdVrAssetSession();
    },
    notify: (message, type = "warning") => {
      addNotification({
        title: t("settingsMmdVrShowcase"),
        message,
        type,
        category: appId === "mmd-studio" ? "media" : "system",
        appId,
      });
    },
    needHttpsMessage: t("settingsVrDesktopNeedHttps"),
    noXrMessage: t("settingsVrDesktopNoXr"),
    logTag: "mmdVr",
  });
}
