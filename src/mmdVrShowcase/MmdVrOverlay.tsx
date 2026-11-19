import { Component, type ReactNode } from "react";
import { useMmdVrStore } from "./mmdVrStore";
import { MmdVrScene } from "./MmdVrScene";
import { useMmdVrEntryLifetime } from "./useMmdVrEntryLifetime";
import { ScreenStage } from './screen/ScreenStage';

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
  const overlayOpen = useMmdVrStore((state) => state.overlayOpen);
  const entryEpoch = useMmdVrStore((state) => state.entryEpoch);
  const presentation = useMmdVrStore(state => state.presentation);
  if (overlayOpen && presentation === 'screen') return <SceneBoundary key={entryEpoch}><ScreenStage /></SceneBoundary>;
  return overlayOpen ? <SceneEntry key={entryEpoch} /> : null;
}
