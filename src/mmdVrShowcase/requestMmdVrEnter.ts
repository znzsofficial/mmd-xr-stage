import type { TranslationKey } from "../languageStore";
import { requestImmersiveEnter } from "../xr";
import type { MmdVrAssetSlot } from "./mmdVrAssets";
import { beginMmdVrAssetSession } from "./mmdVrAssets";
import { prepareBackpackEntry } from "./backpack";
import { useMmdVrStore } from "./mmdVrStore";
import { beginMmdVrSessionFromClick, endMmdVrSession, getMmdVrSessionSnapshot, waitForMmdVrPresentation } from "./mmdVrSession";

/**
 * Call only from a button onClick (user activation).
 */
export function requestMmdVrEnter(opts: {
  t: (key: TranslationKey) => string;
  assets?: readonly MmdVrAssetSlot[];
  resume?: boolean;
}): Promise<"entered" | "failed"> {
  const { t, assets } = opts;
  const store = useMmdVrStore.getState();
  let entryEpoch = store.entryEpoch;
  const abort = new AbortController();
  let generation = getMmdVrSessionSnapshot().generation;
  let started = false;
  let ended = false;
  const endEntrySession = () => {
    if (ended) return;
    ended = true;
    void endMmdVrSession(generation);
  };

  const entering = requestImmersiveEnter({
    isSelfBusy: () => {
      const current = useMmdVrStore.getState();
      return current.overlayOpen || current.phase === "entering" || current.phase === "active";
    },
    setEntering: () => {
      useMmdVrStore.setState({presentation:'xr'});
      const saved = opts.resume ? store.savedStage : null;
      prepareBackpackEntry(saved != null);
      store.prepareStage(saved != null);
      beginMmdVrAssetSession(saved?.assets ?? assets ?? []);
      store.setPhase("entering");
    },
    setLastError: (v) => store.setLastError(v),
    openOverlay: () => {
      store.openOverlay();
      started = true;
      entryEpoch = useMmdVrStore.getState().entryEpoch;
    },
    isCancelled: () => useMmdVrStore.getState().entryEpoch !== entryEpoch,
    beginSessionFromClick: beginMmdVrSessionFromClick,
    waitForPresentation: waitForMmdVrPresentation,
    signal: abort.signal,
    describeStartup: () => `stage=${getMmdVrSessionSnapshot().phase}`,
    markEntered: () => {
      if (useMmdVrStore.getState().overlayOpen) store.markEntered();
    },
    failEnter: (detail) => store.failEnter(detail),
    onFailCleanup: endEntrySession,
    onPreflightError: (message) => store.setPhase("error", message),
    needHttpsMessage: t("settingsVrDesktopNeedHttps"),
    noXrMessage: t("settingsVrDesktopNoXr"),
    logTag: "mmdVr",
  });
  if (!started) return entering;
  generation = getMmdVrSessionSnapshot().generation;
  const unsubscribe = useMmdVrStore.subscribe((state) => {
    if (state.entryEpoch === entryEpoch) return;
    abort.abort();
    endEntrySession();
  });
  return entering.finally(() => { unsubscribe(); abort.abort(); });
}
