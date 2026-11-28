import { useCallback, useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Group, MathUtils, PerspectiveCamera, Quaternion, type Ray, Raycaster, Vector3 } from 'three';
import { useBackpack } from '../backpack/store';
import { useHudWorldInput } from '../hud/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { carryPoseCenter, poseDial, screenPoseTranslation } from './poseGesture';
import { PoseGuide, type PoseGuideUpdate } from './PoseGuide';
import { confirmPosePress, posePicker, type PoseHit } from './posePick';
import { xrPoseSampler } from './xrPoseSample';
import { poseHandleArt } from './poseHandleArt';
import { poseActions, type PoseKey, usePoseSession } from './poseSession';
import { usePoseTool } from './poseTool';
import { bindScreenPosePointer } from './screenPosePointer';
import { FloorInputContext } from '../xr/floorInput';

type Capture = { setPointerCapture(id: number): void; releasePointerCapture(id: number): void; hasPointerCapture?(id: number): boolean };
type Drag = { id: number; assetId: string; runtimeId: string; target: Capture; source?: XRInputSource; beganEmulated:boolean; start: Vector3; goal?: Vector3;
  update(ray: Ray, wheelPixels?: number, grip?: Vector3): void; transaction: boolean };
type XRPointer = ThreeEvent<PointerEvent> & { pointerState?: { inputSource?: XRInputSource } };
const rays = { allow: ['ray'] };
const noRaycast = () => null;

function ready() {
  const p = usePoseSession.getState(), b = useBackpack.getState(), s = useMmdVrStore.getState();
  return p.editing && !!p.assetId && b.selected === p.assetId && b.live[p.assetId]?.runtimeId === p.runtimeId && b.live[p.assetId].visible
    && !b.busy && !b.draft && s.overlayOpen && !s.assetLoad.running && !s.physicsBusy && !s.physicsFatal
    && (s.presentation !== 'xr' || !useHudWorldInput.getState().blocked);
}

export function PoseHandles() {
  const runtimeId = usePoseSession(s => s.editing ? s.runtimeId : null);
  return runtimeId ? <MountedHandles key={runtimeId}/> : null;
}

function MountedHandles() {
  const { camera, gl } = useThree(), keys = usePoseSession(s => s.keys), selected = usePoseSession(s => s.selected);
  const pinned = usePoseSession(s => s.pinnedWrists);
  const root = useRef<Group>(null), joints = useRef(new Map<PoseKey,Group>()), drag = useRef<Drag | null>(null);
  const guide = useRef<PoseGuideUpdate>(null), pick = useMemo(posePicker,[]), readTracked = useMemo(xrPoseSampler,[]);
  const pressCaster=useMemo(()=>new Raycaster(),[]);
  const floorInput = useContext(FloorInputContext);
  const tracked = (source:XRInputSource,frame?:XRFrame) => floorInput && !floorInput.tracked() ? null :
    readTracked(source,gl.xr.getSession(),frame,gl.xr.getReferenceSpace(),gl.xr.getCamera().parent);
  const moving = usePoseSession(s=>s.dragging) && !!drag.current?.goal;
  const scratch = useMemo(() => ({ eye: new Vector3(), center: new Vector3(), out: new Vector3(), normal: new Vector3(),
    q: new Quaternion(), parentQ: new Quaternion() }), []);
  const art = useMemo(() => [poseHandleArt(false),poseHandleArt(true),poseHandleArt(false,true),poseHandleArt(true,true)],[]);
  useLayoutEffect(() => () => art.forEach(texture => texture.dispose()),[art]);

  const release = useCallback((cancel: boolean) => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    try { d.target.releasePointerCapture(d.id); } catch { /* session or contact already ended */ }
    const p = usePoseSession.getState();
    if (d.transaction && p.dragging && p.assetId === d.assetId && p.runtimeId === d.runtimeId) poseActions.finishDrag(cancel);
  },[]);

  const acquire = useCallback((hit: PoseHit, ray: Ray, point: Vector3, id: number, target: Capture, source?: XRInputSource, grip?: Vector3, beganEmulated=false) => {
    if (drag.current || !ready()) return false;
    const p = usePoseSession.getState(), joint = joints.current.get(hit.key);
    if (!joint?.visible || !p.keys.includes(hit.key) || !poseActions.point(hit.key,scratch.center)) return false;
    const looking = source ? gl.xr.getCamera() : camera;
    looking.getWorldDirection(scratch.normal).negate();
    const movable = !hit.ring && poseActions.canMove(hit.key);
    const axis = usePoseTool.getState().axis;
    const turn = hit.ring ? poseDial(ray,scratch.center,scratch.normal,joint.scale.x*.65) : null;
    const carry = movable && grip ? carryPoseCenter(grip,scratch.center) : null;
    const slide = movable && !source ? screenPoseTranslation(ray,point,scratch.center,scratch.normal,joint.scale.x/13) : null;
    const start = scratch.center.clone(), goal = carry || slide ? start.clone() : undefined;
    // Selecting a wrist at the end of its reach must not silently replace its
    // more distant pin with hand jitter. Once moving, retain full precision.
    let movingPin = !p.pinnedWrists.some(k => k === hit.key);
    const slop = source ? .004 : joint.scale.x * 2/13;
    const d: Drag = { id, assetId: p.assetId!, runtimeId: p.runtimeId!, target, source, beganEmulated, start, goal, transaction: !!(turn || goal), update(next,wheel,hand) {
      if (turn) {
        if (wheel) return;
        const delta = turn(next);
        if (Math.abs(delta) > 1e-6) poseActions.rotate(hit.key,axis,delta);
      } else if (goal && (carry && hand ? carry(hand,scratch.out) : slide?.(next,scratch.out,wheel)) && scratch.out.distanceToSquared(goal) > 1e-12) {
        if (!movingPin && scratch.out.distanceToSquared(start) < slop*slop) return;
        movingPin = true;
        goal.copy(scratch.out); poseActions.move(hit.key,scratch.out);
      }
    } };
    // Refuse an uncaptured press rather than leaving stale ownership if the ray exits.
    try { target.setPointerCapture(id); if (target.hasPointerCapture?.(id)===false) return false; } catch { return false; }
    drag.current = d;
    poseActions.select(hit.key);
    if (d.transaction && !poseActions.startDrag(hit.key)) { release(true); return false; }
    return true;
  },[camera,gl,scratch,release]);

  useFrame((_,__,frame) => {
    const group = root.current; if (!group) return;
    group.visible = ready();
    if (!group.visible) { release(true); return; }
    const d = drag.current;
    if (d?.source) {
      const sample = tracked(d.source,frame);
      if (sample && (d.beganEmulated || !sample.emulated)) d.update(sample.ray,0,sample.grip); else release(true);
    }
    const xr = gl.xr.isPresenting, view = xr ? gl.xr.getCamera() : camera;
    view.getWorldPosition(scratch.eye); view.getWorldQuaternion(scratch.q);
    group.getWorldQuaternion(scratch.parentQ).invert();
    const pixelScale = !xr && camera instanceof PerspectiveCamera ? 2*Math.tan(MathUtils.degToRad(camera.getEffectiveFOV())/2) / Math.max(1,gl.domElement.clientHeight) : 0;
    for (const [k,node] of joints.current) {
      node.visible = poseActions.point(k,scratch.center);
      if (!node.visible) continue;
      const distance = scratch.center.distanceTo(scratch.eye);
      node.position.copy(group.worldToLocal(scratch.center));
      node.quaternion.multiplyQuaternions(scratch.parentQ,scratch.q);
      node.scale.setScalar(xr ? MathUtils.clamp(distance*.023,.021,.058) : MathUtils.clamp(distance*pixelScale*13,.009,.18));
    }
    const key=usePoseSession.getState().selected, node=joints.current.get(key), active=drag.current;
    if (node?.visible) {
      const goal = active?.goal ?? (poseActions.wristTarget(key,scratch.out) ? scratch.out : undefined);
      guide.current?.(group,key,node,active?.goal ? active.start : undefined,goal);
    }
  });

  useLayoutEffect(() => {
    const canvas = gl.domElement;
    const unbindScreen = bindScreenPosePointer(canvas,camera,{
      enabled: () => !gl.xr.isPresenting && ready() && !!root.current?.visible,
      target: () => root.current,
      begin: (mesh,ray,point,e) => acquire(mesh.userData.poseHit,ray,point,e.pointerId,canvas),
      owner: () => drag.current?.source ? undefined : drag.current?.id,
      move: (ray,wheel) => drag.current?.update(ray,wheel), release,
    });
    const cancel = () => release(true);
    const offFloor = floorInput?.subscribe(reason => { if (reason !== 'visible-frame-gap') cancel(); });
    const visible = () => { if (document.hidden) cancel(); };
    const session = gl.xr.getSession();
    const xrVisible = () => { if (session?.visibilityState !== 'visible') cancel(); };
    const sources = (e: XRInputSourcesChangeEvent) => { const d = drag.current; if (d?.source && e.removed.includes(d.source)) cancel(); };
    const changed = () => { if (drag.current && !ready()) cancel(); };
    const off = [useBackpack.subscribe(changed),useHudWorldInput.subscribe(changed),useMmdVrStore.subscribe((s,prev) => {
      if (s.entryEpoch !== prev.entryEpoch || s.prefs.scenery !== prev.prefs.scenery) cancel(); else changed();
    }),usePoseSession.subscribe(changed)];
    if (!floorInput) {
      window.addEventListener('blur',cancel); document.addEventListener('visibilitychange',visible);
      session?.addEventListener('visibilitychange',xrVisible);
    }
    session?.addEventListener('inputsourceschange',sources); session?.addEventListener('end',cancel);
    return () => {
      offFloor?.(); off.forEach(f => f()); unbindScreen(); cancel();
      window.removeEventListener('blur',cancel); document.removeEventListener('visibilitychange',visible);
      session?.removeEventListener('visibilitychange',xrVisible); session?.removeEventListener('inputsourceschange',sources); session?.removeEventListener('end',cancel);
    };
  },[camera,gl,acquire,release,floorInput]);

  const ownsXR = (e: XRPointer) => drag.current?.source && e.pointerId===drag.current.id && e.pointerState?.inputSource===drag.current.source;
  const eventFrame = (e: XRPointer) => (e.nativeEvent as unknown as Partial<XRInputSourceEvent>).frame;
  return <group ref={root} name="pose:handles" pointerEventsType={rays} pointerEventsOrder={.5} intersectChildren={false}
    raycast={(caster,out) => { if (root.current?.visible) pick(caster,joints.current,usePoseSession.getState().selected,out); }}
    onPointerDown={(e:XRPointer) => {
      if (!gl.xr.isPresenting || e.pointerType!=='ray' || !ready() || e.button!==0) return;
      e.stopPropagation(); const source=e.pointerState?.inputSource;
      if (drag.current || !root.current || source?.targetRayMode!=='tracked-pointer') return;
      const sample=tracked(source,eventFrame(e));
      if (!sample) return;
      const hit=confirmPosePress(pressCaster,root.current,sample.ray,e.object);
      if (hit) acquire(hit.object.userData.poseHit,sample.ray,hit.point,e.pointerId,e.target as unknown as Capture,source,sample.grip,sample.emulated);
    }} onPointerUp={(e:XRPointer) => {
      e.stopPropagation(); if (!ownsXR(e) || e.button!==0) return;
      const d=drag.current!, sample=ready() && tracked(d.source!,eventFrame(e));
      const valid=sample && (d.beganEmulated || !sample.emulated);
      if (valid) d.update(sample.ray,0,sample.grip); release(!valid);
    }} onPointerCancel={(e:XRPointer) => { if (ownsXR(e)) release(true); }}
    onLostPointerCapture={(e:XRPointer) => { if (ownsXR(e)) release(true); }}
    onPointerLeave={(e:XRPointer) => { if (ownsXR(e) && drag.current?.target.hasPointerCapture?.(e.pointerId)===false) release(true); }}
    onClick={e=>e.stopPropagation()}>
    {keys.map(k => <group key={k} pointerEvents="none" name={`pose:${k}`} ref={el => { if (el) joints.current.set(k,el); else joints.current.delete(k); }}>
      <mesh raycast={noRaycast} renderOrder={k===selected?9:8}><planeGeometry args={[6.4,6.4]}/>
        <meshBasicMaterial map={art[Number(k===selected && !moving) + ((k==='leftHand' || k==='rightHand') && pinned.includes(k) ? 2 : 0)]} fog={false} toneMapped={false} transparent depthWrite={false} depthTest={false}/></mesh>
      <mesh name={`pose:point:${k}`} userData={{poseHit:{key:k,ring:false}}}><circleGeometry args={[1.15,24]}/><meshBasicMaterial visible={false}/></mesh>
      {selected===k && <mesh name={`pose:dial:${k}`} userData={{poseHit:{key:k,ring:true}}}><ringGeometry args={[1.96,2.84,48]}/><meshBasicMaterial visible={false}/></mesh>}
    </group>)}<PoseGuide ref={guide}/>
  </group>;
}
