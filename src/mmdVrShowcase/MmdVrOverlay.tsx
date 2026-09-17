import { Component, useEffect, useState, type ReactNode } from "react";
import { useLanguageStore } from "../languageStore";
import { useMmdVrStore } from "./mmdVrStore";
import { endMmdVrSession } from "./mmdVrSession";
import { preloadMmdVrScene } from "./preloadMmdVrScene";

function SceneLoading() {
  const t = useLanguageStore((s) => s.t);
  return <div className="xr-stage-overlay mmd-load-overlay" role="status" aria-live="polite">
    <section>
      <h2>{t("loadScene")}</h2>
      <p>{t("loadSceneHint")}</p>
      <button type="button" onClick={() => {
        void endMmdVrSession();
        useMmdVrStore.getState().closeOverlay();
      }}>{t("loadBack")}</button>
    </section>
  </div>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    void endMmdVrSession();
    useMmdVrStore.getState().failEnter(error.message);
  }
  render() { return this.state.failed ? <SceneLoading /> : this.props.children; }
}

function SceneLoader() {
  const [Scene, setScene] = useState<typeof import("./MmdVrScene").MmdVrScene | null>(null);
  useEffect(() => {
    let cancelled = false;
    void preloadMmdVrScene().then((module) => {
      if (!cancelled) setScene(() => module.MmdVrScene);
    }).catch(() => {
      // Entry owns the visible failure and closes even a late-arriving session.
    });
    return () => { cancelled = true; };
  }, []);
  return Scene ? <SceneBoundary><Scene /></SceneBoundary> : <SceneLoading />;
}

export function MmdVrOverlay() {
  const overlayOpen = useMmdVrStore((state) => state.overlayOpen);
  return overlayOpen ? <SceneLoader /> : null;
}
