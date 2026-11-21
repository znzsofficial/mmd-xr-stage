import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, type Group, SRGBColorSpace, Vector3 } from "three";
import { useBackpack, type BackpackLive } from "../backpack";
import { HUD_COLORS } from "../hudAppearance";
import { useMmdVrStore } from "../mmdVrStore";
import { canPlaceInScenery } from "../scenery/placementAreas";
import {roomPickDecks,visiblePick} from '../scenery/pickDecks';
import type { SceneryId } from "../scenery/catalog";
import { useLanguageStore } from "../../languageStore";
import { useHudWorldInput } from "./hudWorldInput";

// Contact with a character is for Bullet. Only a deliberate far-ray selection
// can open its tool strip, never a touch or a grab while adjusting clothing.
const rayOnly = { allow: ['ray', 'mouse', 'screen-mouse'] };
const noRaycast = () => null;

function stamp(valid: boolean, zh: boolean) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const c = canvas.getContext('2d')!;
  // On an XZ plane texture-top points toward -Z. The chevron points +Z,
  // matching zero world yaw and the exported placement heading.
  const ink = valid ? HUD_COLORS.primary : HUD_COLORS.danger;
  c.fillStyle = HUD_COLORS.surface; c.strokeStyle = ink; c.lineWidth = 7;
  c.beginPath(); c.arc(128, 129, 99, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = ink; c.lineCap = 'round'; c.lineJoin = 'round';
  if (valid) {
    for (const side of [-1, 1]) {
      c.save(); c.translate(128 + side * 28, 119); c.rotate(-side * 0.14);
      c.beginPath(); c.ellipse(0, 0, 15, 29, 0, 0, 2 * Math.PI); c.fill();
      c.beginPath(); c.ellipse(0, -36, 12, 10, 0, 0, 2 * Math.PI); c.fill(); c.restore();
    }
    c.lineWidth = 10; c.beginPath(); c.moveTo(108, 166); c.lineTo(128, 184); c.lineTo(148, 166); c.stroke();
  } else {
    c.lineWidth = 12; c.beginPath(); c.moveTo(104, 85); c.lineTo(152, 133); c.moveTo(152, 85); c.lineTo(104, 133); c.stroke();
    c.font = '600 23px system-ui,sans-serif'; c.textAlign = 'center'; c.fillText(zh ? '换个位置' : 'No space', 128, 170);
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; return texture;
}

function DropSurface({ id, scenery }: { id: string; scenery: SceneryId }) {
  const camera = useThree(s => s.camera), gl = useThree(s => s.gl);
  const language = useLanguageStore(s => s.language);
  const valid = useRef<Group>(null), invalid = useRef<Group>(null), marker = useRef<Group>(null);
  const head = useMemo(() => new Vector3(), []);
  const stamps = useMemo(() => [stamp(true, language === 'zh'), stamp(false, language === 'zh')], [language]);
  useEffect(() => () => stamps.forEach(t => t.dispose()), [stamps]);
  const pressed = useRef<number | null>(null), hovering = useRef<number | null>(null);

  function target(e: ThreeEvent<PointerEvent>,supportY:number) {
    if (pressed.current != null && e.pointerId !== pressed.current) return;
    e.stopPropagation();
    const { x, y, z } = e.point;
    const allowed = canPlaceInScenery(scenery, x, z,supportY) && visiblePick(scenery,e.ray.origin,x,supportY,z);
    (gl.xr.isPresenting ? gl.xr.getCamera() : camera).getWorldPosition(head);
    const s = useMmdVrStore.getState(), live = useBackpack.getState().live[id];
    const existing = live ? s.models.find(e => e.id === live.runtimeId) ?? s.objects.find(e => e.id === live.runtimeId) : undefined;
    const yaw = existing?.rotationY ?? Math.atan2(head.x - x, head.z - z) * 180 / Math.PI;
    hovering.current = e.pointerId;
    const bag = useBackpack.getState();
    if (bag.draft === id && bag.draftStartedAt !== null && bag.previewDelayMs === null) {
      useBackpack.setState({ previewDelayMs: Math.round(performance.now() - bag.draftStartedAt) });
    }
    if (marker.current && valid.current && invalid.current) {
      marker.current.position.set(x, y+.009, z); marker.current.rotation.y = yaw * Math.PI / 180;
      marker.current.visible = true; valid.current.visible = allowed; invalid.current.visible = !allowed;
    }
    return { allowed, x, z, yaw,supportY };
  }
  const leave = (e: ThreeEvent<PointerEvent>) => {
    if (pressed.current === e.pointerId) pressed.current = null;
    if (hovering.current === e.pointerId && marker.current) marker.current.visible = false;
  };
  return <>
    {roomPickDecks(scenery).map(r=><mesh key={`${r.x}/${r.y}/${r.z}`} name={r.y?'backpack:deck':'backpack:ground'} userData={{supportY:r.y}} position={[r.x,r.y+.012,r.z]} rotation-x={-Math.PI/2} pointerEventsType={rayOnly} pointerEventsOrder={-1}
      onPointerMove={e=>target(e,r.y)} onPointerLeave={leave} onPointerCancel={leave}
      onPointerDown={e => { if (target(e,r.y)?.allowed) pressed.current = e.pointerId; }}
      onPointerUp={e => {
        const hit = target(e,r.y);
        if (pressed.current !== e.pointerId) return;
        pressed.current = null;
        const s = useMmdVrStore.getState();
        if (hit?.allowed && !s.physicsBusy && !s.assetLoad.running && s.prefs.scenery === scenery) useBackpack.getState().confirmPlace(id, hit.x, hit.z, hit.yaw,hit.supportY);
      }}>
      <planeGeometry args={[r.w,r.d]} /><meshBasicMaterial visible={false} />
    </mesh>)}
    <group ref={marker} visible={false} pointerEvents="none">
      {[valid, invalid].map((ref, i) => <group ref={ref} key={i}><mesh rotation-x={-Math.PI/2} raycast={noRaycast} renderOrder={2}>
        <planeGeometry args={[.48,.48]} /><meshBasicMaterial map={stamps[i]} transparent depthWrite={false} toneMapped={false} />
      </mesh></group>)}
    </group>
  </>;
}

function PickTarget({ id, live, onScreenPick }: { id: string; live: BackpackLive; onScreenPick?:()=>void }) {
  const held = useRef<number | null>(null);
  const [x,y,z] = live.position;
  const size: [number,number,number] = live.bounds ? [Math.max(.09,live.bounds.size[0]),Math.max(.09,live.bounds.size[1]),Math.max(.09,live.bounds.size[2])] : [.48,1.56,.38];
  return <mesh name={`backpack:pick:${id}`} pointerEventsType={rayOnly} pointerEventsOrder={-1} position={live.bounds?.center ?? [x,y+.78,z]}
    onClick={onScreenPick ? e=>{if(e.button===0&&e.delta<5){e.stopPropagation();useBackpack.getState().select(id);onScreenPick();}} : undefined}
    onPointerDown={e => { if(onScreenPick)return;e.stopPropagation(); held.current = e.pointerId; }}
    onPointerLeave={e => { if (e.pointerId === held.current) held.current = null; }}
    onPointerCancel={() => { held.current = null; }}
    onPointerUp={e => { if(onScreenPick)return;e.stopPropagation(); if (held.current === e.pointerId) { held.current = null; useBackpack.getState().select(id); } }}>
    <boxGeometry args={size} />
    <meshBasicMaterial visible={false} />
  </mesh>;
}

export function BackpackPlacement({onScreenPick}:{onScreenPick?:()=>void}={}) {
  const draft = useBackpack(s => s.draft), live = useBackpack(s => s.live), busy = useBackpack(s => s.busy);
  const scenery = useMmdVrStore(s => s.prefs.scenery);
  const panelOpen = useHudWorldInput(s => s.blocked);
  const xr = useMmdVrStore(s=>s.presentation==='xr');
  const blocked = useMmdVrStore(s => s.assetLoad.running || s.physicsBusy || s.physicsFatal);
  if (blocked || busy || (xr && panelOpen)) return null;
  return draft ? <DropSurface key={`${scenery}:${draft}`} id={draft} scenery={scenery} /> :
    <>{Object.entries(live).map(([id,entry]) => entry.visible && <PickTarget key={id} id={id} live={entry} onScreenPick={onScreenPick} />)}</>;
}
