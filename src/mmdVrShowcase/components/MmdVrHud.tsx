import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createPanelTexture, roundRectPath } from "../../shared/panelTexture";
import { getMmdVrClock } from "../mmdVrClock";
import { getMmdVrRenderProfile } from "../mmdVrQuality";
import { normalizeMmdVrExposure, useMmdVrStore } from "../mmdVrStore";
import { useMmdVrTheme } from "../mmdVrTheme";
import {
  formatMmdVrModelScale,
  MMD_VR_HEIGHT_OFFSET_FINE_STEP,
  mmdVrHeightOffsetToSlider,
  mmdVrModelScaleToSlider,
  mmdVrSliderToHeightOffset,
  mmdVrSliderToModelScale,
  mmdVrSliderToViewDistance,
  mmdVrViewDistanceToSlider,
} from "../mmdVrAdjustments";
import { hexToRgba } from "../../xr";

/** Match paintProgressBar track insets (px on 640-wide canvas). */
const PROGRESS_PAD = 16;
const PANEL_DEFAULT_POSITION: [number, number, number] = [0, 1.2, -1.55];

export function clampMmdVrHudPosition(position: THREE.Vector3): [number, number, number] {
  return [
    Math.min(1.8, Math.max(-1.8, position.x)),
    Math.min(2.25, Math.max(0.65, position.y)),
    Math.min(-0.5, Math.max(-5, position.z)),
  ];
}

type HudDragState = {
  pointerId: number;
  offset: THREE.Vector3;
  rayDistance: number;
};

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function shortName(name: string, max = 8) {
  const base = name.replace(/\.[^.]+$/, "");
  if (base.length <= max) return base;
  return `${base.slice(0, max - 1)}…`;
}

function createRoundedPlaneGeometry(width: number, height: number, radius: number) {
  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.min(radius, halfW, halfH);
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfH);
  shape.lineTo(halfW - r, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
  shape.lineTo(halfW, halfH - r);
  shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
  shape.lineTo(-halfW + r, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
  shape.lineTo(-halfW, -halfH + r);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);

  const geometry = new THREE.ShapeGeometry(shape, 6);
  const positions = geometry.getAttribute("position");
  const uvs = geometry.getAttribute("uv");
  for (let index = 0; index < positions.count; index += 1) {
    uvs.setXY(index, positions.getX(index) / width + 0.5, positions.getY(index) / height + 0.5);
  }
  uvs.needsUpdate = true;
  return geometry;
}

function HudButton({
  position,
  label,
  disabled,
  onPress,
  size = [0.36, 0.11] as [number, number],
  active = false,
  danger = false,
}: {
  position: [number, number, number];
  label: string;
  disabled?: boolean;
  onPress: () => void;
  size?: [number, number];
  active?: boolean;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const { accent } = useMmdVrTheme();
  const geometry = useMemo(
    () => createRoundedPlaneGeometry(size[0], size[1], Math.min(0.025, size[1] * 0.22)),
    [size[0], size[1]],
  );
  const textureWidth = Math.max(256, Math.round(88 * size[0] / size[1]));
  const texture = useMemo(
    () =>
      createPanelTexture(
        textureWidth,
        88,
        ({ ctx, width, height }) => {
          ctx.fillStyle = active
            ? accent.border
            : danger
              ? "#9b5262"
              : accent.border;
          ctx.fillRect(0, 0, width, height);
          roundRectPath(ctx, 6, 6, width - 12, height - 12, 15);
          ctx.fillStyle = active
            ? hexToRgba(accent.primary, 0.68)
            : danger
              ? "#532a34"
              : accent.soft;
          ctx.fill();
          ctx.fillStyle = active ? accent.marker : danger ? "#e48296" : "rgba(255, 255, 255, 0.09)";
          ctx.fillRect(18, 6, width - 36, 4);
          ctx.fillStyle = danger ? "#f8eef1" : accent.ink;
          ctx.font = "650 31px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, width / 2, height / 2 + 1);
        },
        "en",
      ),
    [accent.border, accent.ink, accent.marker, accent.primary, active, danger, label, textureWidth],
  );

  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      position={position}
      renderOrder={30}
      scale={pressed ? 0.97 : hovered ? 1.025 : 1}
      onPointerEnter={(e) => {
        e.stopPropagation();
        if (!disabled) setHovered(true);
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
        setPressed(false);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (disabled) return;
        setPressed(true);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        setPressed(false);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onPress();
      }}
    >
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        transparent
        fog={false}
        opacity={disabled ? 0.45 : 1}
        color="#ffffff"
        side={THREE.FrontSide}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

function PanelBackdrop() {
  const { accent } = useMmdVrTheme();
  const texture = useMemo(
    () => createPanelTexture(1400, 620, ({ ctx, width, height }) => {
      roundRectPath(ctx, 2, 2, width - 4, height - 4, 28);
      ctx.fillStyle = accent.soft;
      ctx.fill();
      ctx.strokeStyle = accent.border;
      ctx.lineWidth = 5;
      ctx.stroke();
      roundRectPath(ctx, 26, 22, width - 52, 92, 18);
      ctx.fillStyle = hexToRgba(accent.primary, 0.16);
      ctx.fill();
      ctx.fillStyle = accent.primary;
      ctx.fillRect(26, 109, width - 52, 5);
      roundRectPath(ctx, 30, 154, width - 60, 155, 16);
      ctx.fillStyle = hexToRgba(accent.primary, 0.08);
      ctx.fill();
      roundRectPath(ctx, 30, 340, width - 60, 238, 16);
      ctx.fillStyle = hexToRgba(accent.primary, 0.1);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.075)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }, "en"),
    [accent.border, accent.primary, accent.soft],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh
      position={[0.16, -0.08, -0.018]}
      renderOrder={10}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <planeGeometry args={[3.4, 1.16]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} depthTest={false} alphaTest={0.02} fog={false} />
    </mesh>
  );
}

function DragHandle({
  label,
  onDragChange,
  onPositionChange,
  position = [0.16, 0.56, 0.012],
}: {
  label: string;
  onDragChange: (dragging: boolean) => void;
  onPositionChange: (position: [number, number, number]) => void;
  position?: [number, number, number];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const dragRef = useRef<HudDragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const { accent } = useMmdVrTheme();
  const texture = useMemo(
    () => createPanelTexture(720, 72, ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      roundRectPath(ctx, 1, 1, width - 2, height - 2, 18);
      ctx.fillStyle = dragging ? hexToRgba(accent.primary, 0.82) : accent.soft;
      ctx.fill();
      ctx.fillStyle = accent.ink;
      ctx.font = "650 25px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`⋮⋮  ${label}`, width / 2, height / 2);
    }, "en"),
    [accent.ink, accent.primary, accent.soft, dragging, label],
  );

  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => finish(), [onDragChange]);

  function finish(pointerId?: number) {
    const drag = dragRef.current;
    if (!drag || (pointerId != null && drag.pointerId !== pointerId)) return;
    dragRef.current = null;
    setDragging(false);
    onDragChange(false);
  }

  function begin(e: ThreeEvent<PointerEvent>) {
    const handle = groupRef.current;
    const panel = handle?.parent;
    const parent = panel?.parent;
    if (!panel || !parent) return;
    e.stopPropagation();
    if (dragRef.current) return;
    const localHit = parent.worldToLocal(e.point.clone());
    dragRef.current = {
      pointerId: e.pointerId,
      offset: panel.position.clone().sub(localHit),
      rayDistance: e.ray.origin.distanceTo(e.point),
    };
    setDragging(true);
    onDragChange(true);
    try {
      (e.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(e.pointerId);
    } catch {
      // Pointer capture is optional in WebXR implementations.
    }
  }

  function move(e: ThreeEvent<PointerEvent>) {
    const drag = dragRef.current;
    const panel = groupRef.current?.parent;
    const parent = panel?.parent;
    if (!drag || !panel || !parent || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const worldHit = e.ray.at(drag.rayDistance, new THREE.Vector3());
    const local = parent.worldToLocal(worldHit).add(drag.offset);
    const next = clampMmdVrHudPosition(local);
    panel.position.set(...next);
    onPositionChange(next);
  }

  function end(e: ThreeEvent<PointerEvent>) {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    e.stopPropagation();
    finish(e.pointerId);
    try {
      (e.target as unknown as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(e.pointerId);
    } catch {
      // Ignore unsupported capture release.
    }
  }

  return (
    <group ref={groupRef} position={position}>
      <mesh
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      >
        <planeGeometry args={[0.92, 0.11]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} depthTest={false} fog={false} />
      </mesh>
    </group>
  );
}

function ValueLabel({
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
  const { accent } = useMmdVrTheme();
  const textureWidth = Math.max(256, Math.round(88 * size[0] / size[1]));
  const texture = useMemo(
    () => createPanelTexture(textureWidth, 88, ({ ctx, width, height }) => {
      ctx.clearRect(0, 0, width, height);
      roundRectPath(ctx, 2, 2, width - 4, height - 4, 16);
      ctx.fillStyle = accent.soft;
      ctx.fill();
      ctx.strokeStyle = accent.border;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = accent.muted;
      ctx.font = centered ? "700 30px system-ui, sans-serif" : "600 23px system-ui, sans-serif";
      ctx.textAlign = centered ? "center" : "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, centered ? width / 2 : 20, height / 2);
      if (!centered) {
        ctx.fillStyle = accent.ink;
        ctx.font = "700 30px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(value, width - 20, height / 2);
      }
    }, "en"),
    [accent.border, accent.ink, accent.muted, accent.soft, centered, label, textureWidth, value],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} renderOrder={30} raycast={() => null}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} depthTest={false} fog={false} />
    </mesh>
  );
}

function HudSlider({
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
  const { accent } = useMmdVrTheme();
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
        <planeGeometry args={[width, 0.035]} />
        <meshBasicMaterial color={accent.track} transparent opacity={disabled ? 0.45 : 1} toneMapped={false} depthWrite={false} depthTest={false} />
      </mesh>
      {ratio > 0 ? (
        <mesh position={[-width / 2 + (width * ratio) / 2, 0, 0]} renderOrder={31} raycast={() => null}>
          <planeGeometry args={[width * ratio, 0.035]} />
          <meshBasicMaterial color={accent.primary} transparent opacity={disabled ? 0.45 : 1} toneMapped={false} depthWrite={false} depthTest={false} />
        </mesh>
      ) : null}
      <mesh position={[-width / 2 + width * ratio, 0, 0.006]} renderOrder={32} raycast={() => null}>
        <circleGeometry args={[0.055, 24]} />
        <meshBasicMaterial color={accent.marker} transparent opacity={disabled ? 0.45 : 1} toneMapped={false} depthWrite={false} depthTest={false} />
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

function StatusPlane({ text }: { text: string }) {
  const { accent } = useMmdVrTheme();
  const texture = useMemo(
    () =>
      createPanelTexture(
        720,
        96,
        ({ ctx, width, height }) => {
          ctx.clearRect(0, 0, width, height);
          roundRectPath(ctx, 2, 2, width - 4, height - 4, 18);
          ctx.fillStyle = accent.soft;
          ctx.fill();
          ctx.fillStyle = accent.marker;
          ctx.beginPath();
          ctx.arc(34, height / 2, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = accent.ink;
          ctx.font = "600 26px system-ui, sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(text.slice(0, 48), 58, height / 2);
        },
        "en",
      ),
    [accent.ink, accent.marker, accent.soft, text],
  );

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  return (
    <mesh position={[0, 0.42, 0]} renderOrder={30}>
      <planeGeometry args={[1.05, 0.12]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent fog={false} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

function ProgressBar({ onInteractionChange }: { onInteractionChange: (active: boolean) => void }) {
  const duration = useMmdVrStore((s) => s.duration);
  const modelCount = useMmdVrStore((s) => s.modelCount);
  const requestSeek = useMmdVrStore((s) => s.requestSeek);
  const { accent } = useMmdVrTheme();

  const texture = useMemo(
    () =>
      createPanelTexture(
        640,
        72,
        ({ ctx, width, height }) => {
          ctx.clearRect(0, 0, width, height);
          roundRectPath(ctx, 0, 0, width, height, 16);
          ctx.fillStyle = accent.soft;
          ctx.fill();
          ctx.fillStyle = accent.track;
          ctx.fillRect(PROGRESS_PAD, height / 2 - 6, width - PROGRESS_PAD * 2, 12);
          ctx.fillStyle = accent.muted;
          ctx.font = "600 22px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("0:00 / 0:00", width / 2, height / 2);
        },
        "en",
      ),
    [accent.muted, accent.primary, accent.soft, accent.track],
  );

  const lastPaintVersionRef = useRef(-1);
  const pointerRef = useRef<number | null>(null);
  const pointerTargetRef = useRef<{ releasePointerCapture?: (id: number) => void } | null>(null);

  function updateSeek(event: ThreeEvent<PointerEvent>) {
    const uv = event.uv;
    if (!uv) return;
    const trackStart = PROGRESS_PAD / 640;
    const trackEnd = 1 - PROGRESS_PAD / 640;
    const ratio = Math.min(1, Math.max(0, (uv.x - trackStart) / (trackEnd - trackStart)));
    requestSeek(ratio * useMmdVrStore.getState().duration);
  }

  function beginSeek(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (pointerRef.current != null) return;
    pointerRef.current = event.pointerId;
    pointerTargetRef.current = event.target as unknown as { releasePointerCapture?: (id: number) => void };
    onInteractionChange(true);
    updateSeek(event);
    try {
      (event.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is optional in WebXR implementations.
    }
  }

  function moveSeek(event: ThreeEvent<PointerEvent>) {
    if (pointerRef.current !== event.pointerId) return;
    event.stopPropagation();
    updateSeek(event);
  }

  function finishSeek(pointerId?: number) {
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

  function endSeek(event: ThreeEvent<PointerEvent>) {
    if (pointerRef.current !== event.pointerId) return;
    event.stopPropagation();
    finishSeek(event.pointerId);
  }

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );
  useEffect(() => () => finishSeek(), [onInteractionChange]);
  useEffect(() => {
    if (modelCount === 0 || duration <= 0) finishSeek();
  }, [duration, modelCount]);

  useFrame(() => {
    if (modelCount === 0) return;
    const clock = getMmdVrClock();
    if (clock.duration <= 0) return;
    if (clock.paintVersion === lastPaintVersionRef.current) return;
    lastPaintVersionRef.current = clock.paintVersion;

    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = 640;
    const h = 72;
    const trackW = w - PROGRESS_PAD * 2;
    const ratio = Math.min(1, Math.max(0, clock.time / clock.duration));
    ctx.clearRect(0, 0, w, h);
    roundRectPath(ctx, 0, 0, w, h, 16);
    ctx.fillStyle = accent.soft;
    ctx.fill();
    ctx.fillStyle = accent.track;
    ctx.fillRect(PROGRESS_PAD, h / 2 - 6, trackW, 12);
    ctx.fillStyle = accent.primary;
    ctx.fillRect(PROGRESS_PAD, h / 2 - 6, trackW * ratio, 12);
    ctx.fillStyle = accent.muted;
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${formatTime(clock.time)} / ${formatTime(clock.duration)}`, w / 2, h / 2);
    texture.needsUpdate = true;
  });

  if (modelCount === 0 || duration <= 0) return null;

  return (
    <mesh
      position={[0, 0.22, 0]}
      renderOrder={30}
      onPointerDown={beginSeek}
      onPointerMove={moveSeek}
      onPointerUp={endSeek}
      onPointerCancel={endSeek}
      onLostPointerCapture={endSeek}
    >
      <planeGeometry args={[1.05, 0.1]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent fog={false} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

function ModelPanelBackdrop() {
  const { accent } = useMmdVrTheme();
  const texture = useMemo(
    () => createPanelTexture(720, 620, ({ ctx, width, height }) => {
      roundRectPath(ctx, 2, 2, width - 4, height - 4, 24);
      ctx.fillStyle = accent.soft;
      ctx.fill();
      ctx.strokeStyle = accent.border;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = accent.primary;
      ctx.fillRect(24, 21, width - 48, 6);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(28, 142);
      ctx.lineTo(width - 28, 142);
      ctx.moveTo(28, 326);
      ctx.lineTo(width - 28, 326);
      ctx.stroke();
    }, "en"),
    [accent.border, accent.primary, accent.soft],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={[0, 0, -0.015]} renderOrder={10} onPointerDown={(event) => event.stopPropagation()}>
      <planeGeometry args={[1.02, 0.88]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} depthTest={false} fog={false} />
    </mesh>
  );
}

function ModelPanel({
  modelId,
  position,
  hideLabel,
  showLabel,
  placeOnLabel,
  placeOffLabel,
  scaleLabel,
  resetValueLabel,
  rotateLeftLabel,
  rotateRightLabel,
  removeLabel,
  materialsLabel,
  onInteractionChange,
}: {
  modelId: string;
  position: [number, number, number];
  hideLabel: string;
  showLabel: string;
  placeOnLabel: string;
  placeOffLabel: string;
  scaleLabel: string;
  resetValueLabel: string;
  rotateLeftLabel: string;
  rotateRightLabel: string;
  removeLabel: string;
  materialsLabel: string;
  onInteractionChange: (active: boolean) => void;
}) {
  const model = useMmdVrStore((s) => s.models.find((entry) => entry.id === modelId));
  const placeMode = useMmdVrStore((s) => s.placeMode);
  const placeModelId = useMmdVrStore((s) => s.placeModelId);
  const enqueueVisibilityToggle = useMmdVrStore((s) => s.enqueueVisibilityToggle);
  const setPlaceModelId = useMmdVrStore((s) => s.setPlaceModelId);
  const setPlaceMode = useMmdVrStore((s) => s.setPlaceMode);
  const requestModelScale = useMmdVrStore((s) => s.requestModelScale);
  const requestModelRotation = useMmdVrStore((s) => s.requestModelRotation);
  const requestModelReset = useMmdVrStore((s) => s.requestModelReset);
  const enqueueModelRemoval = useMmdVrStore((s) => s.enqueueModelRemoval);
  const setMaterialPanelModelId = useMmdVrStore((s) => s.setMaterialPanelModelId);
  const hasMaterials = useMmdVrStore((s) => (s.materialModels[modelId]?.length ?? 0) > 0);

  if (!model) return null;
  const placementActive = placeMode && placeModelId === model.id;
  const setScale = (scale: number) => requestModelScale(model.id, scale);

  return (
    <group position={position}>
      <ModelPanelBackdrop />
      <ValueLabel position={[0, 0.34, 0]} label={shortName(model.name, 14)} value={model.visible ? "●" : "○"} />
      <HudButton
        position={[-0.25, 0.19, 0]}
        label={model.visible ? hideLabel : showLabel}
        size={[0.42, 0.11]}
        onPress={() => enqueueVisibilityToggle(model.id)}
      />
      <HudButton
        position={[0.25, 0.19, 0]}
        label={placementActive ? placeOnLabel : placeOffLabel}
        active={placementActive}
        size={[0.42, 0.11]}
        onPress={() => {
          if (placementActive) {
            setPlaceMode(false);
          } else {
            setPlaceModelId(model.id);
            setPlaceMode(true);
          }
        }}
      />
      <ValueLabel position={[0, 0.02, 0]} label={scaleLabel} value={formatMmdVrModelScale(model.scale)} />
      <HudSlider
        position={[0, -0.12, 0]}
        value={mmdVrModelScaleToSlider(model.scale)}
        onChange={(value) => setScale(mmdVrSliderToModelScale(value))}
        onInteractionChange={onInteractionChange}
      />
      <HudButton position={[-0.36, -0.31, 0]} label={rotateLeftLabel} size={[0.22, 0.1]} onPress={() => requestModelRotation(model.id, model.rotationY - 15)} />
      <HudButton position={[-0.12, -0.31, 0]} label={resetValueLabel} size={[0.22, 0.1]} onPress={() => requestModelReset(model.id)} />
      <HudButton position={[0.12, -0.31, 0]} label={rotateRightLabel} size={[0.22, 0.1]} onPress={() => requestModelRotation(model.id, model.rotationY + 15)} />
      <HudButton position={[0.36, -0.31, 0]} label={removeLabel} size={[0.22, 0.1]} danger onPress={() => enqueueModelRemoval(model.id)} />
      <HudButton
        position={[0, -0.42, 0]}
        label={materialsLabel}
        size={[0.42, 0.08]}
        disabled={!hasMaterials}
        onPress={() => setMaterialPanelModelId(model.id)}
      />
    </group>
  );
}

function ModelPanels(props: Pick<Parameters<typeof ModelPanel>[0], "hideLabel" | "showLabel" | "placeOnLabel" | "placeOffLabel" | "scaleLabel" | "resetValueLabel" | "rotateLeftLabel" | "rotateRightLabel" | "removeLabel" | "materialsLabel" | "onInteractionChange">) {
  const models = useMmdVrStore((s) => s.models);
  const spacing = 1.1;
  return (
    <group position={[0.16, -1.14, 0.02]}>
      {models.slice(0, 3).map((model, index) => (
        <ModelPanel
          key={model.id}
          {...props}
          modelId={model.id}
          position={[(index - (models.length - 1) / 2) * spacing, 0, 0]}
        />
      ))}
    </group>
  );
}

function ObjectPanel({
  objectId,
  position,
  hideLabel,
  showLabel,
  placeOnLabel,
  placeOffLabel,
  scaleLabel,
  resetValueLabel,
  rotateLeftLabel,
  rotateRightLabel,
  removeLabel,
  onInteractionChange,
}: {
  objectId: string;
  position: [number, number, number];
  hideLabel: string;
  showLabel: string;
  placeOnLabel: string;
  placeOffLabel: string;
  scaleLabel: string;
  resetValueLabel: string;
  rotateLeftLabel: string;
  rotateRightLabel: string;
  removeLabel: string;
  onInteractionChange: (active: boolean) => void;
}) {
  const object = useMmdVrStore((s) => s.objects.find((entry) => entry.id === objectId));
  const placeMode = useMmdVrStore((s) => s.placeMode);
  const placeModelId = useMmdVrStore((s) => s.placeModelId);
  const enqueueVisibilityToggle = useMmdVrStore((s) => s.enqueueVisibilityToggle);
  const setPlaceModelId = useMmdVrStore((s) => s.setPlaceModelId);
  const setPlaceMode = useMmdVrStore((s) => s.setPlaceMode);
  const requestModelScale = useMmdVrStore((s) => s.requestModelScale);
  const requestModelRotation = useMmdVrStore((s) => s.requestModelRotation);
  const requestModelReset = useMmdVrStore((s) => s.requestModelReset);
  const enqueueModelRemoval = useMmdVrStore((s) => s.enqueueModelRemoval);

  if (!object) return null;
  const placementActive = placeMode && placeModelId === object.id;
  const setScale = (scale: number) => requestModelScale(object.id, scale);

  return (
    <group position={position}>
      <ModelPanelBackdrop />
      <ValueLabel position={[0, 0.34, 0]} label={shortName(object.name, 14)} value={object.visible ? "●" : "○"} />
      <HudButton
        position={[-0.25, 0.19, 0]}
        label={object.visible ? hideLabel : showLabel}
        size={[0.42, 0.11]}
        onPress={() => enqueueVisibilityToggle(object.id)}
      />
      <HudButton
        position={[0.25, 0.19, 0]}
        label={placementActive ? placeOnLabel : placeOffLabel}
        active={placementActive}
        size={[0.42, 0.11]}
        onPress={() => {
          if (placementActive) {
            setPlaceMode(false);
          } else {
            setPlaceModelId(object.id);
            setPlaceMode(true);
          }
        }}
      />
      <ValueLabel position={[0, 0.02, 0]} label={scaleLabel} value={formatMmdVrModelScale(object.scale)} />
      <HudSlider
        position={[0, -0.12, 0]}
        value={mmdVrModelScaleToSlider(object.scale)}
        onChange={(value) => setScale(mmdVrSliderToModelScale(value))}
        onInteractionChange={onInteractionChange}
      />
      <HudButton position={[-0.36, -0.31, 0]} label={rotateLeftLabel} size={[0.22, 0.1]} onPress={() => requestModelRotation(object.id, object.rotationY - 15)} />
      <HudButton position={[-0.12, -0.31, 0]} label={resetValueLabel} size={[0.22, 0.1]} onPress={() => requestModelReset(object.id)} />
      <HudButton position={[0.12, -0.31, 0]} label={rotateRightLabel} size={[0.22, 0.1]} onPress={() => requestModelRotation(object.id, object.rotationY + 15)} />
      <HudButton position={[0.36, -0.31, 0]} label={removeLabel} size={[0.22, 0.1]} danger onPress={() => enqueueModelRemoval(object.id)} />
    </group>
  );
}

function ObjectPanels(props: Pick<Parameters<typeof ObjectPanel>[0], "hideLabel" | "showLabel" | "placeOnLabel" | "placeOffLabel" | "scaleLabel" | "resetValueLabel" | "rotateLeftLabel" | "rotateRightLabel" | "removeLabel" | "onInteractionChange">) {
  const objects = useMmdVrStore((s) => s.objects);
  const spacing = 1.1;
  return (
    <group position={[0.16, -2.34, 0.02]}>
      {objects.slice(0, 3).map((object, index) => (
        <ObjectPanel
          key={object.id}
          {...props}
          objectId={object.id}
          position={[(index - (objects.length - 1) / 2) * spacing, 0, 0]}
        />
      ))}
    </group>
  );
}

function MaterialPanel({
  hideLabel,
  showLabel,
  materialsLabel,
  opacityLabel,
  roughnessLabel,
  metallicLabel,
  emissionLabel,
  closeLabel,
  disabled,
  onInteractionChange,
}: {
  hideLabel: string;
  showLabel: string;
  materialsLabel: string;
  opacityLabel: string;
  roughnessLabel: string;
  metallicLabel: string;
  emissionLabel: string;
  closeLabel: string;
  disabled: boolean;
  onInteractionChange: (active: boolean) => void;
}) {
  const modelId = useMmdVrStore((s) => s.materialPanelModelId);
  const setModelId = useMmdVrStore((s) => s.setMaterialPanelModelId);
  const model = useMmdVrStore((s) => s.models.find((m) => m.id === modelId));
  const materials = useMmdVrStore((s) => (modelId ? s.materialModels[modelId] ?? [] : []));
  const setMaterialVisible = useMmdVrStore((s) => s.setMaterialVisible);
  const setMaterialParam = useMmdVrStore((s) => s.setMaterialParam);
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedMat, setSelectedMat] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => { setView("list"); setSelectedMat(null); setPage(0); }, [modelId]);

  if (!modelId || !model) return null;
  const selectedState = materials.find((m) => m.name === selectedMat) ?? null;
  const perPage = 7;
  const pageCount = Math.max(1, Math.ceil(materials.length / perPage));
  const curPage = Math.min(page, pageCount - 1);
  const slice = materials.slice(curPage * perPage, curPage * perPage + perPage);

  return (
    <group position={[0, -2.0, 0.02]}>
      <group scale={[1.6, 1.5, 1]}>
        <ModelPanelBackdrop />
      </group>
      <HudButton position={[-0.6, 0.38, 0]} label={view === "detail" ? materialsLabel : closeLabel} size={[0.28, 0.09]} onPress={() => {
        if (view === "detail") { setView("list"); setSelectedMat(null); }
        else setModelId(null);
      }} />
      <ValueLabel position={[0.1, 0.38, 0]} label={view === "detail" ? shortName(selectedMat ?? "", 16) : `${materialsLabel}: ${shortName(model.name, 12)}`} value="" />
      {view === "list" ? (
        <>
          {slice.map((mat, i) => {
            const y = 0.22 - i * 0.12;
            return (
              <group key={mat.name}>
                <HudButton
                  position={[-0.56, y, 0]}
                  label={mat.visible ? hideLabel : showLabel}
                  size={[0.14, 0.07]}
                  active={mat.visible}
                  disabled={disabled}
                  onPress={() => setMaterialVisible(modelId, mat.name, !mat.visible)}
                />
                <HudButton
                  position={[-0.18, y, 0]}
                  label={shortName(mat.name, 14)}
                  size={[0.62, 0.07]}
                  onPress={() => { setSelectedMat(mat.name); setView("detail"); }}
                />
              </group>
            );
          })}
          {pageCount > 1 ? (
            <>
              <HudButton position={[-0.26, -0.68, 0]} label="‹" size={[0.16, 0.07]} disabled={curPage === 0} onPress={() => setPage(Math.max(0, curPage - 1))} />
              <ValueLabel position={[0, -0.68, 0]} label={`${curPage + 1}/${pageCount}`} value="" size={[0.22, 0.07]} centered />
              <HudButton position={[0.26, -0.68, 0]} label="›" size={[0.16, 0.07]} disabled={curPage >= pageCount - 1} onPress={() => setPage(Math.min(pageCount - 1, curPage + 1))} />
            </>
          ) : null}
        </>
      ) : selectedState ? (
        <>
          <ValueLabel position={[-0.5, 0.25, 0]} label={opacityLabel} value={selectedState.opacity.toFixed(2)} />
          <HudSlider position={[0.1, 0.25, 0]} width={0.6} value={selectedState.opacity} onChange={(v) => setMaterialParam(modelId, selectedState.name, "opacity", v)} onInteractionChange={onInteractionChange} disabled={disabled} />
          <ValueLabel position={[-0.5, 0.09, 0]} label={roughnessLabel} value={selectedState.roughness.toFixed(2)} />
          <HudSlider position={[0.1, 0.09, 0]} width={0.6} value={selectedState.roughness} onChange={(v) => setMaterialParam(modelId, selectedState.name, "roughness", v)} onInteractionChange={onInteractionChange} disabled={disabled} />
          <ValueLabel position={[-0.5, -0.07, 0]} label={metallicLabel} value={selectedState.metallic.toFixed(2)} />
          <HudSlider position={[0.1, -0.07, 0]} width={0.6} value={selectedState.metallic} onChange={(v) => setMaterialParam(modelId, selectedState.name, "metallic", v)} onInteractionChange={onInteractionChange} disabled={disabled} />
          <ValueLabel position={[-0.5, -0.23, 0]} label={emissionLabel} value={selectedState.emission.toFixed(2)} />
          <HudSlider position={[0.1, -0.23, 0]} width={0.6} value={Math.min(1, selectedState.emission / 2)} onChange={(v) => setMaterialParam(modelId, selectedState.name, "emission", v * 2)} onInteractionChange={onInteractionChange} disabled={disabled} />
          <HudButton position={[-0.3, -0.48, 0]} label={selectedState.visible ? hideLabel : showLabel} size={[0.22, 0.08]} active={selectedState.visible} disabled={disabled} onPress={() => setMaterialVisible(modelId, selectedState.name, !selectedState.visible)} />
        </>
      ) : null}
    </group>
  );
}

function VisualSettingsPanel({
  lightStageLabel,
  lightSoftLabel,
  lightContrastLabel,
  lightDaylightLabel,
  lightWarmLabel,
  lightRimLabel,
  exposureLabel,
  resetValueLabel,
  skyOnLabel,
  skyOffLabel,
  fogOnLabel,
  fogOffLabel,
  rimLightOnLabel,
  rimLightOffLabel,
  lightPoolOnLabel,
  lightPoolOffLabel,
  handTrackingOnLabel,
  handTrackingOffLabel,
  onInteractionChange,
}: {
  lightStageLabel: string;
  lightSoftLabel: string;
  lightContrastLabel: string;
  lightDaylightLabel: string;
  lightWarmLabel: string;
  lightRimLabel: string;
  exposureLabel: string;
  resetValueLabel: string;
  skyOnLabel: string;
  skyOffLabel: string;
  fogOnLabel: string;
  fogOffLabel: string;
  rimLightOnLabel: string;
  rimLightOffLabel: string;
  lightPoolOnLabel: string;
  lightPoolOffLabel: string;
  handTrackingOnLabel: string;
  handTrackingOffLabel: string;
  onInteractionChange: (active: boolean) => void;
}) {
  const prefs = useMmdVrStore((s) => s.prefs);
  const setPrefs = useMmdVrStore((s) => s.setPrefs);
  const cycleLightPreset = useMmdVrStore((s) => s.cycleLightPreset);
  const lightLabel = prefs.lightPreset === "soft"
    ? lightSoftLabel
    : prefs.lightPreset === "contrast"
      ? lightContrastLabel
      : prefs.lightPreset === "daylight"
        ? lightDaylightLabel
        : prefs.lightPreset === "warm"
          ? lightWarmLabel
          : prefs.lightPreset === "rim"
            ? lightRimLabel
            : lightStageLabel;

  return (
    <group position={[0.16, -1.08, 0.02]}>
      <group scale={[2.35, 1.2, 1]}>
        <ModelPanelBackdrop />
      </group>
      <HudButton position={[-0.72, 0.17, 0]} label={lightLabel} size={[0.7, 0.11]} onPress={cycleLightPreset} />
      <HudButton
        position={[0.08, 0.17, 0]}
        label={prefs.stageSkyEnabled ? skyOnLabel : skyOffLabel}
        size={[0.42, 0.11]}
        active={prefs.stageSkyEnabled}
        onPress={() => setPrefs({ stageSkyEnabled: !useMmdVrStore.getState().prefs.stageSkyEnabled })}
      />
      <HudButton
        position={[0.58, 0.17, 0]}
        label={prefs.stageFogEnabled ? fogOnLabel : fogOffLabel}
        size={[0.42, 0.11]}
        active={prefs.stageFogEnabled}
        onPress={() => setPrefs({ stageFogEnabled: !useMmdVrStore.getState().prefs.stageFogEnabled })}
      />
      <ValueLabel position={[-0.67, -0.06, 0]} label={exposureLabel} value={prefs.exposure.toFixed(1)} />
      <HudSlider
        position={[0.12, -0.06, 0]}
        width={0.72}
        value={(prefs.exposure - 0.7) / 0.6}
        onChange={(value) => {
          const exposure = normalizeMmdVrExposure(0.7 + value * 0.6);
          if (exposure !== useMmdVrStore.getState().prefs.exposure) setPrefs({ exposure });
        }}
        onInteractionChange={onInteractionChange}
      />
      <HudButton
        position={[0.75, -0.06, 0]}
        label={resetValueLabel}
        size={[0.26, 0.1]}
        onPress={() => {
          if (useMmdVrStore.getState().prefs.exposure !== 1) setPrefs({ exposure: 1 });
        }}
      />
      <HudButton
        position={[-0.35, -0.3, 0]}
        label={prefs.stageRimLightEnabled ? rimLightOnLabel : rimLightOffLabel}
        size={[0.62, 0.11]}
        active={prefs.stageRimLightEnabled}
        onPress={() => setPrefs({ stageRimLightEnabled: !useMmdVrStore.getState().prefs.stageRimLightEnabled })}
      />
      <HudButton
        position={[0.35, -0.3, 0]}
        label={prefs.stageLightPoolEnabled ? lightPoolOnLabel : lightPoolOffLabel}
        size={[0.62, 0.11]}
        active={prefs.stageLightPoolEnabled}
        onPress={() => setPrefs({ stageLightPoolEnabled: !useMmdVrStore.getState().prefs.stageLightPoolEnabled })}
      />
      <HudButton
        position={[0, -0.54, 0]}
        label={prefs.handTracking ? handTrackingOnLabel : handTrackingOffLabel}
        size={[0.8, 0.11]}
        active={prefs.handTracking}
        onPress={() => setPrefs({ handTracking: !useMmdVrStore.getState().prefs.handTracking })}
      />
    </group>
  );
}

function PhysicsSettingsPanel({
  collisionOnLabel,
  collisionOffLabel,
  selfCollisionOnLabel,
  selfCollisionOffLabel,
  radiusLabel,
  qualityLabels,
  hapticLevelLabels,
  boneFeedbackLabel,
  boneFeedbackLabels,
  colliderFrictionLabel,
  colliderFrictionLabels,
  colliderRestitutionLabel,
  colliderRestitutionLabels,
  resetPhysicsLabel,
  snapTurnLabel,
}: {
  collisionOnLabel: string;
  collisionOffLabel: string;
  selfCollisionOnLabel: string;
  selfCollisionOffLabel: string;
  radiusLabel: string;
  qualityLabels: [string, string, string];
  hapticLevelLabels: [string, string, string];
  boneFeedbackLabel: string;
  boneFeedbackLabels: [string, string, string];
  colliderFrictionLabel: string;
  colliderFrictionLabels: [string, string, string];
  colliderRestitutionLabel: string;
  colliderRestitutionLabels: [string, string, string];
  resetPhysicsLabel: string;
  snapTurnLabel: string;
}) {
  const physicsEnabled = useMmdVrStore((s) => s.physicsEnabled);
  const physicsBusy = useMmdVrStore((s) => s.physicsBusy);
  const prefs = useMmdVrStore((s) => s.prefs);
  const collisions = useMmdVrStore((s) => s.physicsControllerCollisions);
  const radius = useMmdVrStore((s) => s.prefs.physicsColliderRadius);
  const quality = useMmdVrStore((s) => s.prefs.physicsQuality);

  const boneFeedback = useMmdVrStore((s) => s.prefs.physicsBoneFeedback);
  const colliderFriction = useMmdVrStore((s) => s.prefs.physicsColliderFriction);
  const colliderRestitution = useMmdVrStore((s) => s.prefs.physicsColliderRestitution);
  const hapticLevel = useMmdVrStore((s) => s.prefs.physicsHapticLevel);
  const setCollisions = useMmdVrStore((s) => s.setPhysicsControllerCollisions);
  const cycleRadius = useMmdVrStore((s) => s.cyclePhysicsColliderRadius);
  const cycleQuality = useMmdVrStore((s) => s.cyclePhysicsQuality);
  const cycleHapticLevel = useMmdVrStore((s) => s.cyclePhysicsHapticLevel);
  const cycleBoneFeedback = useMmdVrStore((s) => s.cyclePhysicsBoneFeedback);
  const cycleFriction = useMmdVrStore((s) => s.cyclePhysicsColliderFriction);
  const cycleRestitution = useMmdVrStore((s) => s.cyclePhysicsColliderRestitution);
  const requestReset = useMmdVrStore((s) => s.requestPhysicsReset);
  const setPrefs = useMmdVrStore((s) => s.setPrefs);
  const qualityLabel = quality === "low" ? qualityLabels[0] : quality === "high" ? qualityLabels[2] : qualityLabels[1];
  const hapticLabel = hapticLevel === "off" ? hapticLevelLabels[0] : hapticLevel === "low" ? hapticLevelLabels[1] : hapticLevelLabels[2];
  const boneFeedbackValue = boneFeedback === "soft" ? boneFeedbackLabels[0] : boneFeedback === "hard" ? boneFeedbackLabels[2] : boneFeedbackLabels[1];
  const frictionValue = colliderFriction === "low" ? colliderFrictionLabels[0] : colliderFriction === "high" ? colliderFrictionLabels[2] : colliderFrictionLabels[1];
  const restitutionValue = colliderRestitution === "none" ? colliderRestitutionLabels[0] : colliderRestitution === "high" ? colliderRestitutionLabels[2] : colliderRestitutionLabels[1];
  const physicsControlsDisabled = !physicsEnabled || physicsBusy;

  return (
    <group position={[0.16, -1.05, 0.02]}>
      <group scale={[2.35, 1.05, 1]}>
        <ModelPanelBackdrop />
      </group>
      <HudButton
        position={[-0.76, 0.14, 0]}
        label={collisions ? collisionOnLabel : collisionOffLabel}
        size={[0.52, 0.11]}
        active={collisions}
        disabled={physicsControlsDisabled}
        onPress={() => setCollisions(!useMmdVrStore.getState().physicsControllerCollisions)}
      />
      <HudButton
        position={[0.87, -0.1, 0]}
        label={prefs.physicsDynamicSelfCollision ? selfCollisionOnLabel : selfCollisionOffLabel}
        size={[0.46, 0.11]}
        active={prefs.physicsDynamicSelfCollision}
        disabled={physicsBusy}
        onPress={() => setPrefs({
          physicsDynamicSelfCollision: !useMmdVrStore.getState().prefs.physicsDynamicSelfCollision,
        })}
      />
      <HudButton position={[-0.2, 0.14, 0]} label={`${radiusLabel}:${Math.round(radius * 100)}cm`} size={[0.52, 0.11]} disabled={physicsControlsDisabled} onPress={cycleRadius} />
      <HudButton position={[0.38, 0.14, 0]} label={qualityLabel} size={[0.52, 0.11]} disabled={physicsControlsDisabled} onPress={cycleQuality} />
      <HudButton
        position={[0.94, 0.14, 0]}
        label={hapticLabel}
        size={[0.52, 0.11]}
        active={hapticLevel !== "off"}
        disabled={physicsControlsDisabled}
        onPress={cycleHapticLevel}
      />
      <HudButton position={[-0.87, -0.1, 0]} label={resetPhysicsLabel} size={[0.46, 0.11]} disabled={physicsControlsDisabled} onPress={requestReset} />
      <HudButton
        position={[-0.29, -0.1, 0]}
        label={`${snapTurnLabel}:${prefs.snapTurnDegrees}°`}
        size={[0.46, 0.11]}
        onPress={() => setPrefs({
          snapTurnDegrees: prefs.snapTurnDegrees === 15 ? 30 : prefs.snapTurnDegrees === 30 ? 45 : 15,
        })}
      />
      <HudButton
        position={[-0.58, -0.36, 0]}
        label={`${boneFeedbackLabel}:${boneFeedbackValue}`}
        size={[0.52, 0.11]}
        disabled={physicsControlsDisabled}
        onPress={cycleBoneFeedback}
      />
      <HudButton
        position={[0, -0.36, 0]}
        label={`${colliderFrictionLabel}:${frictionValue}`}
        size={[0.52, 0.11]}
        disabled={physicsControlsDisabled}
        onPress={cycleFriction}
      />
      <HudButton
        position={[0.58, -0.36, 0]}
        label={`${colliderRestitutionLabel}:${restitutionValue}`}
        size={[0.52, 0.11]}
        disabled={physicsControlsDisabled}
        onPress={cycleRestitution}
      />
    </group>
  );
}

function FpsBadge() {
  const show = useMmdVrStore((s) => s.prefs.showFps);
  const texture = useMemo(
    () =>
      createPanelTexture(
        160,
        64,
        ({ ctx, width, height }) => {
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = "#9fe870";
          ctx.font = "700 28px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("—", width / 2, height / 2);
        },
        "en",
      ),
    [],
  );
  const accRef = useRef(0);
  const framesRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  useFrame((_, delta) => {
    if (!show) return;
    framesRef.current += 1;
    accRef.current += delta;
    if (accRef.current < 0.35) return;
    const fps = Math.round(framesRef.current / accRef.current);
    framesRef.current = 0;
    accRef.current = 0;
    if (fps === lastRef.current) return;
    lastRef.current = fps;
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 160, 64);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, 160, 64);
    ctx.fillStyle = "#9fe870";
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${fps}`, 80, 32);
    texture.needsUpdate = true;
  });

  if (!show) return null;
  return (
    <mesh position={[-0.72, 0.42, 0]} renderOrder={30}>
      <planeGeometry args={[0.16, 0.07]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} depthTest={false} fog={false} />
    </mesh>
  );
}

/** World-space control strip in front of the player origin. */
export function MmdVrControlBar({
  playLabel,
  pauseLabel,
  loopOnLabel,
  loopOffLabel,
  resetLabel,
  exitLabel,
  emptyHint,
  hideLabel,
  showLabel,
  placeOnLabel,
  placeOffLabel,
  placeHint,
  lightStageLabel,
  lightSoftLabel,
  lightContrastLabel,
  lightDaylightLabel,
  lightWarmLabel,
  lightRimLabel,
  shadowsLabel,
  gridLabel,
  scaleLabel,
  rotateLeftLabel,
  rotateRightLabel,
  heightLabel,
  viewDistanceLabel,
  resetValueLabel,
  panelHideLabel,
  panelShowLabel,
  panelDragLabel,
  panelFollowOnLabel,
  panelFollowOffLabel,
  fpsOnLabel,
  fpsOffLabel,
  physicsOnLabel,
  physicsOffLabel,
  physicsDebugOnLabel,
  physicsDebugOffLabel,
  physicsSettingsLabel,
  visualSettingsLabel,
  skyOnLabel,
  skyOffLabel,
  fogOnLabel,
  fogOffLabel,
  rimLightOnLabel,
  rimLightOffLabel,
  lightPoolOnLabel,
  lightPoolOffLabel,
  handTrackingOnLabel,
  handTrackingOffLabel,
  physicsCollisionOnLabel,
  physicsCollisionOffLabel,
  physicsSelfCollisionOnLabel,
  physicsSelfCollisionOffLabel,
  physicsRadiusLabel,
  physicsQualityLabels,
  physicsHapticLevelLabels,
  physicsBoneFeedbackLabel,
  physicsBoneFeedbackLabels,
  physicsColliderFrictionLabel,
  physicsColliderFrictionLabels,
  physicsColliderRestitutionLabel,
  physicsColliderRestitutionLabels,
  resetPhysicsLabel,
  snapTurnLabel,
  exposureLabel,
  removeLabel,
  materialsLabel,
  materialOpacityLabel,
  materialRoughnessLabel,
  materialMetallicLabel,
  materialEmissionLabel,
  walkLabels,
  walkSpeedLabel,
  onDragChange,
  onExit,
  busy,
}: {
  playLabel: string;
  pauseLabel: string;
  loopOnLabel: string;
  loopOffLabel: string;
  resetLabel: string;
  exitLabel: string;
  emptyHint: string;
  hideLabel: string;
  showLabel: string;
  placeOnLabel: string;
  placeOffLabel: string;
  placeHint: string;
  lightStageLabel: string;
  lightSoftLabel: string;
  lightContrastLabel: string;
  lightDaylightLabel: string;
  lightWarmLabel: string;
  lightRimLabel: string;
  shadowsLabel: string;
  gridLabel: string;
  scaleLabel: string;
  rotateLeftLabel: string;
  rotateRightLabel: string;
  heightLabel: string;
  viewDistanceLabel: string;
  resetValueLabel: string;
  panelHideLabel: string;
  panelShowLabel: string;
  panelDragLabel: string;
  panelFollowOnLabel: string;
  panelFollowOffLabel: string;
  fpsOnLabel: string;
  fpsOffLabel: string;
  physicsOnLabel: string;
  physicsOffLabel: string;
  physicsDebugOnLabel: string;
  physicsDebugOffLabel: string;
  physicsSettingsLabel: string;
  visualSettingsLabel: string;
  skyOnLabel: string;
  skyOffLabel: string;
  fogOnLabel: string;
  fogOffLabel: string;
  rimLightOnLabel: string;
  rimLightOffLabel: string;
  lightPoolOnLabel: string;
  lightPoolOffLabel: string;
  handTrackingOnLabel: string;
  handTrackingOffLabel: string;
  physicsCollisionOnLabel: string;
  physicsCollisionOffLabel: string;
  physicsSelfCollisionOnLabel: string;
  physicsSelfCollisionOffLabel: string;
  physicsRadiusLabel: string;
  physicsQualityLabels: [string, string, string];
  physicsHapticLevelLabels: [string, string, string];
  physicsBoneFeedbackLabel: string;
  physicsBoneFeedbackLabels: [string, string, string];
  physicsColliderFrictionLabel: string;
  physicsColliderFrictionLabels: [string, string, string];
  physicsColliderRestitutionLabel: string;
  physicsColliderRestitutionLabels: [string, string, string];
  resetPhysicsLabel: string;
  snapTurnLabel: string;
  exposureLabel: string;
  removeLabel: string;
  materialsLabel: string;
  materialOpacityLabel: string;
  materialRoughnessLabel: string;
  materialMetallicLabel: string;
  materialEmissionLabel: string;
  walkLabels: [string, string, string];
  walkSpeedLabel: string;
  onDragChange: (dragging: boolean) => void;
  onExit: () => void;
  busy: boolean;
}) {
  const playing = useMmdVrStore((s) => s.playing);
  const loop = useMmdVrStore((s) => s.loop);
  const modelCount = useMmdVrStore((s) => s.modelCount);
  const objectCount = useMmdVrStore((s) => s.objects.length);
  const statusLine = useMmdVrStore((s) => s.statusLine);
  const physicsError = useMmdVrStore((s) => s.physicsError);
  const placeMode = useMmdVrStore((s) => s.placeMode);
  const prefs = useMmdVrStore((s) => s.prefs);
  const profile = getMmdVrRenderProfile(prefs);
  const setPlaying = useMmdVrStore((s) => s.setPlaying);
  const setLoop = useMmdVrStore((s) => s.setLoop);
  const setPlaceMode = useMmdVrStore((s) => s.setPlaceMode);
  const resetView = useMmdVrStore((s) => s.resetView);
  const setPrefs = useMmdVrStore((s) => s.setPrefs);
  const physicsEnabled = useMmdVrStore((s) => s.physicsEnabled);
  const physicsDebugEnabled = useMmdVrStore((s) => s.physicsDebugEnabled);
  const physicsBusy = useMmdVrStore((s) => s.physicsBusy);
  const physicsContactCount = useMmdVrStore((s) => s.physicsContactCount);
  const physicsDynamicBodyCount = useMmdVrStore((s) => s.physicsDynamicBodyCount);
  const physicsRigidBodyCount = useMmdVrStore((s) => s.physicsRigidBodyCount);
  const physicsStepCount = useMmdVrStore((s) => s.physicsStepCount);
  const setPhysicsEnabled = useMmdVrStore((s) => s.setPhysicsEnabled);
  const setPhysicsDebugEnabled = useMmdVrStore((s) => s.setPhysicsDebugEnabled);
  const materialPanelOpen = useMmdVrStore((s) => s.materialPanelModelId != null);
  const [panelVisible, setPanelVisible] = useState(true);
  const [physicsPanelOpen, setPhysicsPanelOpen] = useState(false);
  const [visualPanelOpen, setVisualPanelOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState(PANEL_DEFAULT_POSITION);
  const panelGroupRef = useRef<THREE.Group>(null);
  const billboardTarget = useMemo(() => new THREE.Vector3(), []);
  // Yaw-only billboard: keep the panel upright and always facing the user,
  // independent of where it was dragged or how the origin was turned.
  useFrame(({ camera }) => {
    const group = panelGroupRef.current;
    const parent = group?.parent;
    if (!group || !parent) return;
    if (!useMmdVrStore.getState().prefs.panelFollowUser) return;
    camera.getWorldPosition(billboardTarget);
    parent.worldToLocal(billboardTarget);
    const dx = billboardTarget.x - group.position.x;
    const dz = billboardTarget.z - group.position.z;
    if (dx * dx + dz * dz < 1e-8) return;
    group.rotation.y = Math.atan2(dx, dz);
  });
  const heightOffset = prefs.heightOffset;
  const viewDistance = prefs.viewDistance;
  const walkIndex = prefs.walkSpeedPref === "slow" ? 0 : prefs.walkSpeedPref === "fast" ? 2 : 1;

  const status =
    physicsError ?? statusLine ??
    (modelCount === 0 && objectCount === 0 ? emptyHint : placeMode ? placeHint : null);
  if (!panelVisible) {
    return (
      <group position={panelPosition} ref={panelGroupRef}>
        <HudButton
          position={[0, 0, 0]}
          label={panelShowLabel}
          size={[0.54, 0.13]}
          onPress={() => setPanelVisible(true)}
        />
        <DragHandle
          label={panelDragLabel}
          position={[0, -0.14, 0.012]}
          onDragChange={onDragChange}
          onPositionChange={setPanelPosition}
        />
      </group>
    );
  }

  return (
    <group position={panelPosition} ref={panelGroupRef}>
      <PanelBackdrop />
      <DragHandle label={panelDragLabel} onDragChange={onDragChange} onPositionChange={setPanelPosition} />
      <HudButton position={[1.43, 0.42, 0]} label={panelHideLabel} size={[0.36, 0.1]} onPress={() => setPanelVisible(false)} />
      <HudButton
        position={[-1.3, 0.42, 0]}
        label={prefs.panelFollowUser ? panelFollowOnLabel : panelFollowOffLabel}
        size={[0.42, 0.1]}
        active={prefs.panelFollowUser}
        onPress={() => setPrefs({ panelFollowUser: !useMmdVrStore.getState().prefs.panelFollowUser })}
      />
      {status ? <StatusPlane text={status} /> : null}
      <ProgressBar onInteractionChange={onDragChange} />
      <HudButton
        position={[-1.18, 0.05, 0]}
        label={playing ? pauseLabel : playLabel}
        disabled={busy || modelCount === 0}
        active={playing}
        onPress={() => setPlaying(!useMmdVrStore.getState().playing)}
      />
      <HudButton
        position={[-0.82, 0.05, 0]}
        label={loop ? loopOnLabel : loopOffLabel}
        disabled={busy}
        active={loop}
        onPress={() => setLoop(!useMmdVrStore.getState().loop)}
      />
      <HudButton
        position={[-0.45, 0.05, 0]}
        label={placeMode ? placeOnLabel : placeOffLabel}
        disabled={busy || (modelCount === 0 && objectCount === 0)}
        size={[0.38, 0.11]}
        active={placeMode}
        onPress={() => setPlaceMode(!useMmdVrStore.getState().placeMode)}
      />
      <HudButton
        position={[-0.05, 0.05, 0]}
        label={visualSettingsLabel}
        disabled={busy}
        active={visualPanelOpen}
        size={[0.4, 0.11]}
        onPress={() => {
          setVisualPanelOpen((open) => !open);
          setPhysicsPanelOpen(false);
          useMmdVrStore.getState().setMaterialPanelModelId(null);
        }}
      />
      <HudButton
        position={[0.35, 0.05, 0]}
        label={shadowsLabel}
        disabled={busy}
        active={profile.shadows}
        onPress={() => setPrefs({ shadowsPref: profile.shadows ? "off" : "on" })}
      />
      <HudButton
        position={[0.71, 0.05, 0]}
        label={gridLabel}
        disabled={busy}
        active={profile.showGrid}
        onPress={() => setPrefs({ gridPref: profile.showGrid ? "off" : "on" })}
      />
      <HudButton position={[1.07, 0.05, 0]} label={resetLabel} disabled={busy} onPress={() => resetView()} />
      <HudButton position={[1.43, 0.05, 0]} label={exitLabel} disabled={busy} danger onPress={onExit} />
      <ValueLabel position={[-0.83, -0.21, 0]} label={heightLabel} value={`${heightOffset >= 0 ? "+" : ""}${heightOffset.toFixed(2)} m`} />
      <HudSlider
        position={[0.28, -0.2, 0]}
        width={0.72}
        value={mmdVrHeightOffsetToSlider(heightOffset)}
        onChange={(value) => setPrefs({ heightOffset: mmdVrSliderToHeightOffset(value) })}
        onInteractionChange={onDragChange}
      />
      <HudButton position={[0.82, -0.21, 0]} label="−" size={[0.2, 0.1]} onPress={() => setPrefs({ heightOffset: heightOffset - MMD_VR_HEIGHT_OFFSET_FINE_STEP })} />
      <HudButton position={[1.08, -0.21, 0]} label={resetValueLabel} size={[0.26, 0.1]} onPress={() => setPrefs({ heightOffset: 0 })} />
      <HudButton position={[1.34, -0.21, 0]} label="+" size={[0.2, 0.1]} onPress={() => setPrefs({ heightOffset: heightOffset + MMD_VR_HEIGHT_OFFSET_FINE_STEP })} />
      <ValueLabel position={[-1.05, -0.41, 0]} label={viewDistanceLabel} value={`${viewDistance} m`} />
      <HudSlider
        position={[-0.27, -0.41, 0]}
        width={0.62}
        value={mmdVrViewDistanceToSlider(viewDistance)}
        onChange={(value) => setPrefs({ viewDistance: mmdVrSliderToViewDistance(value) })}
        onInteractionChange={onDragChange}
      />
      <HudButton position={[0.25, -0.41, 0]} label={resetValueLabel} size={[0.26, 0.1]} onPress={() => setPrefs({ viewDistance: 40 })} />
      <HudButton
        position={[0.66, -0.41, 0]}
        label={`${walkSpeedLabel}:${walkLabels[walkIndex]}`}
        size={[0.52, 0.1]}
        onPress={() => setPrefs({ walkSpeedPref: (["slow", "normal", "fast"] as const)[(walkIndex + 1) % 3] })}
      />
      <HudButton
        position={[1.16, -0.41, 0]}
        label={prefs.showFps ? fpsOnLabel : fpsOffLabel}
        size={[0.44, 0.1]}
        active={prefs.showFps}
        onPress={() => setPrefs({ showFps: !useMmdVrStore.getState().prefs.showFps })}
      />
      <HudButton
        position={[-0.16, -0.59, 0]}
        label={physicsEnabled ? physicsOnLabel : physicsOffLabel}
        size={[0.58, 0.1]}
        disabled={busy || physicsBusy || modelCount === 0}
        active={physicsEnabled}
        onPress={() => setPhysicsEnabled(!useMmdVrStore.getState().physicsEnabled)}
      />
      <HudButton
        position={[0.52, -0.59, 0]}
        label={physicsDebugEnabled
          ? `${physicsDebugOnLabel} R:${physicsRigidBodyCount} D:${physicsDynamicBodyCount} C:${physicsContactCount} S:${physicsStepCount > 0 ? "+" : "0"}`
          : physicsDebugOffLabel}
        size={[0.7, 0.1]}
        disabled={busy || !physicsEnabled || physicsBusy || modelCount === 0}
        active={physicsDebugEnabled}
        onPress={() => setPhysicsDebugEnabled(!useMmdVrStore.getState().physicsDebugEnabled)}
      />
      <HudButton
        position={[1.14, -0.59, 0]}
        label={physicsSettingsLabel}
        size={[0.46, 0.1]}
        disabled={busy}
        active={physicsPanelOpen}
        onPress={() => {
          setPhysicsPanelOpen((open) => !open);
          setVisualPanelOpen(false);
          useMmdVrStore.getState().setMaterialPanelModelId(null);
        }}
      />
      {!materialPanelOpen && (visualPanelOpen ? (
        <VisualSettingsPanel
          lightStageLabel={lightStageLabel}
          lightSoftLabel={lightSoftLabel}
          lightContrastLabel={lightContrastLabel}
          lightDaylightLabel={lightDaylightLabel}
          lightWarmLabel={lightWarmLabel}
          lightRimLabel={lightRimLabel}
          exposureLabel={exposureLabel}
          resetValueLabel={resetValueLabel}
          skyOnLabel={skyOnLabel}
          skyOffLabel={skyOffLabel}
          fogOnLabel={fogOnLabel}
          fogOffLabel={fogOffLabel}
          rimLightOnLabel={rimLightOnLabel}
          rimLightOffLabel={rimLightOffLabel}
          lightPoolOnLabel={lightPoolOnLabel}
          lightPoolOffLabel={lightPoolOffLabel}
          handTrackingOnLabel={handTrackingOnLabel}
          handTrackingOffLabel={handTrackingOffLabel}
          onInteractionChange={onDragChange}
        />
      ) : physicsPanelOpen ? (
        <PhysicsSettingsPanel
          collisionOnLabel={physicsCollisionOnLabel}
          collisionOffLabel={physicsCollisionOffLabel}
          selfCollisionOnLabel={physicsSelfCollisionOnLabel}
          selfCollisionOffLabel={physicsSelfCollisionOffLabel}
          radiusLabel={physicsRadiusLabel}
          qualityLabels={physicsQualityLabels}
          hapticLevelLabels={physicsHapticLevelLabels}
          boneFeedbackLabel={physicsBoneFeedbackLabel}
          boneFeedbackLabels={physicsBoneFeedbackLabels}
          colliderFrictionLabel={physicsColliderFrictionLabel}
          colliderFrictionLabels={physicsColliderFrictionLabels}
          colliderRestitutionLabel={physicsColliderRestitutionLabel}
          colliderRestitutionLabels={physicsColliderRestitutionLabels}
          resetPhysicsLabel={resetPhysicsLabel}
          snapTurnLabel={snapTurnLabel}
        />
      ) : (
        <>
          <ModelPanels
            hideLabel={hideLabel}
            showLabel={showLabel}
            placeOnLabel={placeOnLabel}
            placeOffLabel={placeOffLabel}
            scaleLabel={scaleLabel}
            rotateLeftLabel={rotateLeftLabel}
            rotateRightLabel={rotateRightLabel}
            resetValueLabel={resetValueLabel}
            removeLabel={removeLabel}
            materialsLabel={materialsLabel}
            onInteractionChange={onDragChange}
          />
          <ObjectPanels
            hideLabel={hideLabel}
            showLabel={showLabel}
            placeOnLabel={placeOnLabel}
            placeOffLabel={placeOffLabel}
            scaleLabel={scaleLabel}
            rotateLeftLabel={rotateLeftLabel}
            rotateRightLabel={rotateRightLabel}
            resetValueLabel={resetValueLabel}
            removeLabel={removeLabel}
            onInteractionChange={onDragChange}
          />
        </>
      ))}
      {materialPanelOpen ? (
        <MaterialPanel
          hideLabel={hideLabel}
          showLabel={showLabel}
          materialsLabel={materialsLabel}
          opacityLabel={materialOpacityLabel}
          roughnessLabel={materialRoughnessLabel}
          metallicLabel={materialMetallicLabel}
          emissionLabel={materialEmissionLabel}
          closeLabel={exitLabel}
          disabled={busy || physicsBusy}
          onInteractionChange={onDragChange}
        />
      ) : null}
      <FpsBadge />
    </group>
  );
}
