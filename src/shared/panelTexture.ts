import * as THREE from "three";

export type PanelPaintContext = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  language: "zh" | "en";
};

export function createPanelTexture(
  width: number,
  height: number,
  paint: (p: PanelPaintContext) => void,
  language: "zh" | "en",
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) paint({ ctx, width, height, language });
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  // UI planes: no mips — cheaper updates on clock/hover redraw.
  map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Map plane UV (0–1) to canvas pixel and find a hit by rect. */
export function hitTestByUv<T extends { rect: { x: number; y: number; w: number; h: number } }>(
  uv: THREE.Vector2 | undefined,
  texW: number,
  texH: number,
  hits: T[],
): T | undefined {
  if (!uv) return undefined;
  const px = uv.x * texW;
  const py = (1 - uv.y) * texH;
  return hits.find(
    (h) => px >= h.rect.x && px <= h.rect.x + h.rect.w && py >= h.rect.y && py <= h.rect.y + h.rect.h,
  );
}

/** Quiet secondary control (exit / reset / HUD buttons). Colors match VR shell. */
const SECONDARY_BTN = {
  fill: "#211d20",
  border: "#51454b",
  ink: "#eee6e9",
} as const;

export function paintSecondaryButton(
  p: Pick<PanelPaintContext, "ctx" | "width" | "height">,
  label: string,
) {
  const { ctx, width: w, height: h } = p;
  const r = Math.min(20, h / 2);
  roundRectPath(ctx, 1, 1, w - 2, h - 2, r);
  ctx.fillStyle = SECONDARY_BTN.fill;
  ctx.fill();
  ctx.strokeStyle = SECONDARY_BTN.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = SECONDARY_BTN.ink;
  ctx.font = "600 32px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, h / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function paintFpsBadge(
  p: Pick<PanelPaintContext, "ctx" | "width" | "height">,
  fps: number,
) {
  const { ctx, width: w, height: h } = p;
  ctx.clearRect(0, 0, w, h);
  roundRectPath(ctx, 0, 0, w, h, 12);
  ctx.fillStyle = "rgba(12, 16, 24, 0.72)";
  ctx.fill();
  ctx.fillStyle = fps >= 72 ? "#7dcea0" : fps >= 50 ? "#e0b84a" : "#e07a7a";
  ctx.font = "700 36px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${fps}`, w / 2, h / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}
