// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { expect, it, vi } from "vitest";
import { MmdVrControlBar } from "./MmdVrHud";
import { useMmdVrStore } from "../mmdVrStore";
import { useLanguageStore, type TranslationKey } from "../../languageStore";

const harness = vi.hoisted(() => ({ camera: {} as unknown, buttonEvent: null as null | ((state: string) => void) }));
vi.mock("@react-three/fiber", () => ({ useThree: (selector: (s: {camera: unknown}) => unknown) => selector(harness), useFrame: vi.fn() }));
vi.mock("@react-three/xr", () => ({ useXRInputSourceState: () => undefined, useXRControllerButtonEvent: (_c: unknown, _id: string, cb: typeof harness.buttonEvent) => { harness.buttonEvent = cb; } }));
vi.mock("../../shared/panelTexture", () => ({ createPanelTexture: () => ({ dispose: vi.fn() }), roundRectPath: vi.fn() }));

it("opens on personal adjustments, keeps physics details contextual, and retains graphics settings and recovery navigation", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  harness.camera = new THREE.PerspectiveCamera();
  const state = useMmdVrStore.getState();
  useMmdVrStore.setState({ assetLoad: { running: false, completed: 0, total: 0, fileName: "", phase: null, failures: [] },
    physicsError: null, physicsBusy: false, materialPanelModelId: null, duration: 30,
    modelCount: 2, models: [{ id: "a", name: "a.pmx", visible: true, scale: 1, rotationY: 0 }, { id: "b", name: "b.pmx", visible: true, scale: 1, rotationY: 0 }], objects: [], materialModels: {} });
  const host = document.createElement("div"); const root = createRoot(host);
  const t = useLanguageStore.getState().t;
  const toggle = (key:TranslationKey, on:boolean) => `${t(key)} · ${t(on?'diagOn':'diagOff')}`;
  const exit = vi.fn();
  const props = { onExit: exit, onDragChange: vi.fn(), busy: false };
  const buttons = (label: string) => [...host.querySelectorAll<HTMLElement>("mesh")].filter(m => m.getAttribute("name") === `hud:${label}`);
  const click = async (label: string) => { expect(buttons(label).length).toBeGreaterThan(0); await act(async () => buttons(label)[0].click()); };
  try {
    await act(async () => root.render(<MmdVrControlBar {...props} />));
    expect(buttons(t('hudMore'))).toHaveLength(0);
    await act(async()=>harness.buttonEvent?.('pressed'));await click(t('settingsMmdVrPlay'));expect(state.setPlaying).toBeDefined();expect(buttons(t('hudMore'))).toHaveLength(0);
    await act(async()=>harness.buttonEvent?.('pressed'));await click(t("hudMore"));
    expect(buttons("Hide asset")).toHaveLength(0);
    await click('+10 cm');expect(useMmdVrStore.getState().prefs.normalEyeOffset).toBe(.1);
    await click(t('settingsMmdVrValueReset'));expect(useMmdVrStore.getState().prefs.normalEyeOffset).toBe(0);
    await click(t('moveFree'));expect(useMmdVrStore.getState().prefs.movementMode).toBe('free');
    expect(buttons('+10 cm')).toHaveLength(0);
    await click(t('moveNormal'));expect(useMmdVrStore.getState().prefs.movementMode).toBe('normal');
    expect(buttons(t('settingsHandModelOn'))).toHaveLength(0);
    await click(t('settingsHandsPanel'));
    await click(t('settingsHandModelOn'));await click(t('settingsMmdVrPhysicsHapticsLow'));
    expect(useMmdVrStore.getState().prefs).toMatchObject({handTracking:false,physicsHapticLevel:'normal',panelFollowUser:true});
    await click(t('settingsFaceMeOn'));await click(t('settingsBackPlayer'));
    expect(buttons(t('settingsHandModelOff'))).toHaveLength(0);expect(buttons(t('moveNormal'))).toHaveLength(1);
    expect(buttons(t('hudDiagnostics'))).toHaveLength(0);
    await click(t('settingsEnvironment'));expect(buttons('+')).toHaveLength(0);expect(buttons(t('hudDiagnostics'))).toHaveLength(1);
    expect(buttons(toggle('settingsSky',true))).toHaveLength(0);
    await click(`${t('settingsLighting')} · ${t('settingsMmdVrLightStage')}`);
    expect(useMmdVrStore.getState().prefs).toMatchObject({lightPreset:'contrast',stageSkyEnabled:true,stageRimLightEnabled:false,stageLightPoolEnabled:false});
    expect(buttons(t('sceneryPeopleOn'))).toHaveLength(0);
    await act(async()=>useMmdVrStore.getState().setPrefs({scenery:'clinic'}));
    await click(t('sceneryPeopleOff'));expect(useMmdVrStore.getState().prefs.showSceneryPeople).toBe(true);
    await click(t('sceneryPeopleOn'));expect(useMmdVrStore.getState().prefs.showSceneryPeople).toBe(false);
    await act(async()=>useMmdVrStore.getState().setPrefs({scenery:'classroom'}));
    expect(buttons(t('sceneryPeopleOff'))).toHaveLength(0);
    await click(t('settingsVisualDetails'));await click(toggle('hudSoftHighlights',false));
    expect(useMmdVrStore.getState().prefs.softHighlights).toBe(true);
    await click(toggle('settingsMmdVrGrid',false));expect(useMmdVrStore.getState().prefs.gridPref).toBe('on');
    await act(async()=>useMmdVrStore.getState().setPrefs({scenery:'glassPlanet'}));
    expect(buttons(toggle('settingsFog',true))).toHaveLength(0);
    expect(buttons(toggle('settingsMmdVrGrid',true))).toHaveLength(1);
    await click(toggle('settingsSky',true));expect(useMmdVrStore.getState().prefs.stageFogEnabled).toBe(true);
    expect(buttons(toggle('settingsRimLight',false))).toHaveLength(0);
    await act(async()=>useMmdVrStore.getState().setPrefs({scenery:'floor'}));
    await click(toggle('settingsRimLight',false));expect(useMmdVrStore.getState().prefs.stageLightPoolEnabled).toBe(false);
    expect(buttons(toggle('settingsSky',false))).toHaveLength(1);expect(buttons(toggle('settingsFog',true))).toHaveLength(1);
    await click(t('settingsBackEnvironment'));expect(buttons(t('hudDiagnostics'))).toHaveLength(1);
    await click(t('settingsCharacter'));expect(buttons(t('hudSolverDetails'))).toHaveLength(0);
    await click(t('modelColorBalanced'));expect(useMmdVrStore.getState().prefs.balancedModelColor).toBe(false);
    await click(t('modelColorBright'));expect(useMmdVrStore.getState().prefs.balancedModelColor).toBe(true);
    expect(buttons(t('settingsMmdVrPhysicsOff'))).toHaveLength(1);
    await click(t('settingsPlayer'));expect(buttons(t('moveNormal'))).toHaveLength(1);
    expect(buttons(t('settingsMmdVrPhysicsOff'))).toHaveLength(0);
    await click(t('settingsEnvironment'));await click(t('hudDiagnostics'));expect(buttons(t('settingsPanelFps'))).toHaveLength(1);
    await click(t("hudBack"));
    expect(buttons(t("hudModels"))).toHaveLength(0);
    await act(async()=>harness.buttonEvent?.('pressed'));
    await click(t("settingsVrDesktopExit"));
    expect(exit).toHaveBeenCalledOnce();
  } finally {
    await act(async () => root.unmount());
    useMmdVrStore.setState(state);
    vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});
