import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebGLRenderer } from "three";
import { createPendingSessionSlot } from "./pendingSessionSlot";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function sessionFixture() {
  const events = new EventTarget();
  return Object.assign(events, { end: vi.fn(async () => { events.dispatchEvent(new Event("end")); }) }) as unknown as XRSession & { end: ReturnType<typeof vi.fn> };
}

function rendererFixture(gate?: Promise<void>) {
  let session: XRSession | null = null;
  const xr = {
    enabled: false, isPresenting: false,
    getSession: () => session,
    setSession: vi.fn(async (next: XRSession) => {
      if (gate) await gate;
      session = next;
      xr.isPresenting = true;
    }),
  };
  return { gl: { xr } as unknown as WebGLRenderer, xr };
}

describe("XR entry ownership", () => {
  const request = vi.fn();
  beforeEach(() => {
    request.mockReset();
    vi.stubGlobal("navigator", { xr: { requestSession: request } });
    vi.stubGlobal("isSecureContext", true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("waits for a cold request without polling and distinguishes binding from the first frame", async () => {
    const gate = deferred<XRSession>();
    request.mockReturnValue(gate.promise);
    const slot = createPendingSessionSlot();
    const { gl, xr } = rendererFixture();
    const creating = slot.beginFromClick();
    expect(request).toHaveBeenCalledOnce();
    expect(slot.getSnapshot().phase).toBe("requesting");
    const attached = slot.attachToRenderer(gl);
    const presented = vi.fn();
    const presentation = slot.waitForPresentation().then(presented);
    await Promise.resolve();
    expect(xr.setSession).not.toHaveBeenCalled();
    const session = sessionFixture();
    gate.resolve(session);
    await creating;
    await expect(attached).resolves.toBe(true);
    expect(slot.getSnapshot().phase).toBe("bound");
    expect(presented).not.toHaveBeenCalled();
    expect(slot.markFrame(gl, sessionFixture())).toBe(false);
    expect(slot.markFrame(rendererFixture().gl, session)).toBe(false);
    expect(slot.markFrame(gl, session)).toBe(true);
    await presentation;
    expect(presented).toHaveBeenCalledWith(session);
    expect(slot.getSnapshot().phase).toBe("presenting");
    expect(slot.peek()).toBe(session);
  });

  it("serializes and deduplicates binding for StrictMode remounts", async () => {
    const gate = deferred<void>();
    const session = sessionFixture();
    request.mockResolvedValue(session);
    const slot = createPendingSessionSlot();
    await slot.beginFromClick();
    const { gl, xr } = rendererFixture(gate.promise);
    const abort = new AbortController();
    const firstActive = vi.fn();
    const first = slot.attachToRenderer(gl, firstActive, { signal: abort.signal });
    const rejected = expect(first).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(xr.setSession).toHaveBeenCalledOnce());
    abort.abort();
    await rejected;
    const secondActive = vi.fn();
    const second = slot.attachToRenderer(gl, secondActive);
    gate.resolve();
    await expect(second).resolves.toBe(true);
    expect(xr.setSession).toHaveBeenCalledOnce();
    expect(firstActive).not.toHaveBeenCalled();
    expect(secondActive).toHaveBeenCalledOnce();
    expect(session.end).not.toHaveBeenCalled();
  });

  it("invalidates an in-flight bind on cancellation without activating or ending a new session", async () => {
    const gate = deferred<void>();
    const old = sessionFixture();
    request.mockResolvedValueOnce(old);
    const slot = createPendingSessionSlot();
    await slot.beginFromClick();
    const oldGeneration = slot.getSnapshot().generation;
    const { gl, xr } = rendererFixture(gate.promise);
    const active = vi.fn();
    const attaching = slot.attachToRenderer(gl, active);
    await vi.waitFor(() => expect(xr.setSession).toHaveBeenCalledOnce());
    await slot.end();
    const next = sessionFixture();
    request.mockResolvedValueOnce(next);
    await slot.beginFromClick();
    const newRenderer = rendererFixture();
    await expect(slot.attachToRenderer(newRenderer.gl)).resolves.toBe(true);
    gate.resolve();
    await expect(attaching).resolves.toBe(false);
    await slot.end(oldGeneration);
    expect(active).not.toHaveBeenCalled();
    expect(old.end).toHaveBeenCalledOnce();
    expect(next.end).not.toHaveBeenCalled();
    expect(slot.markFrame(newRenderer.gl, next)).toBe(true);
  });

  it("never binds a newer session from an old queued attach", async () => {
    const oldRequest = deferred<XRSession>();
    request.mockReturnValueOnce(oldRequest.promise);
    const slot = createPendingSessionSlot();
    const creating = slot.beginFromClick();
    const creatingRejected = expect(creating).rejects.toMatchObject({ name: "AbortError" });
    const oldRenderer = rendererFixture();
    const oldAttach = slot.attachToRenderer(oldRenderer.gl);
    const rejected = expect(oldAttach).rejects.toMatchObject({ name: "AbortError" });
    await slot.end();
    await rejected;
    const next = sessionFixture();
    request.mockResolvedValueOnce(next);
    await slot.beginFromClick();
    const old = sessionFixture();
    oldRequest.resolve(old);
    await creatingRejected;
    expect(old.end).toHaveBeenCalledOnce();
    expect(oldRenderer.xr.setSession).not.toHaveBeenCalled();
    expect(slot.peek()).toBe(next);
  });

  it("rejects presentation when the headset ends a session before Canvas binds", async () => {
    const session = sessionFixture();
    request.mockResolvedValue(session);
    const ended = vi.fn();
    const slot = createPendingSessionSlot({ onSessionEnd: ended });
    await slot.beginFromClick();
    const presentation = expect(slot.waitForPresentation()).rejects.toMatchObject({ name: "AbortError" });
    session.dispatchEvent(new Event("end"));
    await presentation;
    expect(ended).toHaveBeenCalledOnce();
    expect(slot.getSnapshot().phase).toBe("idle");
    await slot.end();
    expect(session.end).not.toHaveBeenCalled();
  });

  it("does not notify a new entry when an old session finishes ending", async () => {
    const old = sessionFixture();
    const next = sessionFixture();
    const ending = deferred<void>();
    old.end.mockImplementation(() => ending.promise.then(() => old.dispatchEvent(new Event("end"))));
    const ended = vi.fn();
    const slot = createPendingSessionSlot({ onSessionEnd: ended });
    request.mockResolvedValueOnce(old).mockResolvedValueOnce(next);
    await slot.beginFromClick();
    const pendingEnd = slot.end();
    await slot.beginFromClick();
    ending.resolve();
    await pendingEnd;
    expect(slot.peek()).toBe(next);
    expect(ended).not.toHaveBeenCalled();
    expect(next.end).not.toHaveBeenCalled();
  });

  it("fails when setSession resolves without presenting the requested session", async () => {
    request.mockResolvedValue(sessionFixture());
    const slot = createPendingSessionSlot();
    await slot.beginFromClick();
    const { gl, xr } = rendererFixture();
    xr.setSession.mockResolvedValue(undefined);
    const active = vi.fn();
    await expect(slot.attachToRenderer(gl, active)).rejects.toThrow("did not bind");
    expect(active).not.toHaveBeenCalled();
    expect(slot.getSnapshot().phase).toBe("created");
  });

  it("requires a new frame after rebinding an already presenting session to a replacement renderer", async () => {
    const session = sessionFixture();
    request.mockResolvedValue(session);
    const slot = createPendingSessionSlot();
    await slot.beginFromClick();
    const first = rendererFixture();
    await slot.attachToRenderer(first.gl);
    expect(slot.markFrame(first.gl, session)).toBe(true);
    const second = rendererFixture();
    await slot.attachToRenderer(second.gl);
    expect(slot.getSnapshot().phase).toBe("bound");
    expect(slot.markFrame(first.gl, session)).toBe(false);
    expect(slot.markFrame(second.gl, session)).toBe(true);
  });
});
