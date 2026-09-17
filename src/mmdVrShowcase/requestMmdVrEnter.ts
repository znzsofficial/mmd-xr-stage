import type { TranslationKey } from "../languageStore";
import { requestImmersiveEnter } from "../xr";
import type { MmdVrAssetSlot } from "./mmdVrAssets";
import { beginMmdVrAssetSession, endMmdVrAssetSession } from "./mmdVrAssets";
import { useMmdVrStore } from "./mmdVrStore";
import { beginMmdVrSessionFromClick, endMmdVrSession } from "./mmdVrSession";
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
  resume?: boolean;
}): Promise<"entered" | "failed"> {
  const { t, addNotification, assets, appId = "settings" } = opts;
  const store = useMmdVrStore.getState();
  let entryEpoch = store.entryEpoch;

  return requestImmersiveEnter({
    isSelfBusy: () => {
      const current = useMmdVrStore.getState();
      return current.overlayOpen || current.phase === "entering" || current.phase === "active";
    },
    setEntering: () => {
      store.prepareStage(Boolean(opts.resume));
      const selectedAssets = opts.resume && store.savedStage ? store.savedStage.assets : assets;
      if (selectedAssets?.length) beginMmdVrAssetSession(selectedAssets);
      store.setPhase("entering");
    },
    setLastError: (v) => store.setLastError(v),
    openOverlay: () => {
      store.openOverlay();
      entryEpoch = useMmdVrStore.getState().entryEpoch;
    },
    isCancelled: () => useMmdVrStore.getState().entryEpoch !== entryEpoch,
    preloadScene: preloadMmdVrScene,
    beginSessionFromClick: beginMmdVrSessionFromClick,
    markEntered: () => {
      if (useMmdVrStore.getState().overlayOpen) store.markEntered();
    },
    failEnter: (detail) => store.failEnter(detail),
    onFailCleanup: () => {
      void endMmdVrSession();
      endMmdVrAssetSession();
    },
    notify: (message, type = "warning") => {
      // failEnter already retained the full diagnostic; notifications may be shortened.
      if (useMmdVrStore.getState().errorMessage == null) store.setPhase("error", message);
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
