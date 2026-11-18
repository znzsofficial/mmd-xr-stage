import { Component, type ReactNode } from "react";
import { useMmdVrStore } from "./mmdVrStore";
import { MmdVrScene } from "./MmdVrScene";
import { useMmdVrEntryLifetime } from "./useMmdVrEntryLifetime";

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
  return overlayOpen ? <SceneEntry key={entryEpoch} /> : null;
}
