import { Component, useLayoutEffect, type ReactNode } from "react";
import { useMmdVrStore } from "./mmdVrStore";
import { MmdVrScene } from "./xr/MmdVrScene";
import { useMmdVrEntryLifetime } from "./xr/useMmdVrEntryLifetime";
import { ScreenStage } from './screen/ScreenStage';
import { useStageMusic } from './music/stageMusic';

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    useMmdVrStore.getState().failEnter(error.message);
  }
  render() { return this.state.failed ? null : this.props.children; }
}

function SceneEntry() {
  useMmdVrEntryLifetime();
  return <SceneBoundary><MmdVrScene /></SceneBoundary>;
}

export function MmdVrOverlay() {
  useLayoutEffect(() => {
    const { stop, select } = useStageMusic.getState();
    const unsubscribe = useMmdVrStore.subscribe((next, prev) => {
      if (prev.overlayOpen && (!next.overlayOpen || next.entryEpoch !== prev.entryEpoch)) stop();
    });
    window.addEventListener('pagehide', stop);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', stop);
      select(null);
    };
  }, []);
  const overlayOpen = useMmdVrStore((state) => state.overlayOpen);
  const entryEpoch = useMmdVrStore((state) => state.entryEpoch);
  const presentation = useMmdVrStore(state => state.presentation);
  if (overlayOpen && presentation === 'screen') return <SceneBoundary key={entryEpoch}><ScreenStage /></SceneBoundary>;
  return overlayOpen ? <SceneEntry key={entryEpoch} /> : null;
}
