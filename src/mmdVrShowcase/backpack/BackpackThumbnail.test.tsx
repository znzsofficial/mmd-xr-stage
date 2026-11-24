// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { withAssetPath } from "../../mmdImport/assetPaths";
import type { BackpackEntry } from "./store";
import { BackpackThumbnail, drawLocalCover, indexBackpackCovers } from "./BackpackThumbnail";

const paint = vi.hoisted(() => ({ draw: vi.fn(), dispose: vi.fn() }));
vi.mock("../../shared/panelTexture", () => ({
  roundRectPath: vi.fn(),
  createPanelTexture: () => ({ dispose: paint.dispose, image: { getContext: () => ({ save() {}, restore() {}, clip() {}, fillRect() {}, drawImage: paint.draw }) } }),
}));

function imageHeader(w = 64, h = 64) {
  const bytes = new ArrayBuffer(24), d = new DataView(bytes);
  [0x89504e47, 0x0d0a1a0a, 13, 0x49484452, w, h].forEach((n, i) => d.setUint32(i * 4, n));
  return bytes;
}
const file = (path: string, bytes: BlobPart = imageHeader()) => withAssetPath(new File([bytes], path.split("/").at(-1)!), path);
const entry = (path: string): BackpackEntry => ({ id: "a", kind: "model", path, file: file(path) });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); paint.draw.mockClear(); paint.dispose.mockClear(); });

it("prefers the exact sibling preview, then the explicit folder cover; never borrows package, skin, nested or loose-root artwork", () => {
  const actor = entry("A.zip/models/Hero.pmx"), own = file("A.zip/models/Hero.preview.jpg"), cover = file("A.zip/models/cover.png");
  const wrong = [file("B.zip/models/Hero.preview.png"), file("A.zip/models/textures/cover.png"), file("A.zip/models/Hero.png"), file("A.zip/models/other.preview.png"), file("cover.png")];
  for (const files of [[cover, ...wrong, own], [own, ...wrong, cover]]) expect(indexBackpackCovers(files)(actor)).toBe(own);
  expect(indexBackpackCovers([cover, ...wrong])(actor)).toBe(cover);
  expect(indexBackpackCovers(wrong)(actor)).toBeNull();
  expect(indexBackpackCovers(wrong)(entry("Hero.pmx"))).toBeNull();
  const exact = file("Hero.preview.jpg"); expect(indexBackpackCovers([...wrong, exact])(entry("Hero.pmx"))).toBe(exact);
});

it("skips oversized, malformed and huge-dimension covers before involving the decoder", async () => {
  const decode = vi.fn(); vi.stubGlobal("createImageBitmap", decode);
  const draw = vi.fn(), signal = new AbortController().signal;
  const huge = file("A/cover.png", new Uint8Array(256 * 1024 + 1));
  expect(indexBackpackCovers([huge])(entry("A/object.pmx"))).toBeNull();
  for (const f of [huge, file("A/cover.png", imageHeader(64, 60000)), file("A/cover.png", "not an image"),
    file("A/cover.jpg", new Uint8Array([255,216,255,192,0,8,8,0,64,255,255,1]))]) await drawLocalCover(f, signal, draw);
  expect(decode).not.toHaveBeenCalled(); expect(draw).not.toHaveBeenCalled();
});

it("allows bounded JPEGs and releases their decoded surfaces even if drawing fails", async () => {
  const bitmap = { width: 64, height: 32, close: vi.fn() }, decode = vi.fn(async () => bitmap); vi.stubGlobal("createImageBitmap", decode);
  const draw = vi.fn(() => { throw Error("detached canvas"); });
  await drawLocalCover(file("A/preview.jpg", new Uint8Array([255,216,255,224,0,4,0,0,255,194,0,8,8,0,32,0,64,1])), new AbortController().signal, draw);
  expect(draw).toHaveBeenCalledWith(bitmap); expect(bitmap.close).toHaveBeenCalledOnce();
});

it("releases detached textures and late bitmaps; rapidly paging cannot paint a stale row or allocate blob URLs", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.spyOn(console, "error").mockImplementation(() => {});
  const objectUrl = vi.fn(); vi.stubGlobal("URL", { createObjectURL: objectUrl });
  const deferred = Array.from({ length: 3 }, () => {
    let resolve!: (bitmap: ImageBitmap) => void;
    const promise = new Promise<ImageBitmap>(done => { resolve = done; });
    return { resolve, promise };
  });
  let i = 0; const decode = vi.fn(() => deferred[i++].promise); vi.stubGlobal("createImageBitmap", decode);
  const bitmaps = deferred.map(() => ({ width: 64, height: 64, close: vi.fn() }));
  const root = createRoot(document.createElement("div"));
  for (let i = 0; i < 3; i++) {
    await act(async () => root.render(<BackpackThumbnail kind="model" cover={file(`pack${i}/preview.png`)} />));
    await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(i + 1));
  }
  for (const i of [2, 0]) await act(async () => deferred[i].resolve(bitmaps[i] as unknown as ImageBitmap));
  expect(paint.draw).toHaveBeenCalledOnce(); expect(paint.draw.mock.calls[0][0]).toBe(bitmaps[2]);
  await act(async () => root.unmount());
  await act(async () => deferred[1].resolve(bitmaps[1] as unknown as ImageBitmap));
  expect(paint.draw).toHaveBeenCalledOnce(); expect(paint.dispose).toHaveBeenCalledTimes(3);
  bitmaps.forEach(b => expect(b.close).toHaveBeenCalledOnce()); expect(objectUrl).not.toHaveBeenCalled();
});
