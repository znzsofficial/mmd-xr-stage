import { useEffect, useMemo } from "react";
import { relativePath } from "../../mmdImport/folderFiles";
import { createPanelTexture, roundRectPath } from "../../shared/panelTexture";
import type { BackpackEntry } from "./store";
import { HUD_COLORS } from "../hud/hudAppearance";

const MAX_BYTES = 256 * 1024, MAX_SIDE = 512, TILE = 96;
const explicitCover = /^(?:.+\.preview|cover|preview|thumbnail)\.(png|jpe?g)$/i;
const clean = (path: string) => path.replaceAll("\\", "/").normalize("NFC");
const directory = (path: string) => path.slice(0, path.lastIndexOf("/") + 1);

/** Index filenames only. Never resolve by basename across directories/packages.
 * A loose root has no package ownership, so only an asset-specific preview qualifies. */
export function indexBackpackCovers(files: readonly File[]) {
  const covers = new Map<string, File | null>();
  for (const file of files) {
    if (!explicitCover.test(file.name) || !file.size || file.size > MAX_BYTES) continue;
    const path = clean(relativePath(file)), key = directory(path) + clean(file.name).toLowerCase();
    covers.set(key, covers.has(key) ? null : file); // Ambiguous case or normalization: do not guess.
  }
  return (entry: BackpackEntry) => {
    const dir = directory(clean(entry.path));
    const base = clean(entry.file.name).replace(/\.[^.]+$/, "").toLowerCase();
    const stems = dir ? [`${base}.preview`, "cover", "preview", "thumbnail"] : [`${base}.preview`];
    for (const stem of stems) for (const ext of ["png", "jpg", "jpeg"]) {
      const file = covers.get(`${dir}${stem}.${ext}`); if (file) return file;
    }
    return null;
  };
}

/** Small compressed files can still describe enormous images. Read only the
 * PNG IHDR or a bounded JPEG header before handing the cover to a decoder. */
function smallImage(bytes: ArrayBuffer) {
  const v = new DataView(bytes), n = v.byteLength;
  const allowed = (w: number, h: number) => w > 0 && h > 0 && w <= MAX_SIDE && h <= MAX_SIDE;
  if (n >= 24 && v.getUint32(0) === 0x89504e47 && v.getUint32(4) === 0x0d0a1a0a && v.getUint32(8) === 13 && v.getUint32(12) === 0x49484452)
    return allowed(v.getUint32(16), v.getUint32(20));
  if (n < 4 || v.getUint16(0) !== 0xffd8) return false;
  for (let i = 2; i < n; ) {
    if (v.getUint8(i++) !== 0xff) return false;
    while (i < n && v.getUint8(i) === 0xff) i++;
    if (i + 3 > n) return false;
    const marker = v.getUint8(i++), len = v.getUint16(i);
    if (len < 2 || i + len > n || marker === 0xda || marker === 0xd9) return false;
    if (marker >= 0xc0 && marker <= 0xc3) return len >= 8 && allowed(v.getUint16(i + 5), v.getUint16(i + 3));
    i += len;
  }
  return false;
}

export async function drawLocalCover(file: File, signal: AbortSignal, draw: (image: ImageBitmap) => void) {
  if (file.size === 0 || file.size > MAX_BYTES || signal.aborted || typeof createImageBitmap !== "function") return;
  try {
    if (!smallImage(await file.slice(0, 32 * 1024).arrayBuffer()) || signal.aborted) return;
    // Decode the bounded Blob directly: no URL registry, image elements or onload handlers to leak.
    const image = await createImageBitmap(file);
    try { if (!signal.aborted && image.width <= MAX_SIDE && image.height <= MAX_SIDE) draw(image); }
    finally { image.close(); }
  } catch { /* Invalid or unsupported cover: keep the type glyph. */ }
}

function paintGlyph(ctx: CanvasRenderingContext2D, kind: BackpackEntry["kind"]) {
  roundRectPath(ctx, 0, 0, TILE, TILE, 12); ctx.fillStyle = HUD_COLORS.control; ctx.fill();
  ctx.strokeStyle = HUD_COLORS.muted; ctx.fillStyle = HUD_COLORS.selected;
  ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
  const shape = (path: number[][], fill = false) => {
    ctx.beginPath(); ctx.moveTo(path[0][0], path[0][1]);
    for (const [x, y] of path.slice(1)) ctx.lineTo(x, y);
    if (fill) { ctx.closePath(); ctx.fill(); } ctx.stroke();
  };
  if (kind === "model") {
    ctx.beginPath(); ctx.arc(48, 33, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(23, 74); ctx.bezierCurveTo(23, 45, 73, 45, 73, 74); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (kind === "object") {
    shape([[48, 18], [75, 33], [75, 64], [48, 79], [21, 64], [21, 33]], true);
    shape([[21, 33], [48, 48], [75, 33]]); shape([[48, 48], [48, 79]]);
  } else {
    shape([[18, 62], [48, 34], [78, 51]]);
    for (const [x, y] of [[19, 62], [48, 34], [77, 51]]) shape([[x, y - 7], [x + 7, y], [x, y + 7], [x - 7, y]], true);
  }
}

export function BackpackThumbnail({ kind, cover }: { kind: BackpackEntry["kind"]; cover: File | null }) {
  const texture = useMemo(() => createPanelTexture(TILE, TILE, ({ ctx }) => paintGlyph(ctx, kind), "en"), [kind, cover]);
  useEffect(() => {
    const cancel = new AbortController();
    if (cover) void drawLocalCover(cover, cancel.signal, image => {
      const ctx = (texture.image as HTMLCanvasElement).getContext("2d"); if (!ctx) return;
      const side = Math.min(image.width, image.height);
      ctx.save();
      try {
        roundRectPath(ctx, 0, 0, TILE, TILE, 12); ctx.clip();
        ctx.fillStyle = HUD_COLORS.control; ctx.fillRect(0, 0, TILE, TILE);
        ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, TILE, TILE);
        texture.needsUpdate = true;
      } finally { ctx.restore(); }
    });
    return () => { cancel.abort(); texture.dispose(); };
  }, [texture, cover]);
  return <mesh name={`backpack-thumbnail:${kind}`} position={[-0.93, 0, 0]} renderOrder={29} raycast={() => null}>
    <planeGeometry args={[0.17, 0.17]} /><meshBasicMaterial map={texture} transparent toneMapped={false} fog={false} depthTest={false} depthWrite={false} />
  </mesh>;
}
