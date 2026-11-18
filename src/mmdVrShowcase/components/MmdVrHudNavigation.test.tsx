// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { MmdVrControlBar } from "./MmdVrHud";
import { useMmdVrStore } from "../mmdVrStore";
import { useLanguageStore } from "../../languageStore";

const harness = vi.hoisted(() => ({ camera: {} as unknown, buttonEvent: null as null | ((state: string) => void) }));
vi.mock("@react-three/fiber", () => ({ useThree: (selector: (s: {camera: unknown}) => unknown) => selector(harness), useFrame: vi.fn() }));
vi.mock("@react-three/xr", () => ({ useXRInputSourceState: () => undefined, useXRControllerButtonEvent: (_c: unknown, _id: string, cb: typeof harness.buttonEvent) => { harness.buttonEvent = cb; } }));
vi.mock("../mmdVrTheme", () => ({ useMmdVrTheme: () => ({ accent: { border: "#333333", ink: "#ffffff", marker: "#eeeeee", primary: "#ffffff", soft: "#111111" } }) }));
vi.mock("../../shared/panelTexture", () => ({ createPanelTexture: () => ({ dispose: vi.fn() }), roundRectPath: vi.fn() }));

it("keeps one asset panel mounted and switches settings without losing playback or exit", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  harness.camera = new THREE.PerspectiveCamera();
  const state = useMmdVrStore.getState();
  useMmdVrStore.setState({ assetLoad: { running: false, completed: 0, total: 0, fileName: "", phase: null, failures: [] },
    physicsError: null, physicsBusy: false, materialPanelModelId: null, duration: 0,
    modelCount: 2, models: [{ id: "a", name: "a.pmx", visible: true, scale: 1, rotationY: 0 }, { id: "b", name: "b.pmx", visible: true, scale: 1, rotationY: 0 }], objects: [], materialModels: {} });
  const host = document.createElement("div"); const root = createRoot(host);
  const t = useLanguageStore.getState().t;
  const exit = vi.fn();
  const props = { onExit: exit, onDragChange: vi.fn(), busy: false, hideLabel: "Hide asset", showLabel: "Show asset", scaleLabel: "Scale", placeOnLabel: "Place", placeOffLabel: "Place", resetValueLabel: "Reset", removeLabel: "Remove", materialsLabel: "Materials", physicsOnLabel: "Physics on", physicsOffLabel: "Physics off", physicsQualityLabels: ["Low", "Medium", "High"], physicsHapticLevelLabels: ["Off", "Low", "High"], physicsBoneFeedbackLabels: ["Soft", "Normal", "Hard"], physicsColliderFrictionLabels: ["Low", "Mid", "High"], physicsColliderRestitutionLabels: ["None", "Low", "High"], walkLabels: ["Slow", "Normal", "Fast"] } as unknown as Parameters<typeof MmdVrControlBar>[0];
  const buttons = (label: string) => [...host.querySelectorAll<HTMLElement>("mesh")].filter(m => m.getAttribute("name") === `hud:${label}`);
  const click = async (label: string) => { expect(buttons(label).length).toBeGreaterThan(0); await act(async () => buttons(label)[0].click()); };
  try {
    await act(async () => root.render(<MmdVrControlBar {...props} />));
    await click(t("hudMore"));
    expect(buttons("Hide asset")).toHaveLength(1);
    await click(t("loadNext"));
    expect(buttons("Hide asset")).toHaveLength(1);
    await click(t("hudVisual"));
    expect(buttons("Hide asset")).toHaveLength(0);
    await click(t("hudSimpleStage"));
    await click(t("hudLiveHouse"));
    expect(useMmdVrStore.getState().prefs.scenery).toBe("liveHouse");
    await click(t("hudSoftHighlights"));
    expect(useMmdVrStore.getState().prefs.softHighlights).toBe(true);
    await click(t("hudLiveHouse"));
    await click(t("hudClassroom"));
    expect(useMmdVrStore.getState().prefs.scenery).toBe("classroom");
    await click(t("hudPhysics"));
    expect(buttons("Physics off")).toHaveLength(1);
    await click(t("hudComfort"));
    expect(buttons("Physics off")).toHaveLength(0);
    await click(t("hudBack"));
    expect(buttons(t("hudModels"))).toHaveLength(0);
    await click(t("settingsVrDesktopExit"));
    expect(exit).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    useMmdVrStore.setState(state);
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});
