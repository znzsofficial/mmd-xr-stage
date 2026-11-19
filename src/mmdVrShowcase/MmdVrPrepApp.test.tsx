// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MmdVrPrepApp } from "./MmdVrPrepApp";
import { expandAssetFiles, AssetImportError, IMPORT_LIMITS } from "../mmdImport/importArchive";
import { inspectAssets, type ImportReport } from "../mmdImport/inspectAssets";
import { requestMmdVrEnter } from "./requestMmdVrEnter";
import { useMmdVrStore } from "./mmdVrStore";
import { emptyAssetLoadProgress } from "./mmdAssetLoadQueue";
import type { StageSnapshot } from "./stageSnapshot";
import { resolveCompanion, withAssetPath } from "../mmdImport/assetPaths";
import { clearBackpack, useBackpack } from "./backpack";
import { MMD_VR_MAX_MODELS, MMD_VR_MAX_OBJECTS } from "./mmdVrAssets";

vi.mock("./MmdVrOverlay", () => ({ MmdVrOverlay: () => null }));
vi.mock("./requestMmdVrEnter", () => ({ requestMmdVrEnter: vi.fn(async () => "entered") }));
vi.mock("../mmdImport/importArchive", async (original) => ({ ...await original<typeof import("../mmdImport/importArchive")>(), expandAssetFiles: vi.fn() }));
vi.mock("../mmdImport/inspectAssets", () => ({ inspectAssets: vi.fn() }));
vi.mock("../xr/xrDetect", async (original) => ({ ...await original<typeof import("../xr/xrDetect")>(), getXrSystem: () => ({ isSessionSupported: async () => true }) }));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  clearBackpack();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  useMmdVrStore.setState({ savedStage: null, resumeStage: null, captureStage: null, phase: "idle", overlayOpen: false, assetLoad: emptyAssetLoadProgress() });
  vi.mocked(expandAssetFiles).mockReset();
  vi.mocked(inspectAssets).mockResolvedValue({ models: 1, objects: 0, motions: 0, textures: 0, issues: [] });
  vi.mocked(requestMmdVrEnter).mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function choose(file: File) {
  const input = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[1];
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
}

async function mount() {
  await act(async () => root.render(<StrictMode><MmdVrPrepApp /></StrictMode>));
}

const fresh = () => container.querySelector<HTMLButtonElement>(".stage-btn-primary")!;
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === text);

describe("prep import and resume controls", () => {
  it('offers screen playback even when insecure LAN access disables immersive entry', async()=>{
    Object.defineProperty(window,'isSecureContext',{configurable:true,value:false});await mount();
    expect(fresh().disabled).toBe(true);const screen=button('屏幕观看')!;expect(screen.disabled).toBe(false);
    await act(async()=>screen.click());expect(requestMmdVrEnter).not.toHaveBeenCalled();expect(useMmdVrStore.getState()).toMatchObject({presentation:'screen',overlayOpen:true});
    await act(async()=>useMmdVrStore.getState().closeOverlay());
  });
  it("enters an empty stage before importing anything", async () => {
    await mount();
    expect(useBackpack.getState().entries).toEqual([]);
    expect(fresh().disabled).toBe(false);
    await act(async () => fresh().click());
    expect(requestMmdVrEnter).toHaveBeenCalledWith(expect.objectContaining({ assets: [], resume: false }));
  });

  it("keeps an existing catalog usable after a later ZIP fails", async () => {
    await mount();
    const model = new File(["model"], "character.pmx");
    vi.mocked(expandAssetFiles).mockResolvedValueOnce([model]);
    await choose(new File(["zip"], "models.zip"));
    expect(container.textContent).toContain("character.pmx");
    expect(container.textContent).toContain("导入检查");
    const enter = container.querySelector<HTMLButtonElement>(".stage-btn-primary")!;
    expect(enter.disabled).toBe(false);
    vi.mocked(expandAssetFiles).mockRejectedValueOnce(new AssetImportError("archive", "broken.zip"));
    await choose(new File(["broken"], "broken.zip"));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("导入失败");
    expect(container.textContent).toContain("character.pmx");
    await act(async () => enter.click());
    expect(useBackpack.getState().entries.map(e => e.file)).toEqual([model]);
    expect(vi.mocked(requestMmdVrEnter).mock.lastCall?.[0].assets).toEqual([]);
  });

  it("keeps the backpack on exit, protects saved stage files and allows clearing everything explicitly", async () => {
    await mount();
    const file = new File(["pmx"], "saved.pmx"), unused = new File(["pmx"], "unused.pmx"), motion = new File(["vmd"], "walk.vmd");
    vi.mocked(expandAssetFiles).mockResolvedValueOnce([file, unused, motion]);
    await choose(new File(["zip"], "models.zip"));
    const ids = useBackpack.getState().entries.map(e => e.id);
    const saved: StageSnapshot = { assets: [{ kind: "model", modelFile: file, companionFiles: [file, unused, motion], bodyMotionFile: motion }],
      models: [], objects: [], time: 65, playing: false, loop: false, physicsEnabled: false, controllerCollisions: true };
    await act(async () => {
      useMmdVrStore.getState().openOverlay();
      useMmdVrStore.getState().markEntered();
      useMmdVrStore.getState().setStageCapture(() => saved);
      useMmdVrStore.getState().closeOverlay();
    });
    expect(useBackpack.getState().entries.map(e => e.id)).toEqual(ids);
    expect([...container.querySelectorAll(".stage-tile-remove")].map(el => el.getAttribute("aria-label"))).toEqual(["从背包移除: unused.pmx"]);
    const resume = button("继续上次舞台")!;
    expect(resume.disabled).toBe(false);
    expect(container.textContent).toContain("1:05");
    await act(async () => resume.click());
    expect(requestMmdVrEnter).toHaveBeenCalledWith(expect.objectContaining({ resume: true }));
    await act(async () => fresh().click());
    expect(vi.mocked(requestMmdVrEnter).mock.lastCall?.[0]).toMatchObject({ resume: false, assets: [] });
    await act(async () => button("清空资产与上次舞台")!.click());
    expect(useBackpack.getState().files).toEqual([]);
    expect(button("继续上次舞台")).toBeUndefined();
    expect(fresh().disabled).toBe(false);
  });

  it("catalogs every model, object and motion without filling stage slots or assigning a global motion", async () => {
    await mount();
    const models = Array.from({ length: MMD_VR_MAX_MODELS + 1 }, (_, i) => new File(["model"], `${i}.pmx`));
    const objects = Array.from({ length: MMD_VR_MAX_OBJECTS + 1 }, (_, i) => new File(["object"], `${i}.glb`));
    const catalogFiles = [...models, ...objects, new File(["vmd"], "body.vmd"), new File(["vpd"], "pose.vpd")];
    const imported = [...catalogFiles, new File(["png"], "face.png")];
    vi.mocked(expandAssetFiles).mockResolvedValueOnce(imported);
    await choose(new File(["zip"], "pack.zip"));
    expect(useBackpack.getState().entries.map(e => e.file)).toEqual(catalogFiles);
    expect(useBackpack.getState().files).toEqual(imported);
    const catalog = container.querySelector('[aria-labelledby="backpack-heading"]')!;
    expect(catalog.querySelectorAll("li")).toHaveLength(catalogFiles.length);
    expect(catalog.querySelector('input, select, [aria-pressed]')).toBeNull();
    await act(async () => fresh().click());
    expect(vi.mocked(requestMmdVrEnter).mock.lastCall?.[0].assets).toEqual([]);
  });

  it("rejects an import that would exceed the shared budget without mutating the backpack", async () => {
    await mount();
    const pack = [new File([], "a.pmx"), new File([], "b.pmx")];
    for (const file of pack) Object.defineProperty(file, "size", { value: IMPORT_LIMITS.fileBytes });
    vi.mocked(expandAssetFiles).mockResolvedValueOnce(pack);
    await choose(pack[0]);
    const extra = new File(["1"], "c.vmd");
    vi.mocked(expandAssetFiles).mockResolvedValueOnce([extra]);
    await choose(extra);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("内存预算");
    expect(useBackpack.getState().files).toEqual(pack);
  });

  it("does not republish old files when a preflight finishes after clearing", async () => {
    await mount();
    const model = new File(["model"], "old.pmx");
    let finish!: (report: ImportReport) => void;
    vi.mocked(inspectAssets).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    vi.mocked(expandAssetFiles).mockResolvedValueOnce([model]);
    await choose(model);
    expect(fresh().disabled).toBe(true);
    expect(useBackpack.getState().files).toEqual([model]);
    await act(async () => button("清空资产与上次舞台")!.click());
    await act(async () => finish({ models: 1, objects: 0, motions: 0, textures: 0, issues: [] }));
    expect(useBackpack.getState().files).toEqual([]);
    expect(container.querySelector(".stage-report-box")).toBeNull();
    expect(fresh().disabled).toBe(false);
  });

  it("binds a loose resource explicitly to the missing ZIP reference", async () => {
    const model = withAssetPath(new File(["model"], "character.pmx"), "model.zip/character.pmx", "model.zip");
    vi.mocked(inspectAssets).mockResolvedValueOnce({ models: 1, objects: 0, motions: 0, textures: 0,
      issues: [{ kind: "missing", file: "model.zip/character.pmx", reference: "textures/face.png" }] });
    await mount();
    vi.mocked(expandAssetFiles).mockResolvedValueOnce([model]);
    await choose(new File(["zip"], "model.zip"));
    expect(fresh().disabled).toBe(false);
    expect(useBackpack.getState().entries[0].warning).toContain("textures/face.png");
    const selectResource = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "为此引用选择资源文件")!;
    const repairInput = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[2];
    const click = vi.spyOn(repairInput, "click").mockImplementation(() => {});
    await act(async () => selectResource.click());
    expect(click).toHaveBeenCalledOnce();
    const texture = new File(["png"], "chosen.png");
    Object.defineProperty(repairInput, "files", { configurable: true, value: [texture] });
    await act(async () => repairInput.dispatchEvent(new Event("change", { bubbles: true })));
    const backpack = useBackpack.getState();
    expect(backpack.entries[0].warning).toBeUndefined();
    expect(resolveCompanion(model, "textures/face.png", backpack.files).matches).toEqual([texture]);
    click.mockRestore();
  });

  it("shows asset load failures with per-file diagnostics on the prep page", async () => {
    useMmdVrStore.setState({
      assetLoad: {
        ...emptyAssetLoadProgress(),
        failures: [{ id: "f1", fileName: "dress.pmx", phase: "model", message: "VERTEX_COUNT_MISMATCH" }],
      },
    });
    await act(async () => root.render(<MmdVrPrepApp />));
    const warning = container.querySelector(".stage-alert-warning");
    expect(warning?.textContent).toContain("dress.pmx");
    expect(warning?.textContent).toContain("VERTEX_COUNT_MISMATCH");
  });
});
