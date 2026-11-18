// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MmdVrOverlay } from "./MmdVrOverlay";
import { useMmdVrStore } from "./mmdVrStore";
import { endMmdVrSession } from "./mmdVrSession";
import { MmdVrScene } from "./MmdVrScene";

vi.mock("./mmdVrSession", () => ({ endMmdVrSession: vi.fn(async () => {}), getMmdVrSessionSnapshot: () => ({ generation: 1 }) }));
vi.mock("./MmdVrScene", () => ({ MmdVrScene: vi.fn(() => null) }));

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
  it("only mounts the prepared scene for an open entry, and releases it on cancel", async () => {
    useMmdVrStore.getState().closeOverlay();
    vi.mocked(MmdVrScene).mockClear();
    await act(async () => root.render(<MmdVrOverlay />));
    expect(MmdVrScene).not.toHaveBeenCalled();
    await act(async () => useMmdVrStore.getState().openOverlay());
    expect(MmdVrScene).toHaveBeenCalledOnce();
    await act(async () => useMmdVrStore.getState().closeOverlay());
    expect(endMmdVrSession).toHaveBeenCalledOnce();
    expect(useMmdVrStore.getState().overlayOpen).toBe(false);
  });

  it("closes a crashed scene and exposes the error back on setup", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(MmdVrScene).mockImplementation(() => { throw new Error("renderer failed"); });
    await act(async () => root.render(<MmdVrOverlay />));
    expect(useMmdVrStore.getState()).toMatchObject({ overlayOpen: false, errorMessage: "renderer failed" });
    expect(endMmdVrSession).toHaveBeenCalledOnce();
  });
});
