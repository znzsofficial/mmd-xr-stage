// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompactPlaybackControls, CriticalNotice } from "./MmdVrHud";
import { useMmdVrStore } from "../mmdVrStore";
import { useLanguageStore } from "../../languageStore";

vi.mock("../mmdVrTheme", () => ({ useMmdVrTheme: () => ({ accent: { border: "#333333", ink: "#ffffff", marker: "#eeeeee", primary: "#ffffff", soft: "#111111" } }) }));
vi.mock("../../shared/panelTexture", () => ({ createPanelTexture: () => ({ dispose: vi.fn() }), roundRectPath: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // These tests drive pointer handlers without a WebGL context.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  useMmdVrStore.setState({ playing: false, modelCount: 1, physicsError: null });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function button(label: string) {
  return [...container.querySelectorAll("mesh")].find((mesh) => mesh.getAttribute("name") === `hud:${label}`) as HTMLElement;
}

describe("compact playback controls", () => {
  it("lets users play, pause, expand and exit without reopening the adjustment panel", async () => {
    const onExpand = vi.fn(), onExit = vi.fn();
    const t = useLanguageStore.getState().t;
    await act(async () => root.render(<CompactPlaybackControls onExpand={onExpand} onExit={onExit} busy={false} />));
    await act(async () => button(t("settingsMmdVrPlay")).click());
    expect(useMmdVrStore.getState().playing).toBe(true);
    await act(async () => button(t("settingsMmdVrPause")).click());
    expect(useMmdVrStore.getState().playing).toBe(false);
    await act(async () => button(t("settingsMmdVrPanelShow")).click());
    await act(async () => button(t("settingsVrDesktopExit")).click());
    expect(onExpand).toHaveBeenCalledOnce();
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("keeps the physics error details reachable independently of panel mode", async () => {
    const onDetails = vi.fn();
    useMmdVrStore.setState({ physicsError: "full native error", physicsFatal: true });
    await act(async () => root.render(<CriticalNotice onDetails={onDetails} />));
    await act(async () => button(useLanguageStore.getState().t("hudPhysicsFatal")).click());
    expect(onDetails).toHaveBeenCalledOnce();
    await act(async () => useMmdVrStore.setState({ physicsError: null }));
    expect(container.querySelector("mesh")).toBeNull();
  });
});
