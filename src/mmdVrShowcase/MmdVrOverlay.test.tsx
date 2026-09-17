// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MmdVrOverlay } from "./MmdVrOverlay";
import { useMmdVrStore } from "./mmdVrStore";
import { endMmdVrSession } from "./mmdVrSession";
import { preloadMmdVrScene } from "./preloadMmdVrScene";

vi.mock("./mmdVrSession", () => ({ endMmdVrSession: vi.fn(async () => {}) }));
vi.mock("./preloadMmdVrScene", () => ({ preloadMmdVrScene: vi.fn() }));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(endMmdVrSession).mockClear();
  useMmdVrStore.getState().openOverlay();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  useMmdVrStore.getState().closeOverlay();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("scene loading UI", () => {
  it("offers a visible cancel action while the scene chunk is pending", async () => {
    let resolve!: (module: Awaited<ReturnType<typeof preloadMmdVrScene>>) => void;
    vi.mocked(preloadMmdVrScene).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    await act(async () => root.render(<MmdVrOverlay />));
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.textContent).toContain("正在准备 VR 场景");
    await act(async () => container.querySelector("button")!.click());
    expect(endMmdVrSession).toHaveBeenCalledOnce();
    expect(useMmdVrStore.getState().overlayOpen).toBe(false);
    await act(async () => resolve({ MmdVrScene: () => <div>late scene</div> }));
    expect(container.textContent).not.toContain("late scene");
  });

  it("closes a crashed scene and exposes the error back on setup", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(preloadMmdVrScene).mockResolvedValueOnce({ MmdVrScene: () => { throw new Error("renderer failed"); } });
    await act(async () => root.render(<MmdVrOverlay />));
    expect(useMmdVrStore.getState()).toMatchObject({ overlayOpen: false, errorMessage: "renderer failed" });
    expect(endMmdVrSession).toHaveBeenCalledOnce();
  });
});
