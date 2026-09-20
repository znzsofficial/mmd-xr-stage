// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MmdVrPrepApp } from "./MmdVrPrepApp";
import { expandAssetFiles, AssetImportError } from "../mmdImport/importArchive";
import { inspectAssets } from "../mmdImport/inspectAssets";
import { requestMmdVrEnter } from "./requestMmdVrEnter";
import { useMmdVrStore } from "./mmdVrStore";
import { emptyAssetLoadProgress } from "./mmdAssetLoadQueue";
import type { StageSnapshot } from "./stageSnapshot";
import { resolveCompanion, withAssetPath } from "../mmdImport/assetPaths";

vi.mock("./MmdVrOverlay", () => ({ MmdVrOverlay: () => null }));
vi.mock("./requestMmdVrEnter", () => ({ requestMmdVrEnter: vi.fn(async () => "entered") }));
vi.mock("../mmdImport/importArchive", async (original) => ({ ...await original<typeof import("../mmdImport/importArchive")>(), expandAssetFiles: vi.fn() }));
vi.mock("../mmdImport/inspectAssets", () => ({ inspectAssets: vi.fn() }));
vi.mock("../xr/xrDetect", async (original) => ({ ...await original<typeof import("../xr/xrDetect")>(), getXrSystem: () => ({ isSessionSupported: async () => true }) }));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  useMmdVrStore.setState({ savedStage: null, resumeStage: null, captureStage: null, phase: "idle", overlayOpen: false });
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

describe("prep import and resume controls", () => {
  it("shows ZIP import results and keeps selection intact after a later import fails", async () => {
    await act(async () => root.render(<MmdVrPrepApp />));
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
    expect(vi.mocked(requestMmdVrEnter).mock.lastCall?.[0].assets?.[0]).toMatchObject({ modelFile: model });
  });

  it("offers explicit continue and fresh-start actions rather than silently restoring", async () => {
    const file = new File(["pmx"], "saved.pmx");
    const saved: StageSnapshot = { assets: [{ kind: "model", modelFile: file, companionFiles: [file], bodyMotionFile: null }],
      models: [], objects: [], time: 65, playing: false, loop: false, physicsEnabled: false, controllerCollisions: true };
    useMmdVrStore.setState({ savedStage: saved });
    await act(async () => root.render(<MmdVrPrepApp />));
    const buttons = [...container.querySelectorAll<HTMLButtonElement>("button")];
    const resume = buttons.find((button) => button.textContent === "继续上次舞台")!;
    expect(resume.disabled).toBe(false);
    expect(container.textContent).toContain("1:05");
    await act(async () => resume.click());
    expect(requestMmdVrEnter).toHaveBeenCalledWith(expect.objectContaining({ resume: true }));
    expect(buttons.some((button) => button.textContent?.includes("按当前选择重新开始"))).toBe(true);
  });

  it("does not reselect a deselected model when importing only a texture or motion", async () => {
    await act(async () => root.render(<MmdVrPrepApp />));
    const a = new File(["a"], "a.pmx"), b = new File(["b"], "b.pmx");
    vi.mocked(expandAssetFiles).mockResolvedValueOnce([a, b]);
    await choose(new File(["zip"], "models.zip"));
    const modelButton = [...container.querySelectorAll<HTMLButtonElement>(".stage-tile-btn")].find((button) => button.textContent?.includes("a.pmx"))!;
    await act(async () => modelButton.click());
    vi.mocked(expandAssetFiles).mockResolvedValueOnce([new File(["png"], "face.png")]);
    await choose(new File(["png"], "face.png"));
    expect(modelButton.closest(".stage-asset-tile")?.classList.contains("is-selected")).toBe(false);
    await act(async () => container.querySelector<HTMLButtonElement>(".stage-btn-primary")!.click());
    expect(vi.mocked(requestMmdVrEnter).mock.lastCall?.[0].assets).toHaveLength(1);
    expect(vi.mocked(requestMmdVrEnter).mock.lastCall?.[0].assets?.[0]).toMatchObject({ modelFile: b });
  });

  it("binds a loose resource explicitly to the missing ZIP reference", async () => {
    const model = withAssetPath(new File(["model"], "character.pmx"), "model.zip/character.pmx", "model.zip");
    vi.mocked(inspectAssets).mockResolvedValueOnce({ models: 1, objects: 0, motions: 0, textures: 0,
      issues: [{ kind: "missing", file: "model.zip/character.pmx", reference: "textures/face.png" }] });
    await act(async () => root.render(<MmdVrPrepApp />));
    vi.mocked(expandAssetFiles).mockResolvedValueOnce([model]);
    await choose(new File(["zip"], "model.zip"));
    const selectResource = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "为此引用选择资源文件")!;
    const repairInput = container.querySelectorAll<HTMLInputElement>('input[type="file"]')[2];
    const click = vi.spyOn(repairInput, "click").mockImplementation(() => {});
    await act(async () => selectResource.click());
    expect(click).toHaveBeenCalledOnce();
    const texture = new File(["png"], "chosen.png");
    Object.defineProperty(repairInput, "files", { configurable: true, value: [texture] });
    await act(async () => repairInput.dispatchEvent(new Event("change", { bubbles: true })));
    await act(async () => container.querySelector<HTMLButtonElement>(".stage-btn-primary")!.click());
    const assets = vi.mocked(requestMmdVrEnter).mock.lastCall?.[0].assets!;
    expect(resolveCompanion(model, "textures/face.png", assets[0].companionFiles).matches).toEqual([texture]);
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
