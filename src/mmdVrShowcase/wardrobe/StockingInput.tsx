import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { type Group, type Ray, Vector3 } from 'three';
import { useBackpack } from '../backpack/store';
import { xrPoseSampler } from '../pose/xrPoseSample';
import { bindStockingPointer } from './stockingPointer';
import { stockingPull } from './stockingPull';
import { disarmStockingTear, recordStockingTear, useStockings, type StockingActor } from './stockingState';
import { pickStockingSurface, readStockingFitOwner, subscribeStockingFit } from './stockingSurface';

type Capture = { setPointerCapture(id: number): void; releasePointerCapture(id: number): void; hasPointerCapture?(id: number): boolean };
type XRPointer = ThreeEvent<PointerEvent> & { pointerState?: { inputSource?: XRInputSource } };
type Press = { id: number; capture: Capture; source?: XRInputSource; emulated: boolean; pull: ReturnType<typeof stockingPull> };
const rayOnly = { allow: ['ray'] };

export function StockingInput({ actor }: { actor: StockingActor }) {
  const { camera, gl } = useThree(), press = useRef<Press | null>(null);
  const target = useRef<Group>(null), center = useMemo(() => new Vector3(), []);
  const live = useBackpack(s => s.live[actor.assetId]);
  const tracked = useMemo(xrPoseSampler, []);
  const fitOwner = useMemo(() => readStockingFitOwner(actor.runtimeId), [actor]);
  const valid = () => !!fitOwner && useStockings.getState().armed === actor && readStockingFitOwner(actor.runtimeId) === fitOwner;
  const read = (source: XRInputSource, frame?: XRFrame) => tracked(source, gl.xr.getSession(), frame, gl.xr.getReferenceSpace(), gl.xr.getCamera().parent);
  const cancel = useCallback((id?: number) => {
    const p = press.current;
    if (!p || (id !== undefined && id !== p.id)) return;
    press.current = null;
    try { p.capture.releasePointerCapture(p.id); } catch { /* capture already retired */ }
  }, []);
  const begin = (id: number, ray: Ray, capture: Capture, source?: XRInputSource, emulated = false) => {
    if (press.current || !valid()) return;
    const pick = (r: Ray) => pickStockingSurface(actor.runtimeId, r), grab = pick(ray);
    if (!grab) return;
    try { capture.setPointerCapture(id); if (capture.hasPointerCapture?.(id) === false) return; } catch { return; }
    const pull = stockingPull(ray, grab, live?.bounds?.size[1] || 1.6, pick);
    press.current = { id, capture, source, emulated, pull };
  };
  const release = (id: number, ray: Ray, source?: XRInputSource) => {
    const p = press.current;
    if (!p || p.id !== id || p.source !== source) return;
    const tear = valid() && p.pull(ray);
    cancel(id);
    if (tear) recordStockingTear(actor, tear);
  };
  const handlers = useRef({ begin, release, valid });
  useLayoutEffect(() => { handlers.current = { begin, release, valid }; });

  useLayoutEffect(() => {
    const canvas = gl.domElement, session = gl.xr.getSession();
    const unbind = session ? undefined : bindStockingPointer(canvas, camera, {
      enabled: () => handlers.current.valid(), begin: (r, e) => handlers.current.begin(e.pointerId, r, canvas),
      release: (r, e) => handlers.current.release(e.pointerId, r), cancel,
    });
    const interrupt = () => { cancel(); if (useStockings.getState().armed === actor) disarmStockingTear(actor); };
    const pageVisibility = () => { if (document.hidden) interrupt(); };
    const xrVisibility = () => { if (session?.visibilityState !== 'visible') interrupt(); };
    const inputs = (e: XRInputSourcesChangeEvent) => {
      if (press.current?.source && e.removed.includes(press.current.source)) interrupt();
    };
    const fit = subscribeStockingFit(() => { if (!handlers.current.valid()) interrupt(); });
    const off = useStockings.subscribe(s => { if (s.armed !== actor) cancel(); });
    if (!handlers.current.valid()) interrupt();
    window.addEventListener('blur', interrupt); document.addEventListener('visibilitychange', pageVisibility);
    session?.addEventListener('inputsourceschange', inputs); session?.addEventListener('end', interrupt); session?.addEventListener('visibilitychange', xrVisibility);
    return () => {
      off(); fit(); unbind?.(); cancel();
      window.removeEventListener('blur', interrupt); document.removeEventListener('visibilitychange', pageVisibility);
      session?.removeEventListener('inputsourceschange', inputs); session?.removeEventListener('end', interrupt); session?.removeEventListener('visibilitychange', xrVisibility);
    };
  }, [actor, camera, gl, cancel]);

  useFrame((_, __, frame) => {
    const p = press.current;
    if (p?.source) {
      const sample = read(p.source, frame);
      if (!sample || (!p.emulated && sample.emulated)) { cancel(); disarmStockingTear(actor); }
    }
  });
  if (!live || !gl.xr.isPresenting) return null;
  const bounds = live.bounds, height = bounds?.size[1] || 1.6;
  const [x, y, z] = live.position, reach = Math.max(height, ...(bounds?.size ?? []));
  const frameOf = (e: XRPointer) => (e.nativeEvent as unknown as Partial<XRInputSourceEvent>).frame;
  const sourceOf = (e: XRPointer) => e.pointerState?.inputSource ?? (e.nativeEvent as unknown as Partial<XRInputSourceEvent>).inputSource;
  return <group ref={target} name="wardrobe:stocking-input" position={bounds?.center ?? [x, y + height/2, z]} pointerEventsType={rayOnly} pointerEventsOrder={.5}
    raycast={(caster, hits) => {
      const node = target.current;
      if (!node) return;
      // Route XR events at actor depth without checking PMX skinning on hover.
      // Leave room for a raised knee or a foot beyond the idle bounds.
      node.getWorldPosition(center);
      const along = center.sub(caster.ray.origin).dot(caster.ray.direction);
      const radialSq = center.addScaledVector(caster.ray.direction, -along).lengthSq();
      if (radialSq > reach*reach) return;
      const half = Math.sqrt(reach*reach - radialSq), exit = along + half;
      if (exit < caster.near || along - half > caster.far) return;
      // From inside the volume an aimed-at foot can be lower than the hand,
      // with the actor's centre behind the ray. Still route that close press.
      const depth = Math.min(caster.far, along > caster.near ? along : exit);
      hits.push({ distance: depth, point: caster.ray.at(depth, new Vector3()), normal: caster.ray.direction.clone().negate(), object: node });
    }}
    onPointerDown={(e: XRPointer) => {
      e.stopPropagation(); const source = sourceOf(e);
      if (e.button !== 0 || press.current || source?.targetRayMode !== 'tracked-pointer') return;
      const sample = read(source, frameOf(e));
      if (sample) begin(e.pointerId, sample.ray, e.target as unknown as Capture, source, sample.emulated);
    }} onPointerUp={(e: XRPointer) => {
      e.stopPropagation(); const p = press.current, source = sourceOf(e);
      if (e.button !== 0 || !source || !p || p.source !== source || e.pointerId !== p.id) return;
      const sample = read(source, frameOf(e));
      if (!sample || (!p.emulated && sample.emulated)) cancel(p.id); else release(p.id, sample.ray, source);
    }} onPointerCancel={e => cancel(e.pointerId)} onLostPointerCapture={e => cancel(e.pointerId)} onClick={e => e.stopPropagation()}/>;
}
