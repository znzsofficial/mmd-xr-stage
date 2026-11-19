// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as THREE from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLanguageStore } from "../../languageStore";
import { useBackpack, type BackpackEntry } from "../backpack";
import { useMmdVrStore } from "../mmdVrStore";
import { SCENERY, sceneryIds } from "../scenery/catalog";
import { BackpackWorldTools, positionWorldTools } from "./BackpackWorldTools";
import { MmdVrControlBar } from "./MmdVrHud";
import { useHudWorldInput } from "./hudWorldInput";
import { useStagePlay } from '../play/stagePlay';

const harness = vi.hoisted(() => ({ camera: {} as unknown, b: (_: string) => {} }));
vi.mock("@react-three/fiber", () => ({ useThree: (selector: (s: typeof harness) => unknown) => selector(harness), useFrame: vi.fn() }));
vi.mock("@react-three/xr", () => ({ useXRInputSourceState: () => undefined, useXRControllerButtonEvent: (_: unknown, id: string, cb: typeof harness.b) => { if (id === "b-button") harness.b = cb; } }));
vi.mock("../../shared/panelTexture", () => ({ createPanelTexture: () => ({ dispose: vi.fn() }), roundRectPath: vi.fn() }));

const t = useLanguageStore.getState().t;
const bag = () => useBackpack.getState();
const store = () => useMmdVrStore.getState();
let host: HTMLDivElement, root: Root;
const entry = (id: string, kind: BackpackEntry["kind"], name: string, source: string, warning?: string): BackpackEntry =>
  ({ id, kind, file: new File([""], name), path: `${source}/${name}`, warning });
const entries = [entry("a0", "model", "Dancer.pmx", "concert", "missing texture"), entry("a1", "model", "Dancer.pmx", "school"), entry("a2", "model", "B.pmd", "meadow"), entry("a3", "model", "C.pmx", "winter"),
  entry("obj", "object", "Lamp.glb", "props"), entry("m1", "motion", "Wave.vmd", "body"), entry("m2", "motion", "Blink.vmd", "face")];
const instance = (runtimeId: string, visible = true) => ({ runtimeId, position: [1, 0, -2] as [number, number, number], visible });
const transform = (id: string) => ({ id, name: "runtimeName", visible: true, scale: 1, rotationY: 30 });
const mesh = (name: string) => [...host.querySelectorAll<HTMLElement>("mesh")].find(el => el.getAttribute("name") === name);
const button = (label: string) => mesh(`hud:${label}`);
const click = async (label: string) => { const el = button(label); expect(el, label).toBeDefined(); await act(async () => el!.click()); };
const labels = () => [...host.querySelectorAll("mesh")].map(el => el.getAttribute("name")).filter(n => n?.startsWith("hud-label")).join("\n");
const recall=()=>act(async()=>harness.b('pressed'));
const render = async () => {
  const props = { busy: false, onDragChange: vi.fn(), onExit: vi.fn(), panelDragLabel: "Drag", placeOffLabel: "Move selected asset" } as unknown as Parameters<typeof MmdVrControlBar>[0];
  await act(async () => root.render(<><MmdVrControlBar {...props} /><BackpackWorldTools /></>));
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // R3F meshes in a DOM host exercise React pointer dispatch, not renderer output.
  vi.spyOn(console, "error").mockImplementation(() => {}); vi.spyOn(console, "warn").mockImplementation(() => {});
  harness.camera = new THREE.PerspectiveCamera();
  useBackpack.setState({ ...useBackpack.getInitialState(), entries });
  useMmdVrStore.setState(useMmdVrStore.getInitialState());
  host = document.createElement("div"); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  useBackpack.setState(useBackpack.getInitialState()); useMmdVrStore.setState(useMmdVrStore.getInitialState());
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it("can choose every set directly from viewing, with no scenery cycle or settings page", async () => {
  await render();await recall();
  for (const id of [...sceneryIds].reverse()) {
    await click(t("hudScenery"));
    for (const other of sceneryIds) expect(button(t(SCENERY[other].label))).toBeDefined();
    await click(t(SCENERY[id].label));
    expect(store().prefs.scenery).toBe(id);
    expect(button(t("hudBackpack"))).toBeDefined();
    expect(button(t("hudModels"))).toBeUndefined();
  }
});

it('shows where to take a toy, keeps it on the player for unsupported wrists and transfers only to the selected character',async()=>{
  useStagePlay.getState().reset();useBackpack.setState({selected:'a0',live:{a0:{...instance('m42'),wrists:{left:false,right:true}}}});
  await render();expect(button(t('propGive'))).toBeUndefined();
  await act(async()=>useStagePlay.getState().equip('bubbles','left'));
  await click(t('propGive'));
  await click(t('propLeft'));expect(useStagePlay.getState().held).toBeTruthy();
  await click(t('propRight'));expect(useStagePlay.getState().character).toMatchObject({assetId:'a0',hand:'right',toy:'bubbles'});expect(useStagePlay.getState().held).toBeNull();
  await click(t('propRaise'));await click(t('propCloser'));expect(useStagePlay.getState().character).toMatchObject({tilt:15,inset:-1});
  await click(t('toyStow'));expect(useStagePlay.getState().character).toBeNull();
});

it('keeps all handheld props visible in the chapel and after travelling from their shelf, without equipping on travel',async()=>{
  useStagePlay.getState().reset();store().setPrefs({scenery:'chapel'});await render();await recall();await click(t('hudBackpack'));await click(t('hudToys'));
  const allProps=()=>{for(const id of ['kite','encore','bubbles','post','saber'])expect(host.querySelector(`[name="play:shelf:${id}"]`)).not.toBeNull();};
  allProps();await click(t('toyRight'));expect(useStagePlay.getState().held).toBeNull(); // no connected controllers
  expect(button(t('visitKite'))).toBeUndefined();await click(t('toyGuide'));expect(labels()).toContain(t('guideKiteVr'));expect(button(t('toyRight'))).toBeUndefined();
  await click(t('toyCloseGuide'));allProps();expect(store().prefs.scenery).toBe('chapel');
  await click(t('toyGuide'));await click(t('visitKite'));expect(store().prefs.scenery).toBe('lawn');allProps();expect(useStagePlay.getState().held).toBeNull();
});

it("browses a larger backpack without consuming stage slots, labels duplicate filenames by source, and can select hidden items at capacity", async () => {
  useBackpack.setState({ live: { a0: instance("runtime:0", false), a1: instance("runtime:1"), a2: instance("runtime:2") } });
  await render(); await recall();await click(t("hudBackpack"));
  expect(labels()).toContain("concert"); expect(labels()).toContain("school"); expect(labels()).toContain("missing texture");
  expect(labels()).toContain(t("hudOnStageHidden")); expect(labels()).toContain(t("hudReturnFirst"));
  await click(t("loadNext")); expect(labels()).toContain("C.pmx"); await click(t("hudPlace"));
  expect(bag().draft).toBeNull(); expect(Object.keys(bag().live)).toHaveLength(3);
  await click(t("hudMotions")); expect(labels()).toContain("Wave.vmd"); expect(button(t("hudPlace"))).toBeUndefined();
  await click(t("hudObjects")); expect(labels()).toContain("Lamp.glb"); expect(labels()).toContain("0 / 3");
  await click(t("hudCharacters")); await click(t("hudSelect"));
  expect(bag().selected).toBe("a0"); expect(button(t("watchArrange"))).toBeDefined(); expect(button(t("hudBackpack"))).toBeUndefined();
});

it("cancels new placement explicitly or with right B without issuing a stage command; B also exits local move and preserves the original pose", async () => {
  await render();await recall(); await click(t("hudBackpack")); await click(t("hudPlace"));
  expect(bag().draft).toBe("a0"); expect(button(t("hudCharacters"))).toBeUndefined();
  await click(t("hudCancelPlace")); expect(bag().command).toBeNull(); expect(bag().live).toEqual({});
  await recall();await click(t("hudBackpack")); await click(t("hudPlace"));
  await act(async () => harness.b("released")); expect(bag().draft).toBe("a0");
  await act(async () => harness.b("pressed")); expect(bag().draft).toBeNull(); expect(button(t("hudBackpack"))).toBeDefined();
  const existing = instance("runtime:obj");
  await click(t('hudBack'));
  await act(async () => useBackpack.setState({ selected: "obj", live: { obj: existing } }));
  await click(t("hudMove")); await act(async () => harness.b("pressed"));
  expect(bag().command).toBeNull(); expect(bag().live.obj).toBe(existing); expect(bag().selected).toBeNull();
  expect(button(t("hudMore"))).toBeDefined();
});

it("targets the selected runtime for transforms, but the stable character and exact file for body/face motions", async () => {
  useBackpack.setState({ live: { a0: instance("runtime:77"), obj: instance("runtime:88") }, selected: "a0" });
  useMmdVrStore.setState({ models: [transform("runtime:77")], objects: [transform("runtime:88")] });
  await render();await click(t('watchArrange'));await click(t("hudTurnLeft")); await click(t("hudLarger"));
  expect(store().takeModelTransformRequests()).toEqual([{ id: "runtime:77", rotationY: 15, scale: 1.25 }]);
  await click(t('hudTools'));await click(t("hudChangeMotion")); await click(t("hudApplyBody"));
  expect(bag().command).toMatchObject({ type: "motion", id: "a0", file: entries[5].file, kind: "body" });
  await act(async () => bag().finishCommand(bag().command!));
  await click(t("loadNext")); await click(t("hudApplyFace"));
  expect(bag().command).toMatchObject({ type: "motion", id: "a0", file: entries[6].file, kind: "face" });
  await act(async () => { bag().finishCommand(bag().command!); bag().select("obj"); });
  expect(button(t("hudChangeMotion"))).toBeUndefined();
  await click(t("hudSmaller")); expect(store().takeModelTransformRequests()).toEqual([{ id: "runtime:88", scale: 0.8 }]);
  await click(t("hudPutAway")); expect(bag().command).toMatchObject({ type: "remove", id: "obj" });
});

it("uses the same draft and scene locks from advanced controls, and never allows world hits through the picker", async () => {
  useBackpack.setState({ live: { a0: instance("live:character"), obj: instance("live:object") } });
  useMmdVrStore.setState({ models: [transform("live:character")], modelCount: 1, objects: [transform("live:object")] });
  await render();
  for (const id of ["a0", "obj"]) {
    await act(async()=>bag().select(id));if(id==='a0')await click(t('watchArrange'));await click(t('watchDetails'));
    expect(useHudWorldInput.getState().blocked).toBe(true);
    await act(async () => useMmdVrStore.setState({ physicsBusy: true }));
    await click("Move selected asset"); expect(bag().draft).toBeNull();
    await act(async () => useMmdVrStore.setState({ physicsBusy: false }));
    await click("Move selected asset"); expect(bag().draft).toBe(id);
    expect(useHudWorldInput.getState().blocked).toBe(false); expect(store().placeMode).toBe(false);
    await click(t("hudCancelPlace")); expect(bag().command).toBeNull();
  }
  await recall();await click(t("hudMore")); await click(t("hudVisual"));
  await click(t(SCENERY[store().prefs.scenery].label));
  expect(useHudWorldInput.getState().blocked).toBe(true);
  await act(async () => useBackpack.setState({ busy: true }));
  await click(t("hudPool")); expect(store().prefs.scenery).not.toBe("pool");
  await act(async () => useBackpack.setState({ busy: false }));
  await click(t("hudPool")); expect(store().prefs.scenery).toBe("pool");
  expect(button(t("hudComfort"))).toBeDefined();
});

it("blocks stage edits during physics work, gives load recovery priority over a world selection, and exposes failed backpack commands", async () => {
  useBackpack.setState({ selected: "a0", live: { a0: instance("runtime:77") } });
  useMmdVrStore.setState({ models: [transform("runtime:77")], physicsBusy: true });
  await render(); await click(t("watchArrange")); expect(button(t('hudTurnRight'))).toBeUndefined();
  expect(store().takeModelTransformRequests()).toEqual([]); expect(bag().draft).toBeNull(); expect(bag().command).toBeNull();
  await act(async () => useMmdVrStore.setState({ physicsBusy: false, assetLoad: { ...store().assetLoad, running: true } }));
  expect(button(t("hudMove"))).toBeUndefined(); expect(button(t("loadBack"))).toBeDefined();
  await act(async () => { useMmdVrStore.setState({ assetLoad: { ...store().assetLoad, running: false } }); useBackpack.setState({ error: "File could not load" }); });
  expect(button(t("hudMove"))).toBeUndefined(); await click(t("hudBack"));
  expect(bag().error).toBeNull(); expect(button(t("watchArrange"))).toBeDefined();
});

it("anchors tools beside a visible target and in front of a seated, turned viewer when the target is behind", () => {
  const head = new THREE.PerspectiveCamera(), tools = new THREE.Group(); head.position.set(3, 1.07, -4); head.rotation.y = Math.PI / 2;
  positionWorldTools(head, tools, [0, -8, -4]);
  expect(tools.position.y).toBeCloseTo(.97); expect(tools.position.x).toBeLessThan(head.position.x);
  expect(Math.abs(tools.position.z - head.position.z)).toBeGreaterThan(.5);
  positionWorldTools(head, tools, [7, 18, 5]);
  const towards = tools.position.clone().sub(head.position).normalize(); expect(towards.dot(head.getWorldDirection(new THREE.Vector3()))).toBeGreaterThan(.98);
});
