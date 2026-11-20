import {useMemo,useRef,useEffect} from "react";
import type {ThreeEvent} from "@react-three/fiber";
import {createPanelTexture} from "../../shared/panelTexture";
import {HUD_COLORS} from "../hudAppearance";
export function ValueLabel({
  position,
  label,
  value,
  size = [0.58, 0.11],
  centered = false,
}: {
  position: [number, number, number];
  label: string;
  value: string;
  size?: [number, number];
  centered?: boolean;
}) {
  const textureWidth = Math.max(256, Math.round(88 * size[0] / size[1]));
  const texture = useMemo(
    () => createPanelTexture(textureWidth, 88, ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = HUD_COLORS.muted;
      ctx.font = centered ? "600 30px system-ui, sans-serif" : "500 28px system-ui, sans-serif";
      ctx.textAlign = centered ? "center" : "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, centered ? width / 2 : 12, height / 2, centered ? width - 24 : width - 105);
      if (!centered) {
        ctx.fillStyle = HUD_COLORS.ink;
        ctx.font = "650 30px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(value, width - 20, height / 2);
      }
    }, "en"),
    [centered, label, textureWidth, value],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} renderOrder={30} raycast={() => null}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} depthTest={false} fog={false} />
    </mesh>
  );
}

export function HudSlider({
  position,
  value,
  onChange,
  onInteractionChange,
  width = 0.74,
  disabled = false,
}: {
  position: [number, number, number];
  value: number;
  onChange: (value: number) => void;
  onInteractionChange: (active: boolean) => void;
  width?: number;
  disabled?: boolean;
}) {
  const pointerRef = useRef<number | null>(null);
  const pointerTargetRef = useRef<{ releasePointerCapture?: (id: number) => void } | null>(null);
  const ratio = Math.min(1, Math.max(0, value));

  function update(event: ThreeEvent<PointerEvent>) {
    if (!event.uv) return;
    onChange(Math.min(1, Math.max(0, event.uv.x)));
  }

  function begin(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (disabled || pointerRef.current != null) return;
    pointerRef.current = event.pointerId;
    pointerTargetRef.current = event.target as unknown as { releasePointerCapture?: (id: number) => void };
    onInteractionChange(true);
    update(event);
    try {
      (event.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is optional in WebXR implementations.
    }
  }

  function move(event: ThreeEvent<PointerEvent>) {
    if (pointerRef.current !== event.pointerId) return;
    event.stopPropagation();
    if (disabled) return;
    update(event);
  }

  function finish(pointerId?: number) {
    if (pointerRef.current == null || (pointerId != null && pointerRef.current !== pointerId)) return;
    const activePointerId = pointerRef.current;
    pointerRef.current = null;
    onInteractionChange(false);
    try {
      pointerTargetRef.current?.releasePointerCapture?.(activePointerId);
    } catch {
      // Pointer capture is optional in WebXR implementations.
    }
    pointerTargetRef.current = null;
  }

  function end(event: ThreeEvent<PointerEvent>) {
    if (pointerRef.current !== event.pointerId) return;
    event.stopPropagation();
    finish(event.pointerId);
  }

  useEffect(() => {
    if (disabled) finish();
  }, [disabled]);

  useEffect(() => () => finish(), [onInteractionChange]);

  return (
    <group position={position}>
      <mesh position={[0, 0, -0.004]} renderOrder={30} raycast={() => null}>
        <planeGeometry args={[width, 0.012]} />
        <meshBasicMaterial color={HUD_COLORS.track} transparent opacity={disabled ? 0.45 : 1} toneMapped={false} depthWrite={false} depthTest={false} />
      </mesh>
      {ratio > 0 ? (
        <mesh position={[-width / 2 + (width * ratio) / 2, 0, 0]} renderOrder={31} raycast={() => null}>
          <planeGeometry args={[width * ratio, 0.012]} />
          <meshBasicMaterial color={HUD_COLORS.primary} transparent opacity={disabled ? 0.45 : 1} toneMapped={false} depthWrite={false} depthTest={false} />
        </mesh>
      ) : null}
      <mesh position={[-width / 2 + width * ratio, 0, 0.006]} renderOrder={32} raycast={() => null}>
        <circleGeometry args={[0.036, 24]} />
        <meshBasicMaterial color={HUD_COLORS.primary} transparent opacity={disabled ? 0.45 : 1} toneMapped={false} depthWrite={false} depthTest={false} />
      </mesh>
      <mesh
        position={[0, 0, 0.012]}
        renderOrder={33}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      >
        <planeGeometry args={[width + 0.12, 0.16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  );
}
