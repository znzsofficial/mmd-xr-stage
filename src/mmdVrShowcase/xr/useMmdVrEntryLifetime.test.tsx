// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMmdVrEntryLifetime } from "./useMmdVrEntryLifetime";

const state = vi.hoisted(() => ({
  overlayOpen: true, entryEpoch: 1, generation: 10, closeOverlay: vi.fn(), end: vi.fn(async (_generation?: number) => {}),
}));
vi.mock("../mmdVrStore", () => ({ useMmdVrStore: { getState: () => state } }));
vi.mock("./mmdVrSession", () => ({
  getMmdVrSessionSnapshot: () => ({ generation: state.generation }),
  endMmdVrSession: state.end,
}));
function Lifetime() { useMmdVrEntryLifetime(); return null; }

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("XR entry lifetime", () => {
  it("does not close on StrictMode replay but releases the owned entry on real unmount", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    state.entryEpoch = 1; state.generation = 10;
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<StrictMode><Lifetime /></StrictMode>));
    expect(state.end).not.toHaveBeenCalled();
    expect(state.closeOverlay).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    expect(state.end).toHaveBeenCalledExactlyOnceWith(10);
    expect(state.closeOverlay).toHaveBeenCalledOnce();
  });

  it("cannot close a newer overlay from an older entry's cleanup", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    state.entryEpoch = 1; state.generation = 10;
    const root = createRoot(document.createElement("div"));
    await act(async () => root.render(<Lifetime />));
    state.entryEpoch = 2; state.generation = 12;
    await act(async () => root.unmount());
    expect(state.end).toHaveBeenCalledExactlyOnceWith(10);
    expect(state.closeOverlay).not.toHaveBeenCalled();
  });
});
