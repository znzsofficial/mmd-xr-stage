// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as THREE from "three";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLanguageStore } from "../../languageStore";
import { useBackpack, type BackpackEntry } from "../backpack";
import { useMmdVrStore } from "../mmdVrStore";
import { SCENERY, mainSceneryIds, portalRooms } from "../scenery/catalog";
import { BackpackWorldTools, positionWorldTools } from "./BackpackWorldTools";
import { MmdVrControlBar } from "./MmdVrHud";
import * as hudValues from "./HudValues";
import { useHudWorldInput } from "./hudWorldInput";
import { useStagePlay } from '../play/stagePlay';
import { shelfToys, TOYS } from '../play/propCatalog';
import {useBodyState} from '../bodyState/store';

const harness = vi.hoisted(() => ({ camera: {} as unknown, b: (_: string) => {} }));
vi.mock("@react-three/fiber", () => ({ useThree: (selector: (s: typeof harness) => unknown) => selector(harness), useFrame: vi.fn() }));
vi.mock("@react-three/xr", () => ({ useXRInputSourceState: () => undefined, useXRControllerButtonEvent: (_: unknown, id: string, cb: typeof harness.b) => { if (id === "b-button") harness.b = cb; } }));
vi.mock("../../shared/panelTexture", () => ({ createPanelTexture: () => ({ dispose: vi.fn() }), roundRectPath: vi.fn() }));
vi.mock('../observation/ObservationDiagram',()=>({ObservationDiagram:({part}:{part:string})=><group name={`figure:${part}`}/>}));

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
  const props = { busy: false, onDragChange: vi.fn(), onExit: vi.fn() };
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

it("returns from a portal room and offers only the ten main destinations", async () => {
  store().setPrefs({scenery:'velvetStudio'});
  await render();await recall();
  await click(t('returnPortalHall'));expect(store().prefs.scenery).toBe('astralCourt');
  await recall();
  for (const id of [...mainSceneryIds].reverse()) {
    await click(t("hudScenery"));
    for (const other of portalRooms) expect(button(t(SCENERY[other].label))).toBeUndefined();
    await click(t(SCENERY[id].label));
    expect(store().prefs.scenery).toBe(id);
    if(id==='astralCourt')expect(button(t('hudBackpack'))).toBeUndefined();else expect(button(t('hudBackpack'))).toBeDefined();
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

it('browses every guide in the chapel, returns to its page and travels without equipping',async()=>{
  useStagePlay.getState().reset();store().setPrefs({scenery:'chapel'});await render();await recall();await click(t('hudBackpack'));await click(t('hudToys'));
  const row=(toy:string)=>host.querySelector(`[name="play:shelf:${toy}"]`);
  await click(t('toyRight'));expect(useStagePlay.getState().held).toBeNull(); // no connected controllers
  expect(button(t('visitKite'))).toBeUndefined();
  for(const toy of shelfToys){
    if(!row(toy))await click(t('loadNext'));
    const guide=row(toy)?.querySelector<HTMLElement>(`[name="hud:${t('toyGuide')}"]`);
    expect(guide,toy).toBeTruthy();await act(async()=>guide!.click());
    expect(labels()).toContain(t(TOYS[toy].guide.vr));expect(labels()).toContain(t(TOYS[toy].guide.end));
    expect(button(t('toyRight'))).toBeUndefined();await click(t('toyCloseGuide'));expect(row(toy)).toBeTruthy();
  }
  for(let i=0;!row('kite')&&i<shelfToys.length;i++)await click(t('loadPrevious'));
  expect(store().prefs.scenery).toBe('chapel');
  await click(t('toyGuide'));await click(t('visitKite'));expect(store().prefs.scenery).toBe('lawn');expect(useStagePlay.getState().held).toBeNull();
});

it('can stow a character prop from the partially filled final shelf page',async()=>{
  useBackpack.setState({live:{a0:{...instance('m42'),wrists:{left:true,right:true}}}});
  const play=useStagePlay.getState(); play.reset();play.equip('wand','left');play.give('a0','right');
  await render();await recall();await click(t('hudBackpack'));await click(t('hudToys'));
  const pages=Math.ceil(shelfToys.length/3);
  for(let i=1;i<pages;i++)await click(t('loadNext'));
  expect(labels()).toContain(`${pages} / ${pages}`);
  expect(host.querySelectorAll('[name^="play:shelf:"]')).toHaveLength(shelfToys.length%3||3);
  await click(t('loadNext'));expect(labels()).toContain(`${pages} / ${pages}`);
  await click(t('toyStow'));expect(useStagePlay.getState().character).toBeNull();expect(bag().command).toBeNull();
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

it('folds only the actor sheet, and resumes its unsaved section even after B recalls the public menu',async()=>{
  useBackpack.setState({selected:'a0',live:{a0:instance('actor0'),a1:instance('actor1')}});
  await render();expect(button(t('actorBodyState'))).toBeUndefined();await click(t('actorInteraction'));await click(t('actorMilkStock'));await click('开启泌乳');
  await click(t('bodyPeek'));expect(button('放弃改动')).toBeUndefined();
  expect(useBodyState.getState().draft?.value.lactating).toBe(true);
  await click(t('bodyResume'));expect(button('关闭泌乳')).toBeDefined();expect(button('排出左侧')).toBeUndefined();
  await recall();expect(button(t('hudBackpack'))).toBeDefined();expect(button(t('bodyResume'))).toBeUndefined();
  await click(t('hudBack'));await click(t('bodyResume'));expect(button('关闭泌乳')).toBeDefined();
  await click(t('bodyPeek'));await act(async()=>bag().select('a1'));
  expect(useBodyState.getState().draft).toBeNull();expect(button(t('bodyResume'))).toBeUndefined();
});

it('returns from fertility to the selected uterus lens, and exits a cross-link at the original interaction hub',async()=>{
  useBackpack.setState({selected:'a0',live:{a0:instance('actor0')}});
  useMmdVrStore.setState({overlayOpen:true,presentation:'xr'});vi.spyOn(document,'hidden','get').mockReturnValue(false);
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
  await render();await click(t('actorInteraction'));await click(t('actorInsert'));await click('子宫');
  await click(t('actorFertility'));expect(button('插入操作')).toBeUndefined();await click(t('backToInsert'));
  expect(host.querySelector('[name="figure:uterus"]')).toBeTruthy();await click(t('backToInteraction'));
  await click(t('actorFertility'));await click('插入操作');expect(host.querySelector('[name="figure:uterus"]')).toBeTruthy();
  await click(t('actorFertility'));await click(t('backToInteraction'));expect(button(t('actorMilkStock'))).toBeDefined();
  expect(useBodyState.getState().draft).toBeNull();
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
  await act(async () => { bag().finishCommand(bag().command!); useBackpack.setState({bindings:{a0:{body:entries[5].file,face:entries[6].file}}}); });
  expect(labels()).toContain(`${t('hudBodyMotion')} · body/Wave.vmd`);expect(labels()).toContain(`${t('hudFaceMotion')} · face/Blink.vmd`);
  await click(t('hudClearBodyMotion')); // The picker is still browsing Blink, not Wave.
  expect(bag().command).toMatchObject({type:'motion',runtimeId:'runtime:77',file:null,kind:'body'});
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
    await click(t('settingsMmdVrPlaceOff')); expect(bag().draft).toBeNull();
    await act(async () => useMmdVrStore.setState({ physicsBusy: false }));
    await click(t('settingsMmdVrPlaceOff')); expect(bag().draft).toBe(id);
    expect(useHudWorldInput.getState().blocked).toBe(false); expect(bag().command).toBeNull();
    await click(t("hudCancelPlace")); expect(bag().command).toBeNull();
  }
  await recall();await click(t("hudScenery"));
  expect(useHudWorldInput.getState().blocked).toBe(true);
  await act(async () => useBackpack.setState({ busy: true }));
  await click(t("hudPool")); expect(store().prefs.scenery).not.toBe("pool");
  await act(async () => useBackpack.setState({ busy: false }));
  await click(t("hudPool")); expect(store().prefs.scenery).toBe("pool");
  expect(button(t("hudBackpack"))).toBeDefined();
});

it("keeps the advanced rows tied to the displayed PMX or GLB, including after paging", async () => {
  // DOM pointers have no mesh-hit UV. Supply one slider value at its boundary;
  // buttons below use the actual release and follow-up click handlers.
  vi.spyOn(hudValues, "HudSlider").mockImplementation(({disabled, onChange}) =>
    <button disabled={disabled} onClick={() => onChange(1)}>scale</button>);
  const model = transform("live:character"), object = { ...transform("live:object"), visible: false };
  const mat = { name: "cloth", opacity: 1, emission: 0, visible: true, roughness: 1, metallic: 0 };
  useBackpack.setState({ selected: "a0", live: { a0: instance(model.id), obj: instance(object.id, false) } });
  useMmdVrStore.setState({ models: [model], modelCount: 1, objects: [object], materialModels: { [model.id]: [mat] } });
  await render(); await click(t("watchArrange")); await click(t("watchDetails"));
  const scale = () => act(async () => host.querySelector('button')!.click());
  for (const asset of [model, object]) {
    const visibility = t(asset.visible ? "settingsMmdVrHideModel" : "settingsMmdVrShowModel");
    const rotate = t("settingsMmdVrRotateLeft"), remove = t("settingsMmdVrRemoveModel");
    expect(button(rotate)?.getAttribute("position")).toBe(`-0.36,${asset === model ? -0.27 : -0.31},0`);

    await act(async () => useBackpack.setState({busy: true}));
    await click(visibility); await click(rotate); await scale(); await click(remove);
    expect(store().takeVisibilityToggles()).toEqual([]); expect(store().takeModelRemovals()).toEqual([]);
    expect(store().takeModelTransformRequests()).toEqual([]);
    if (asset === model) {
      await click(t("settingsMmdVrMaterials")); expect(store().materialPanelModelId).toBe(model.id);
      await click(visibility); expect(store().materialModels[model.id][0].visible).toBe(true);
      await click(t("hudModels"));
    } else expect(button(t("settingsMmdVrMaterials"))).toBeUndefined();

    await act(async () => useBackpack.setState({busy: false}));
    const target = button(visibility)!;
    for (const type of ["pointerdown", "pointerup"]) {
      await act(async () => target.dispatchEvent(new PointerEvent(type, {bubbles: true, pointerId: 2})));
    }
    await act(async () => target.click());
    expect(store().takeVisibilityToggles()).toEqual([asset.id]);
    await click(rotate); await scale();
    expect(store().takeModelTransformRequests()).toEqual([{id: asset.id, rotationY: 15, scale: 10}]);
    await click(t("settingsMmdVrValueReset"));
    expect(store().takeModelTransformRequests()).toEqual([{id: asset.id, reset: true}]);
    await click(remove); expect(store().takeModelRemovals()).toEqual([asset.id]);
    if (asset === model) await click(t("loadNext"));
  }
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
