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
  useMmdVrStore.setState({ playing: false, modelCount: 1, duration:30, physicsError: null });
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
    await act(async () => root.render(<CompactPlaybackControls onExpand={onExpand} onScenery={vi.fn()} onBackpack={vi.fn()} onExit={onExit} busy={false} />));
    await act(async () => button(t("settingsMmdVrPlay")).click());
    expect(useMmdVrStore.getState().playing).toBe(true);
    await act(async () => button(t("settingsMmdVrPause")).click());
    expect(useMmdVrStore.getState().playing).toBe(false);
    await act(async () => button(t("hudMore")).click());
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

  it('does not hide the menu or start an empty timeline for a model without motion',async()=>{
    useMmdVrStore.setState({duration:0});const onTransport=vi.fn();
    await act(async()=>root.render(<CompactPlaybackControls onTransport={onTransport} onExpand={vi.fn()} onScenery={vi.fn()} onBackpack={vi.fn()} onExit={vi.fn()} busy={false}/>));
    await act(async()=>button(useLanguageStore.getState().t('settingsMmdVrPlay')).click());
    expect(onTransport).not.toHaveBeenCalled();expect(useMmdVrStore.getState().playing).toBe(false);
  });

  it("activates on a deliberate trigger release without requiring the XR short-click timeout", async () => {
    const onExpand = vi.fn();
    const t = useLanguageStore.getState().t;
    await act(async () => root.render(<CompactPlaybackControls onExpand={onExpand} onScenery={vi.fn()} onBackpack={vi.fn()} onExit={() => {}} busy={false} />));
    const target = button(t("hudMore"));
    const pointer = (name: string) => new PointerEvent(name, { bubbles: true, pointerId: 1 });
    await act(async () => target.dispatchEvent(pointer("pointerdown")));
    await act(async () => target.dispatchEvent(pointer("pointerup")));
    expect(onExpand).toHaveBeenCalledOnce();
    await act(async () => target.click());
    expect(onExpand).toHaveBeenCalledOnce();
    await act(async () => target.dispatchEvent(pointer("pointerdown")));
    await act(async () => target.dispatchEvent(pointer("pointercancel")));
    await act(async () => target.dispatchEvent(pointer("pointerup")));
    await act(async () => target.click());
    expect(onExpand).toHaveBeenCalledOnce();
  });
});
