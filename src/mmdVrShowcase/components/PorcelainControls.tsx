import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createPanelTexture, roundRectPath } from "../../shared/panelTexture";
import { HUD_COLORS, paintHudButton } from "../hudAppearance";
import { PRIVATE_TITLE_FACE } from "../pelvic/palette";
import { useHudKeyTexture, type KeyPainter } from "./useHudKeyTexture";

type Point = [number, number, number];
type Size = [number, number];

function roundedPlane(width: number, height: number) {
  const x = width / 2, y = height / 2, r = Math.min(0.025, height * 0.22, x);
  const shape = new THREE.Shape();
  shape.moveTo(-x + r, -y); shape.lineTo(x - r, -y);
  shape.quadraticCurveTo(x, -y, x, -y + r); shape.lineTo(x, y - r);
  shape.quadraticCurveTo(x, y, x - r, y); shape.lineTo(-x + r, y);
  shape.quadraticCurveTo(-x, y, -x, y - r); shape.lineTo(-x, -y + r);
  shape.quadraticCurveTo(-x, -y, -x + r, -y);
  const geometry = new THREE.ShapeGeometry(shape, 6);
  const pos = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / width + 0.5, pos.getY(i) / height + 0.5);
  return geometry;
}

export function HudButton({ position, label, disabled, onPress, size = [0.36, 0.13], active = false, danger = false, variant = "button" }: {
  position: Point; label: string; disabled?: boolean; onPress: () => void; size?: Size;
  active?: boolean; danger?: boolean; variant?: "button" | "tab" | "quiet" | "primary";
}) {
  const [hovered, setHovered] = useState(false), [pressed, setPressed] = useState(false);
  const pointer = useRef<number | null>(null), suppressClick = useRef(false);
  const width = size[0], height = Math.max(0.13, size[1]);
  const geometry = useMemo(() => roundedPlane(width, height), [width, height]);
  const px = Math.max(256, Math.round(88 * width / height));
  const texture = useHudKeyTexture(px, 88, useCallback<KeyPainter>(ctx =>
    paintHudButton(ctx, label, { active, danger, disabled, variant, hovered }), [label, active, danger, disabled, variant, hovered]));
  useEffect(() => () => geometry.dispose(), [geometry]);
  function cancel() {
    if (pointer.current !== null) suppressClick.current = true;
    pointer.current = null; setPressed(false);
  }
  return <mesh name={`hud:${label}`} position={position} renderOrder={30} scale={pressed ? 0.985 : 1}
    onPointerEnter={e => { e.stopPropagation(); if (!disabled) setHovered(true); }}
    onPointerLeave={e => { e.stopPropagation(); setHovered(false); cancel(); }}
    onPointerCancel={e => { e.stopPropagation(); cancel(); }}
    onPointerDown={e => {
      e.stopPropagation(); if (disabled || pointer.current !== null) return;
      pointer.current = e.pointerId; suppressClick.current = false; setPressed(true);
    }}
    onPointerUp={e => {
      e.stopPropagation(); if (pointer.current !== e.pointerId) return;
      pointer.current = null; setPressed(false); suppressClick.current = true;
      if (!disabled) onPress();
    }}
    onClick={e => {
      e.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return; }
      if (!disabled) onPress();
    }}>
    <primitive object={geometry} attach="geometry" />
    <meshBasicMaterial map={texture} transparent toneMapped={false} fog={false} depthTest={false} depthWrite={false} />
  </mesh>;
}

/** A single quiet surface behind the tools. It also catches rays between buttons. */
export function HudSheet({ size }: { size: Size }) {
  const w = Math.round(size[0] * 320), h = Math.round(size[1] * 320);
  const texture = useMemo(() => createPanelTexture(w, h, ({ ctx }) => {
    roundRectPath(ctx, 1, 1, w-2, h-2, 12); ctx.fillStyle = HUD_COLORS.surface; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = HUD_COLORS.border; ctx.stroke();
  }, "en"), [w, h]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh position-z={-0.018} renderOrder={10} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
    <planeGeometry args={size} /><meshBasicMaterial map={texture} transparent toneMapped={false} fog={false} depthTest={false} depthWrite={false} />
  </mesh>;
}

/** Ellipsize long source names in the middle so the package and file extension survive. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number) {
  if (ctx.measureText(text).width <= width) return text;
  const chars = Array.from(text);
  let lo = 0, hi = chars.length - 1;
  const cut = (n: number) => chars.slice(0, Math.ceil(n / 2)).join("") + "…" + chars.slice(chars.length - Math.floor(n / 2)).join("");
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (ctx.measureText(cut(mid)).width <= width) lo = mid; else hi = mid - 1; }
  return cut(lo);
}

export function HudLine({ position, text, width, role = "body", center = false }: {
  position: Point; text: string; width: number; role?: "title" | "body" | "muted" | "warning"; center?: boolean;
}) {
  const px = Math.round(width * 560);
  const texture = useMemo(() => createPanelTexture(px, 64, ({ ctx }) => {
    ctx.fillStyle = role === "warning" ? HUD_COLORS.danger : role === "muted" ? HUD_COLORS.muted : HUD_COLORS.ink;
    ctx.font = role === "title" ? `650 34px ${PRIVATE_TITLE_FACE}` : `${role === "muted" ? "450 24" : "550 28"}px system-ui, sans-serif`;
    ctx.textBaseline = "middle"; ctx.textAlign = center ? "center" : "left";
    ctx.fillText(fit(ctx, text, px - 8), center ? px / 2 : 4, 32);
  }, "en"), [px, text, role, center]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh name={`hud-label:${text}`} position={position} renderOrder={30} raycast={() => null}>
    <planeGeometry args={[width, 64 / 560]} /><meshBasicMaterial map={texture} transparent toneMapped={false} fog={false} depthTest={false} depthWrite={false} />
  </mesh>;
}
