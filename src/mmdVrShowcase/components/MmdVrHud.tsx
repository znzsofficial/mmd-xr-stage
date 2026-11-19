import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useXRControllerButtonEvent, useXRInputSourceState } from "@react-three/xr";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { placeHudInFront } from "../hudPlacement";
import * as THREE from "three";
import { createPanelTexture, roundRectPath } from "../../shared/panelTexture";
import { getMmdVrClock } from "../mmdVrClock";
import {PlayerSettings, CharacterSettings, EnvironmentSettings, settingsSections, type SettingsSection} from "../settings/objectSettings";
import {ValueLabel,HudSlider} from "./HudValues";
import { useMmdVrStore } from "../mmdVrStore";
import { useVrHudTheme as useMmdVrTheme, HUD_COLORS } from "../hudAppearance";
import { HudButton, HudLine, HudSheet } from "./PorcelainControls";
import { BackpackPanel, SceneryPanel } from "./BackpackPanels";
import { useBackpack } from "../backpack";
import { useHudWorldInput } from "./hudWorldInput";
import { useStagePlay } from '../play/stagePlay';
import {
  formatMmdVrModelScale,
  mmdVrModelScaleToSlider,
  mmdVrSliderToModelScale,
} from "../mmdVrAdjustments";
import { useLanguageStore } from "../../languageStore";
import { formatAssetProgress, paginateLoadDetails } from "../loadText";
import { useRenderDiagnostics } from "../renderDiagnostics";
import { diagnosticLines } from "../diagnosticText";
import { resolveHudSurface } from "../hudMode";
import { WatchRecall } from './WatchRecall';

let introducedWatch = false; // one first-empty-stage hint per document, never per room

/** Match paintProgressBar track insets (px on 640-wide canvas). */
const PROGRESS_PAD = 16;
const PANEL_DEFAULT_POSITION: [number, number, number] = [0, 1.45, -1.8];

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

function LoadRecoveryPanel({ onExit, onContinue }: { onExit: () => void; onContinue: () => void }) {
  const t = useLanguageStore((s) => s.t);
  const progress = useMmdVrStore((s) => s.assetLoad);
  const physicsBusy = useMmdVrStore((s) => s.physicsBusy);
  const retry = useMmdVrStore((s) => s.retryFailedAssets);
  const [page, setPage] = useState(0);
  const details = progress.running ? progress.fileName : progress.failures.map((failure) => `${failure.fileName}\n${failure.message}`).join("\n\n");
  const pages = useMemo(() => paginateLoadDetails(details), [details]);
  const current = Math.min(page, pages.length - 1);
  const title = formatAssetProgress(progress, t);
  const { accent } = useMmdVrTheme();
  const texture = useMemo(() => createPanelTexture(1280, 420, ({ ctx, width }) => {
    ctx.fillStyle = accent.soft;
    ctx.fillRect(0, 0, width, 420);
    ctx.fillStyle = accent.ink;
    ctx.font = "600 34px system-ui, sans-serif";
    ctx.fillText(title, 32, 50);
    ctx.font = "28px system-ui, sans-serif";
    pages[current].forEach((line, index) => ctx.fillText(line, 32, 112 + index * 48));
    ctx.fillText(`${current + 1}/${pages.length}`, width - 120, 392);
  }, "en"), [accent.soft, accent.ink, title, pages, current]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group>
    <mesh position={[0, 0.13, 0.02]} renderOrder={35}>
      <planeGeometry args={[3.2, 1.05]} />
      <meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
    <HudButton position={[-1.25, -0.5, 0.03]} size={[0.42, 0.13]} label={t("loadPrevious")} disabled={current === 0} onPress={() => setPage(current - 1)} />
    <HudButton position={[-0.78, -0.5, 0.03]} size={[0.42, 0.13]} label={t("loadNext")} disabled={current === pages.length - 1} onPress={() => setPage(current + 1)} />
    <HudButton position={[-0.08, -0.5, 0.03]} size={[0.82, 0.13]} label={t("loadRetry")} disabled={progress.running || physicsBusy} onPress={() => { setPage(0); retry(); }} />
    <HudButton position={[0.7, -0.5, 0.03]} size={[0.66, 0.13]} label={t("loadContinue")} disabled={progress.running} onPress={onContinue} />
    <HudButton position={[1.4, -0.5, 0.03]} size={[0.66, 0.13]} label={t("loadBack")} onPress={onExit} />
  </group>;
}

function TextPanel({ title, text, onClose, onExit }: { title: string; text: string; onClose: () => void; onExit: () => void }) {
  const t = useLanguageStore((s) => s.t);
  const { accent } = useMmdVrTheme();
  const [page, setPage] = useState(0);
  const pages = useMemo(() => paginateLoadDetails(text), [text]);
  const current = Math.min(page, pages.length - 1);
  const texture = useMemo(() => createPanelTexture(1280, 420, ({ ctx }) => {
    ctx.fillStyle = accent.soft;
    ctx.fillRect(0, 0, 1280, 420);
    ctx.fillStyle = accent.ink;
    ctx.font = "600 34px system-ui, sans-serif";
    ctx.fillText(title, 32, 50);
    ctx.font = "28px system-ui, sans-serif";
    pages[current].forEach((line, index) => ctx.fillText(line, 32, 112 + index * 48));
    ctx.fillText(`${current + 1}/${pages.length}`, 1140, 392);
  }, "en"), [accent.soft, accent.ink, title, pages, current]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group>
    <mesh position={[0, 0.13, 0.02]} renderOrder={35}>
      <planeGeometry args={[3.2, 1.05]} />
      <meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
    <HudButton position={[-1.1, -0.5, 0.03]} size={[0.6, 0.13]} label={t("loadPrevious")} disabled={current === 0} onPress={() => setPage(current - 1)} />
    <HudButton position={[-0.4, -0.5, 0.03]} size={[0.6, 0.13]} label={t("loadNext")} disabled={current === pages.length - 1} onPress={() => setPage(current + 1)} />
    <HudButton position={[0.4, -0.5, 0.03]} size={[0.75, 0.13]} label={t("hudBack")} onPress={onClose} />
    <HudButton position={[1.25, -0.5, 0.03]} size={[0.75, 0.13]} label={t("loadBack")} onPress={onExit} />
  </group>;
}

function DiagnosticsPanel({ onClose, onExit }: { onClose: () => void; onExit: () => void }) {
  const data = useRenderDiagnostics((s) => s.current);
  const t = useLanguageStore((s) => s.t);
  const language = useLanguageStore((s) => s.language);
  const debug=useMmdVrStore(s=>s.physicsDebugEnabled),fps=useMmdVrStore(s=>s.prefs.showFps);
  const counts=useMmdVrStore(s=>s.physicsDebugEnabled?`R: ${s.physicsRigidBodyCount} · D: ${s.physicsDynamicBodyCount} · C: ${s.physicsContactCount} · S: ${s.physicsStepCount}`:'');
  return <><TextPanel title={t("hudDiagnostics")} text={[...diagnosticLines(data,t,language),counts,t('diagHint')].filter(Boolean).join('\n')} onClose={onClose} onExit={onExit} />
    <HudButton position={[-.6,-.76,.03]} size={[1.1,.15]} label={t('settingsPanelFps')} active={fps} onPress={()=>useMmdVrStore.getState().setPrefs({showFps:!fps})}/>
    <HudButton position={[.6,-.76,.03]} size={[1.1,.15]} label={t(debug?'settingsMmdVrPhysicsDebugOn':'settingsMmdVrPhysicsDebugOff')} active={debug} onPress={()=>{const s=useMmdVrStore.getState();s.setPrefs({detailedPhysicsDiagnostics:!debug});s.setPhysicsDebugEnabled(!debug);}}/></>;
}

export function CriticalNotice({ onDetails }: { onDetails: () => void }) {
  const t = useLanguageStore((s) => s.t);
  const error = useMmdVrStore((s) => s.physicsError);
  const fatal = useMmdVrStore((s) => s.physicsFatal);
  if (!error) return null;
  return <HudButton position={[0, 1.13, 0.04]} size={[1.6, 0.16]} danger
    label={t(fatal ? "hudPhysicsFatal" : "hudPhysicsWarning")} onPress={onDetails} />;
}

type StripNavigation = { expanded: true } | { expanded?: false; onScenery: () => void; onBackpack: () => void };
export function CompactPlaybackControls({ onExpand, onExit, onTransport, busy, playbackLocked, ...nav }: { onExpand: () => void; onExit: () => void; onTransport?:()=>void; busy: boolean; playbackLocked?: boolean } & StripNavigation) {
  const t = useLanguageStore((s) => s.t);
  const playing = useMmdVrStore((s) => s.playing);
  const modelCount = useMmdVrStore((s) => s.modelCount);
  const duration = useMmdVrStore(s=>s.duration);
  return <group>
    {!nav.expanded && <>
      <HudButton position={[.59, 0, 0]} size={[.55, .17]} label={t("hudScenery")} onPress={nav.onScenery} disabled={busy} />
      <HudButton position={[0, 0, 0]} size={[.55, .17]} label={t("hudBackpack")} onPress={nav.onBackpack} disabled={busy} />
    </>}
    <HudButton position={[nav.expanded ? -.55 : -.59, 0, 0]} size={[.55, .17]} label={t(playing ? "settingsMmdVrPause" : "settingsMmdVrPlay")} active={playing}
      disabled={busy || playbackLocked || modelCount === 0 || duration<=0} onPress={() => {const s=useMmdVrStore.getState();if(!s.playing&&getMmdVrClock().time>=duration)s.requestSeek(0);s.setPlaying(!s.playing);onTransport?.();}} />
    <HudButton position={[0, nav.expanded?0:-.24, 0]} label={t(nav.expanded ? "hudBack" : "hudMore")} size={[.5,.14]} variant="quiet" disabled={busy} onPress={onExpand} />
    <HudButton position={[.55, nav.expanded?0:-.24, 0]} label={t("settingsVrDesktopExit")} size={[.5,.14]} variant="quiet" disabled={busy} onPress={onExit} />
  </group>;
}

function PanelBackdrop({ sidebar }: { sidebar: boolean }) {
  const { accent } = useMmdVrTheme();
  const texture = useMemo(
    () => createPanelTexture(1320, 1120, ({ ctx, width, height }) => {
      roundRectPath(ctx, 0, 0, width, height, 32);
      ctx.fillStyle = accent.soft;
      ctx.fill();
      ctx.strokeStyle = accent.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(40, 155); ctx.lineTo(width - 40, 155);
      ctx.moveTo(40, height - 168); ctx.lineTo(width - 40, height - 168);
      if (sidebar) { ctx.moveTo(283, 184); ctx.lineTo(283, height - 195); }
      ctx.stroke();
    }, "en"),
    [accent.border, accent.primary, accent.soft, sidebar],
  );
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh
      position={[0, -0.06, -0.018]}
      renderOrder={10}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <planeGeometry args={[2.76, 2.24]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} depthTest={false} alphaTest={0.02} fog={false} />
    </mesh>
  );
}

function DragHandle({
  label,
  onDragChange,
  onPositionChange,
  position = [0, 0.83, 0.012],
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
      ctx.fillStyle = dragging ? HUD_COLORS.selected : accent.soft;
      ctx.fill();
      ctx.fillStyle = accent.ink;
      ctx.font = "500 26px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, width / 2, height / 2);
      ctx.fillStyle = accent.muted;
      roundRectPath(ctx, width / 2 - 35, height - 9, 70, 3, 1.5);
      ctx.fill();
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
        renderOrder={40}
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
          ctx.fillRect(PROGRESS_PAD, height - 16, width - PROGRESS_PAD * 2, 6);
          ctx.fillStyle = accent.muted;
          ctx.font = "600 22px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("0:00 / 0:00", width / 2, 24);
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
    ctx.fillRect(PROGRESS_PAD, h - 16, trackW, 6);
    ctx.fillStyle = accent.primary;
    ctx.fillRect(PROGRESS_PAD, h - 16, trackW * ratio, 6);
    ctx.fillStyle = accent.muted;
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${formatTime(clock.time)} / ${formatTime(clock.duration)}`, w / 2, 24);
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
      <planeGeometry args={[1.05, 0.13]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent fog={false} depthWrite={false} depthTest={false} />
    </mesh>
  );
}

function AdvancedMoveButton({ runtimeId, label, disabled }: { runtimeId: string; label: string; disabled: boolean }) {
  const assetId = useBackpack(s => Object.keys(s.live).find(id => s.live[id].runtimeId === runtimeId));
  return <HudButton position={[0.25, 0.19, 0]} size={[0.42, 0.13]} label={label} disabled={disabled || !assetId}
    onPress={() => { if (assetId) useBackpack.getState().beginPlace(assetId); }} />;
}

function ModelPanel({
  modelId,
  editsLocked,
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
  editsLocked: boolean;
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
  const enqueueVisibilityToggle = useMmdVrStore((s) => s.enqueueVisibilityToggle);
  const requestModelScale = useMmdVrStore((s) => s.requestModelScale);
  const requestModelRotation = useMmdVrStore((s) => s.requestModelRotation);
  const requestModelReset = useMmdVrStore((s) => s.requestModelReset);
  const enqueueModelRemoval = useMmdVrStore((s) => s.enqueueModelRemoval);
  const setMaterialPanelModelId = useMmdVrStore((s) => s.setMaterialPanelModelId);
  const hasMaterials = useMmdVrStore((s) => (s.materialModels[modelId]?.length ?? 0) > 0);

  if (!model) return null;
  const setScale = (scale: number) => requestModelScale(model.id, scale);

  return (
    <group position={position}>
      <ValueLabel position={[0, 0.34, 0]} label={shortName(model.name, 14)} value={model.visible ? "●" : "○"} />
      <HudButton
        position={[-0.25, 0.19, 0]}
        label={model.visible ? hideLabel : showLabel}
        disabled={editsLocked}
        size={[0.42, 0.11]}
        onPress={() => enqueueVisibilityToggle(model.id)}
      />
      <AdvancedMoveButton runtimeId={model.id} label={placeOffLabel} disabled={editsLocked} />
      <ValueLabel position={[0, 0.02, 0]} label={scaleLabel} value={formatMmdVrModelScale(model.scale)} />
      <HudSlider
        position={[0, -0.12, 0]}
        value={mmdVrModelScaleToSlider(model.scale)}
        disabled={editsLocked}
        onChange={(value) => setScale(mmdVrSliderToModelScale(value))}
        onInteractionChange={onInteractionChange}
      />
      <HudButton position={[-0.36, -0.27, 0]} label={rotateLeftLabel} size={[0.22, 0.1]} disabled={editsLocked} onPress={() => requestModelRotation(model.id, model.rotationY - 15)} />
      <HudButton position={[-0.12, -0.27, 0]} label={resetValueLabel} size={[0.22, 0.1]} disabled={editsLocked} onPress={() => requestModelReset(model.id)} />
      <HudButton position={[0.12, -0.27, 0]} label={rotateRightLabel} size={[0.22, 0.1]} disabled={editsLocked} onPress={() => requestModelRotation(model.id, model.rotationY + 15)} />
      <HudButton position={[0.36, -0.27, 0]} label={removeLabel} size={[0.22, 0.1]} disabled={editsLocked} danger onPress={() => enqueueModelRemoval(model.id)} />
      <HudButton
        position={[0, -0.46, 0]}
        label={materialsLabel}
        size={[0.42, 0.08]}
        disabled={!hasMaterials}
        onPress={() => setMaterialPanelModelId(model.id)}
      />
    </group>
  );
}

function ModelPanels({ selectedIndex, ...props }: Omit<Parameters<typeof ModelPanel>[0], "modelId" | "position"> & { selectedIndex: number }) {
  const models = useMmdVrStore((s) => s.models);
  return (
    <group position={[0, -0.23, 0.02]} scale={1.2}>
      {models.slice(selectedIndex, selectedIndex + 1).map((model) => (
        <ModelPanel
          key={model.id}
          {...props}
          modelId={model.id}
          position={[0, 0, 0]}
        />
      ))}
    </group>
  );
}

function ObjectPanel({
  objectId,
  editsLocked,
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
  editsLocked: boolean;
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
  const enqueueVisibilityToggle = useMmdVrStore((s) => s.enqueueVisibilityToggle);
  const requestModelScale = useMmdVrStore((s) => s.requestModelScale);
  const requestModelRotation = useMmdVrStore((s) => s.requestModelRotation);
  const requestModelReset = useMmdVrStore((s) => s.requestModelReset);
  const enqueueModelRemoval = useMmdVrStore((s) => s.enqueueModelRemoval);

  if (!object) return null;
  const setScale = (scale: number) => requestModelScale(object.id, scale);

  return (
    <group position={position}>
      <ValueLabel position={[0, 0.34, 0]} label={shortName(object.name, 14)} value={object.visible ? "●" : "○"} />
      <HudButton
        position={[-0.25, 0.19, 0]}
        label={object.visible ? hideLabel : showLabel}
        disabled={editsLocked}
        size={[0.42, 0.11]}
        onPress={() => enqueueVisibilityToggle(object.id)}
      />
      <AdvancedMoveButton runtimeId={object.id} label={placeOffLabel} disabled={editsLocked} />
      <ValueLabel position={[0, 0.02, 0]} label={scaleLabel} value={formatMmdVrModelScale(object.scale)} />
      <HudSlider
        position={[0, -0.12, 0]}
        value={mmdVrModelScaleToSlider(object.scale)}
        disabled={editsLocked}
        onChange={(value) => setScale(mmdVrSliderToModelScale(value))}
        onInteractionChange={onInteractionChange}
      />
      <HudButton position={[-0.36, -0.31, 0]} label={rotateLeftLabel} size={[0.22, 0.1]} disabled={editsLocked} onPress={() => requestModelRotation(object.id, object.rotationY - 15)} />
      <HudButton position={[-0.12, -0.31, 0]} label={resetValueLabel} size={[0.22, 0.1]} disabled={editsLocked} onPress={() => requestModelReset(object.id)} />
      <HudButton position={[0.12, -0.31, 0]} label={rotateRightLabel} size={[0.22, 0.1]} disabled={editsLocked} onPress={() => requestModelRotation(object.id, object.rotationY + 15)} />
      <HudButton position={[0.36, -0.31, 0]} label={removeLabel} size={[0.22, 0.1]} disabled={editsLocked} danger onPress={() => enqueueModelRemoval(object.id)} />
    </group>
  );
}

function ObjectPanels({ selectedIndex, ...props }: Omit<Parameters<typeof ObjectPanel>[0], "objectId" | "position"> & { selectedIndex: number }) {
  const objects = useMmdVrStore((s) => s.objects);
  return (
    <group position={[0, -0.23, 0.02]} scale={1.2}>
      {objects.slice(selectedIndex, selectedIndex + 1).map((object) => (
        <ObjectPanel
          key={object.id}
          {...props}
          objectId={object.id}
          position={[0, 0, 0]}
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
  emissionLabel,
  closeLabel,
  disabled,
  onInteractionChange,
}: {
  hideLabel: string;
  showLabel: string;
  materialsLabel: string;
  opacityLabel: string;
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
  const perPage = 4;
  const pageCount = Math.max(1, Math.ceil(materials.length / perPage));
  const curPage = Math.min(page, pageCount - 1);
  const slice = materials.slice(curPage * perPage, curPage * perPage + perPage);

  return (
    <group position={[0, -0.12, 0.02]}>
      <HudButton position={[-0.65, 0.38, 0]} label={view === "detail" ? materialsLabel : closeLabel} size={[0.42, 0.14]} onPress={() => {
        if (view === "detail") { setView("list"); setSelectedMat(null); }
        else setModelId(null);
      }} />
      <ValueLabel position={[0.1, 0.38, 0]} label={view === "detail" ? shortName(selectedMat ?? "", 16) : `${materialsLabel}: ${shortName(model.name, 12)}`} value="" />
      {view === "list" ? (
        <>
          {slice.map((mat, i) => {
            const y = 0.17 - i * 0.18;
            return (
              <group key={mat.name}>
                <HudButton
                  position={[-0.56, y, 0]}
                  label={mat.visible ? hideLabel : showLabel}
                  size={[0.27, 0.14]}
                  active={mat.visible}
                  disabled={disabled}
                  onPress={() => setMaterialVisible(modelId, mat.name, !mat.visible)}
                />
                <HudButton
                  position={[0.1, y, 0]}
                  label={shortName(mat.name, 14)}
                  size={[0.92, 0.14]}
                  onPress={() => { setSelectedMat(mat.name); setView("detail"); }}
                />
              </group>
            );
          })}
          {pageCount > 1 ? (
            <>
              <HudButton position={[-0.36, -0.6, 0]} label="‹" size={[0.3, 0.14]} disabled={curPage === 0} onPress={() => setPage(Math.max(0, curPage - 1))} />
              <ValueLabel position={[0, -0.6, 0]} label={`${curPage + 1}/${pageCount}`} value="" size={[0.3, 0.14]} centered />
              <HudButton position={[0.36, -0.6, 0]} label="›" size={[0.3, 0.14]} disabled={curPage >= pageCount - 1} onPress={() => setPage(Math.min(pageCount - 1, curPage + 1))} />
            </>
          ) : null}
        </>
      ) : selectedState ? (
        <>
          <ValueLabel position={[-0.5, 0.25, 0]} label={opacityLabel} value={selectedState.opacity.toFixed(2)} />
          <HudSlider position={[0.1, 0.25, 0]} width={0.6} value={selectedState.opacity} onChange={(v) => setMaterialParam(modelId, selectedState.name, "opacity", v)} onInteractionChange={onInteractionChange} disabled={disabled} />
          <ValueLabel position={[-0.5, -0.23, 0]} label={emissionLabel} value={selectedState.emission.toFixed(2)} />
          <HudSlider position={[0.1, -0.23, 0]} width={0.6} value={Math.min(1, selectedState.emission / 2)} onChange={(v) => setMaterialParam(modelId, selectedState.name, "emission", v * 2)} onInteractionChange={onInteractionChange} disabled={disabled} />
          <HudButton position={[-0.3, -0.48, 0]} label={selectedState.visible ? hideLabel : showLabel} size={[0.22, 0.08]} active={selectedState.visible} disabled={disabled} onPress={() => setMaterialVisible(modelId, selectedState.name, !selectedState.visible)} />
        </>
      ) : null}
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
  const fps = useRenderDiagnostics((state) => state.current?.fps ?? null);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  useEffect(() => {
    if (!show) return;
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
    ctx.fillText(fps == null ? "—" : `${fps}`, 80, 32);
    texture.needsUpdate = true;
  }, [fps, show, texture]);

  if (!show) return null;
  return (
    <mesh position={[-0.72, 0.42, 0]} renderOrder={30}>
      <planeGeometry args={[0.16, 0.07]} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} depthTest={false} fog={false} />
    </mesh>
  );
}

/** World-space control strip in front of the player origin. */
export function MmdVrControlBar({onExit,busy,onDragChange:reportInteraction}:{onExit:()=>void;busy:boolean;onDragChange:(active:boolean)=>void}) {
  const t = useLanguageStore((s) => s.t);
  const loop = useMmdVrStore((s) => s.loop);
  const modelCount = useMmdVrStore((s) => s.modelCount);
  const objectCount = useMmdVrStore((s) => s.objects.length);
  const statusLine = useMmdVrStore((s) => s.statusLine);
  const assetLoad = useMmdVrStore((s) => s.assetLoad);
  const retryEpoch = useMmdVrStore((s) => s.assetRetryEpoch);
  const [dismissedLoadEpoch, setDismissedLoadEpoch] = useState(-1);
  const physicsError = useMmdVrStore((s) => s.physicsError);
  const placeMode = useMmdVrStore((s) => s.placeMode);
  const prefs = useMmdVrStore((s) => s.prefs);
  const setLoop = useMmdVrStore((s) => s.setLoop);
  const setPlaceMode = useMmdVrStore((s) => s.setPlaceMode);
  const physicsBusy = useMmdVrStore((s) => s.physicsBusy);
  const materialPanelOpen = useMmdVrStore((s) => s.materialPanelModelId != null);
  const [page, setPage] = useState<"watch" | "bag" | "scenery" | "advanced">("watch");
  const physicsFatal = useMmdVrStore(s => s.physicsFatal);
  const bagBusy = useBackpack(s => s.busy), bagError = useBackpack(s => s.error);
  const toy = useStagePlay(s => s.held?.toy);
  const selected = useBackpack(s => s.selected), draft = useBackpack(s => s.draft);
  const selectedLive = useBackpack(s => s.selected ? s.live[s.selected] : null);
  const draftName = useBackpack(s => s.entries.find(e => e.id === s.draft)?.file.name);
  const [recallingBusy, setRecallingBusy] = useState(false);
  const [intro,setIntro]=useState(()=>!introducedWatch&&!useMmdVrStore.getState().resumeStage?.assets.length&&modelCount===0&&objectCount===0&&!selectedLive&&!useBackpack.getState().layouts[prefs.scenery]?.assets.length);
  const [dock,setDock]=useState(false);
  const quiet=()=>{setIntro(false);setDock(false);setPage('watch');};
  useEffect(()=>{if(intro)introducedWatch=true;},[intro]);
  const [tab, setTab] = useState<"models" | SettingsSection>("player");
  const [assetIndex, setAssetIndex] = useState(0);
  const models = useMmdVrStore((s) => s.models);
  const objects = useMmdVrStore((s) => s.objects);
  const currentAsset = Math.min(assetIndex, Math.max(0, models.length + objects.length - 1));
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const rightController = useXRInputSourceState("controller", "right");
  const interacting = useRef(0);
  const [inputHeld, setInputHeld] = useState(false);
  const onDragChange = useCallback((active: boolean) => {
    interacting.current = Math.max(0, interacting.current + (active ? 1 : -1));
    setInputHeld(interacting.current > 0);
    reportInteraction(active);
  }, [reportInteraction]);
  const [physicsDetails, setPhysicsDetails] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState(PANEL_DEFAULT_POSITION);
  const panelGroupRef = useRef<THREE.Group>(null);
  const billboardTarget = useMemo(() => new THREE.Vector3(), []);
  const firstSession = useRef<XRSession | null>(null);
  const viewEpoch = useMmdVrStore((s) => s.viewEpoch);
  const recall = useCallback(() => {
    const group = panelGroupRef.current;
    if (!group?.parent || interacting.current) return;
    placeHudInFront(gl?.xr.isPresenting ? gl.xr.getCamera() : camera, group.parent, group);
    setPanelPosition(group.position.toArray());
  }, [camera, gl]);
  useEffect(() => { recall(); }, [viewEpoch, recall]);
  const inspect=useHudWorldInput(s=>s.inspect);
  useLayoutEffect(()=>{if(!inspect)return;useHudWorldInput.setState({inspect:null});
    const ix=[...models,...objects].findIndex(o=>o.id===inspect);if(ix<0)return;
    setAssetIndex(ix);setTab('models');setIntro(false);setDock(false);setPage('advanced');recall();
  },[inspect,models,objects,recall]);
  const previousSelection = useRef(selected);
  useEffect(() => {
    if (draft) {setIntro(false);setDock(false);setPage("watch");}
    if (draft || (!selected && previousSelection.current)) recall();
    previousSelection.current = selected;
  }, [draft, selected, recall]);
  useEffect(() => {
    if (recallingBusy && !bagBusy) { useBackpack.getState().select(null); setRecallingBusy(false); }
  }, [recallingBusy, bagBusy]);
  function summon() {setIntro(false);setDock(true);setPage('watch');recall();}
  useXRControllerButtonEvent(rightController, "b-button", (state) => {
    if (state !== "pressed" || interacting.current) return;
    queueMicrotask(() => {
      if (!panelGroupRef.current || interacting.current) return;
      const bag = useBackpack.getState();
      bag.cancelPlace();
      if (bag.busy) setRecallingBusy(true); else if (bag.selected && !bag.error) bag.select(null);
      useMmdVrStore.getState().setPlaceMode(false);
      setPhysicsDetails(false); setDiagnosticsOpen(false);
      summon();
    });
  });
  // Yaw-only billboard: keep the panel upright and always facing the user,
  // independent of where it was dragged or how the origin was turned.
  useFrame(({ camera, gl }, _, frame) => {
    const group = panelGroupRef.current;
    const parent = group?.parent;
    if (!group || !parent) return;
    if (frame && firstSession.current !== frame.session) {
      firstSession.current = frame.session;
      placeHudInFront(gl.xr.isPresenting ? gl.xr.getCamera() : camera, parent, group);
      const position = group.position.toArray();
      queueMicrotask(() => { if (panelGroupRef.current === group) setPanelPosition(position); });
    }
    if (!useMmdVrStore.getState().prefs.panelFollowUser || interacting.current) return;
    camera.getWorldPosition(billboardTarget);
    parent.worldToLocal(billboardTarget);
    const dx = billboardTarget.x - group.position.x;
    const dz = billboardTarget.z - group.position.z;
    if (dx * dx + dz * dz < 1e-8) return;
    group.rotation.y = Math.atan2(dx, dz);
  });
  const status =
    physicsError ?? statusLine ??
    (modelCount === 0 && objectCount === 0 ? t("settingsMmdVrEmptyNoAssets") : placeMode ? t("settingsMmdVrPlaceHint") : null);
  const surface = resolveHudSurface({ watching: page !== "advanced", loading: assetLoad.running,
    pendingFailures: assetLoad.failures.length > 0 && dismissedLoadEpoch !== retryEpoch,
    physicsDetails: physicsDetails && Boolean(physicsError), diagnostics: diagnosticsOpen });
  const notice = <CriticalNotice onDetails={() => setPhysicsDetails(true)} />;
  const worldBlocked = busy || inputHeld || Boolean(bagError) || surface !== "watch" || page !== "watch" || recallingBusy || ((dock||intro)&&!draft&&!placeMode);
  const editsLocked = busy || physicsBusy || physicsFatal || bagBusy || assetLoad.running;
  useLayoutEffect(() => {
    useHudWorldInput.setState({ blocked: worldBlocked });
    return () => { useHudWorldInput.setState({ blocked: false }); };
  }, [worldBlocked]);
  if (surface === "physics") {
    return <group position={panelPosition} ref={panelGroupRef}>
      <TextPanel title={t("hudPhysicsWarning")} text={physicsError ?? ""} onClose={() => setPhysicsDetails(false)} onExit={onExit} />
    </group>;
  }
  if (surface === "load") {
    return <group position={panelPosition} ref={panelGroupRef}>
      {notice}
      <LoadRecoveryPanel onExit={onExit} onContinue={() => setDismissedLoadEpoch(retryEpoch)} />
    </group>;
  }
  if (surface === "diagnostics") {
    return <group position={panelPosition} ref={panelGroupRef}>
      {notice}
      <DiagnosticsPanel onClose={() => {setDiagnosticsOpen(false);quiet();}} onExit={onExit} />
    </group>;
  }
  if (bagError) return <group position={panelPosition} ref={panelGroupRef} pointerEventsOrder={2}>
    {notice}<TextPanel title={t("hudBagError")} text={bagError} onClose={() => useBackpack.getState().dismissError()} onExit={onExit} />
  </group>;
  if (surface === "watch") {
    const locked = editsLocked || inputHeld;
    const open = (next: typeof page) => { if (interacting.current) return; setIntro(false);setDock(false);recall(); setPage(next); };
    if (page === "bag" || page === "scenery") return <group position={panelPosition} ref={panelGroupRef} pointerEventsOrder={2}>
      {notice}{page === "bag" ? <BackpackPanel locked={locked} onClose={quiet} /> : <SceneryPanel locked={locked}
        onClose={quiet} onSelected={() => summon()} />}
    </group>;
    if (draft || placeMode) return <group position={panelPosition} ref={panelGroupRef} pointerEventsOrder={2}>
      {notice}<HudSheet size={[1.98, 0.36]} />
      <HudLine text={draftName || t("hudMove")} position={[-0.27, 0.068, 0]} width={1.28} />
      <HudLine text={t("hudAimGround")} position={[-0.27, -0.055, 0]} width={1.28} role="muted" />
      <HudButton position={[0.67, 0, 0]} label={t("hudCancelPlace")} size={[0.5, 0.15]} onPress={() => { useBackpack.getState().cancelPlace(); setPlaceMode(false); }} />
    </group>;
    if (selected && selectedLive && !worldBlocked && !physicsFatal)
      return <group position={panelPosition} ref={panelGroupRef}>{notice}</group>;
    if(!intro&&!dock)return <><group name="watch:quiet" ref={panelGroupRef} position={panelPosition}>{notice}</group>
      {!rightController&&<WatchRecall open={summon}/>}</>;
    return (
      <group position={panelPosition} ref={panelGroupRef} pointerEventsOrder={2}>
        <group position-y={-.04}><HudSheet size={[1.89,intro ? .92 : .75]} /></group>
        {notice}
        <CompactPlaybackControls onScenery={() => open("scenery")} onBackpack={() => open("bag")} onExpand={() => {setTab('player');useMmdVrStore.getState().setMaterialPanelModelId(null);open('advanced');}} onTransport={quiet} onExit={onExit} busy={busy || inputHeld} playbackLocked={bagBusy || physicsBusy} />
        <HudButton position={[-.55,-.24,0]} label={t('hudBack')} size={[.51,.14]} variant="quiet" onPress={quiet}/>
        {intro?<><HudLine position={[0,.25,0]} center text={t('watchStart')} width={1.78}/><HudLine position={[0,-.405,0]} center text={t('watchRecall')} width={1.79} role="muted"/></>:<group position={[.41,.005,0]} scale={.85}>{!locked || inputHeld ? <ProgressBar onInteractionChange={onDragChange} /> : null}</group>}
        {toy && !assetLoad.failures.length && <HudButton position={[0,.43,0]} label={t('toyStow')} size={[.86,.14]} onPress={()=>useStagePlay.getState().stow()}/>}
        {assetLoad.failures.length > 0 ? <HudButton position={[0, 0.43, 0]} label={t("loadDetails")} size={[0.95, 0.13]} onPress={() => setDismissedLoadEpoch(-1)} /> : null}
        {!intro&&<DragHandle
          label={t("settingsMmdVrPanelDrag")}
          position={[-.44, 0.215, 0.012]}
          onDragChange={onDragChange}
          onPositionChange={setPanelPosition}
        />}
      </group>
    );
  }

  return (
    <group position={panelPosition} ref={panelGroupRef} pointerEventsOrder={2}>
      <PanelBackdrop sidebar={tab !== 'models'} />
      {notice}
      <DragHandle label={t("settingsMmdVrPanelDrag")} onDragChange={onDragChange} onPositionChange={setPanelPosition} />
      <HudButton position={[-0.98, 0.83, 0.03]} label={t("hudRecall")} size={[0.55, 0.14]} variant="quiet" onPress={recall} />
      <HudButton position={[0.98, 0.83, 0.03]} label={t("hudBack")} size={[0.55, 0.14]} variant="quiet" onPress={() => setPage("watch")} />
      {tab!=='models'&&<group name="hud:settings-rail" position={[-1.07,.42,.025]}>
        {settingsSections.map(([value,label],i)=><HudButton key={value}
          position={[0,-i*.25,0]} size={[.47,.18]} label={t(label)} variant="tab" active={tab===value} disabled={inputHeld} onPress={()=>setTab(value)}/>)}
      </group>}
      <group position-x={tab==='models'?0:.30}>
      {status && !physicsError && tab==='models' ? <group position={[0,.60,0]}><StatusPlane text={status} /></group> : null}
      {tab==='player'&&<PlayerSettings onDrag={onDragChange}/>}
      {tab==='character'&&<CharacterSettings locked={editsLocked}/>}
      {tab==='environment'&&<EnvironmentSettings onDrag={onDragChange} diagnostics={()=>setDiagnosticsOpen(true)}/>}
      {!materialPanelOpen && (tab === "models" ? (
        <>
          <HudButton position={[-0.85, 0.3, 0]} label={t("loadPrevious")} size={[0.55, 0.14]} disabled={currentAsset === 0} onPress={() => setAssetIndex(currentAsset - 1)} />
          <ValueLabel position={[0, 0.3, 0]} label={models.length + objects.length ? `${currentAsset + 1} / ${models.length + objects.length}` : t("settingsMmdVrEmptyNoAssets")} value="" size={[0.95, 0.14]} centered />
          <HudButton position={[0.85, 0.3, 0]} label={t("loadNext")} size={[0.55, 0.14]} disabled={currentAsset >= models.length + objects.length - 1} onPress={() => setAssetIndex(currentAsset + 1)} />
          {currentAsset < models.length ? <ModelPanels
            editsLocked={editsLocked}
            selectedIndex={currentAsset}
            hideLabel={t("settingsMmdVrHideModel")}
            showLabel={t("settingsMmdVrShowModel")}
            placeOnLabel={t("settingsMmdVrPlaceOn")}
            placeOffLabel={t("settingsMmdVrPlaceOff")}
            scaleLabel={t("settingsMmdVrModelScale")}
            rotateLeftLabel={t("settingsMmdVrRotateLeft")}
            rotateRightLabel={t("settingsMmdVrRotateRight")}
            resetValueLabel={t("settingsMmdVrValueReset")}
            removeLabel={t("settingsMmdVrRemoveModel")}
            materialsLabel={t("settingsMmdVrMaterials")}
            onInteractionChange={onDragChange}
           /> : <ObjectPanels
            editsLocked={editsLocked}
            selectedIndex={currentAsset - models.length}
            hideLabel={t("settingsMmdVrHideModel")}
            showLabel={t("settingsMmdVrShowModel")}
            placeOnLabel={t("settingsMmdVrPlaceOn")}
            placeOffLabel={t("settingsMmdVrPlaceOff")}
            scaleLabel={t("settingsMmdVrModelScale")}
            rotateLeftLabel={t("settingsMmdVrRotateLeft")}
            rotateRightLabel={t("settingsMmdVrRotateRight")}
            resetValueLabel={t("settingsMmdVrValueReset")}
            removeLabel={t("settingsMmdVrRemoveModel")}
            onInteractionChange={onDragChange}
          />}
        </>
      ) : null)}
      {materialPanelOpen ? (
        <MaterialPanel
          hideLabel={t("settingsMmdVrHideModel")}
          showLabel={t("settingsMmdVrShowModel")}
          materialsLabel={t("settingsMmdVrMaterials")}
          opacityLabel={t("settingsMmdVrMaterialOpacity")}
          emissionLabel={t("settingsMmdVrMaterialEmission")}
          closeLabel={t("hudModels")}
          disabled={busy || physicsBusy}
          onInteractionChange={onDragChange}
        />
      ) : null}
      </group>
      <group position={[0, -0.95, 0]}>
        <HudButton position={[.55,0,0]} size={[.55,.15]} label={t("settingsVrDesktopExit")} variant="quiet" onPress={onExit} disabled={busy}/>
        <HudButton position={[-.55, 0, 0]} label={loop ? t("settingsMmdVrLoopOn") : t("settingsMmdVrLoopOff")} active={loop} size={[0.46, 0.14]} onPress={() => setLoop(!loop)} />
      </group>
      {prefs.showFps ? <group position={[-.35,-1.10,0]}><FpsBadge /></group> : null}
    </group>
  );
}
