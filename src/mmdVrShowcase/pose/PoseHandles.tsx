import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { type Camera, Group, MathUtils, Mesh, PerspectiveCamera, Quaternion, type Ray, Vector3 } from 'three';
import { useBackpack } from '../backpack';
import { useHudWorldInput } from '../components/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { poseDial, poseTranslation } from './poseGesture';
import { poseHandleArt } from './poseHandleArt';
import { poseActions, type PoseKey, usePoseSession } from './poseSession';
import { usePoseTool } from './poseTool';
import { bindScreenPosePointer } from './screenPosePointer';

type Hit = { key: PoseKey; ring: boolean };
type Capture = { setPointerCapture(id: number): void; releasePointerCapture(id: number): void; hasPointerCapture?(id: number): boolean };
type Drag = { id: number; assetId: string; runtimeId: string; target: Capture; source?: XRInputSource; update(ray: Ray): void; transaction: boolean };
type XRPointer = ThreeEvent<PointerEvent> & { pointerState?: { inputSource?: XRInputSource } };
const rays = { allow: ['ray'] };
const noRaycast = () => null;

// Neither Three.Raycaster nor the XR pointer traversal filters Object3D.visible.
// Make unavailable joints transparent to the world's actual picker as well.
const pickVisible: Mesh['raycast'] = function (this: Mesh, raycaster, hits) {
  if (this.parent?.visible && this.parent.parent?.visible) Mesh.prototype.raycast.call(this,raycaster,hits);
};

function tracked(source: XRInputSource, session: XRSession | null | undefined, frame: XRFrame | undefined, ref: XRReferenceSpace | null) {
  if (!session || session.visibilityState !== 'visible' || !frame || !ref) return false;
  for (const input of session.inputSources) if (input === source) {
    try { return !!frame.getPose(source.targetRaySpace,ref); } catch { return false; }
  }
  return false;
}

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
  const root = useRef<Group>(null), joints = useRef(new Map<PoseKey,Group>()), drag = useRef<Drag | null>(null);
  const scratch = useMemo(() => ({ eye: new Vector3(), center: new Vector3(), out: new Vector3(), normal: new Vector3(),
    q: new Quaternion(), parentQ: new Quaternion() }), []);
  const art = useMemo(() => [poseHandleArt(false),poseHandleArt(true)],[]);
  useLayoutEffect(() => () => art.forEach(texture => texture.dispose()),[art]);

  const release = useCallback((cancel: boolean) => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    try { d.target.releasePointerCapture(d.id); } catch { /* session or contact already ended */ }
    const p = usePoseSession.getState();
    if (d.transaction && p.dragging && p.assetId === d.assetId && p.runtimeId === d.runtimeId) poseActions.finishDrag(cancel);
  },[]);

  const acquire = useCallback((hit: Hit, ray: Ray, point: Vector3, id: number, target: Capture, source?: XRInputSource) => {
    if (drag.current || !ready()) return false;
    const p = usePoseSession.getState(), joint = joints.current.get(hit.key);
    if (!joint?.visible || !p.keys.includes(hit.key) || !poseActions.point(hit.key,scratch.center)) return false;
    const looking: Camera = source ? gl.xr.getCamera() : camera;
    looking.getWorldDirection(scratch.normal).negate();
    const movable = !hit.ring && poseActions.canMove(hit.key);
    const axis = usePoseTool.getState().axis;
    const turn = hit.ring ? poseDial(ray,scratch.center,scratch.normal,joint.scale.x*.65) : null;
    const move = movable ? poseTranslation(ray,point,scratch.center,scratch.normal,!!source) : null;
    const last = scratch.center.clone();
    const d: Drag = { id, assetId: p.assetId!, runtimeId: p.runtimeId!, target, source, transaction: !!(turn || move), update(next) {
      if (turn) {
        const delta = turn(next);
        if (Math.abs(delta) > 1e-6) poseActions.rotate(hit.key,axis,delta);
      } else if (move?.(next,scratch.out) && scratch.out.distanceToSquared(last) > 1e-12) {
        last.copy(scratch.out); poseActions.move(hit.key,scratch.out);
      }
    } };
    // Refuse an uncaptured press rather than leaving stale ownership if the ray exits.
    try { target.setPointerCapture(id); } catch { return false; }
    drag.current = d;
    poseActions.select(hit.key);
    if (d.transaction && !poseActions.startDrag(hit.key)) { release(true); return false; }
    return true;
  },[camera,gl,scratch,release]);

  useFrame((_,__,frame) => {
    const group = root.current; if (!group) return;
    group.visible = ready();
    if (!group.visible) { release(true); return; }
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
    const d = drag.current;
    if (d?.source) {
      const session = frame?.session, ref = gl.xr.getReferenceSpace();
      if (!tracked(d.source,session,frame,ref)) release(true);
    }
  });

  useLayoutEffect(() => {
    const canvas = gl.domElement;
    const unbindScreen = bindScreenPosePointer(canvas,camera,{
      enabled: () => !gl.xr.isPresenting && ready() && !!root.current?.visible,
      targets() {
        const meshes: Mesh[] = [];
        for (const node of joints.current.values()) if (node.visible) {
          node.updateWorldMatrix(true,true);
          for (const m of node.children) if (m.userData.poseHit) meshes.push(m as Mesh);
        }
        return meshes;
      },
      begin: (mesh,ray,point,e) => acquire(mesh.userData.poseHit,ray,point,e.pointerId,canvas),
      owner: () => drag.current?.source ? undefined : drag.current?.id,
      move: ray => drag.current?.update(ray), release,
    });
    const cancel = () => release(true);
    const visible = () => { if (document.hidden) cancel(); };
    const session = gl.xr.getSession();
    const xrVisible = () => { if (session?.visibilityState !== 'visible') cancel(); };
    const sources = (e: XRInputSourcesChangeEvent) => { const d = drag.current; if (d?.source && e.removed.includes(d.source)) cancel(); };
    const changed = () => { if (drag.current && !ready()) cancel(); };
    const off = [useBackpack.subscribe(changed),useHudWorldInput.subscribe(changed),useMmdVrStore.subscribe((s,prev) => {
      if (s.entryEpoch !== prev.entryEpoch || s.prefs.scenery !== prev.prefs.scenery) cancel(); else changed();
    }),usePoseSession.subscribe(changed)];
    window.addEventListener('blur',cancel); document.addEventListener('visibilitychange',visible);
    session?.addEventListener('visibilitychange',xrVisible); session?.addEventListener('inputsourceschange',sources); session?.addEventListener('end',cancel);
    return () => {
      off.forEach(f => f()); unbindScreen(); cancel();
      window.removeEventListener('blur',cancel); document.removeEventListener('visibilitychange',visible);
      session?.removeEventListener('visibilitychange',xrVisible); session?.removeEventListener('inputsourceschange',sources); session?.removeEventListener('end',cancel);
    };
  },[camera,gl,acquire,release]);

  function xrBindings(hit: Hit) {
    return {
      userData: { poseHit: hit }, pointerEventsType: rays, pointerEventsOrder: .5, raycast: pickVisible,
      onPointerDown(e: XRPointer) {
        if (!gl.xr.isPresenting || e.pointerType !== 'ray' || !ready() || e.button !== 0) return;
        e.stopPropagation();
        const source = e.pointerState?.inputSource;
        const frame = (e.nativeEvent as unknown as Partial<XRInputSourceEvent>).frame;
        if (source && source.targetRayMode === 'tracked-pointer' && tracked(source,gl.xr.getSession(),frame,gl.xr.getReferenceSpace())) {
          acquire(hit,e.ray,e.point,e.pointerId,e.target as unknown as Capture,source);
        }
      },
      onPointerMove(e: XRPointer) {
        const d = drag.current; if (!d?.source || d.id !== e.pointerId) return;
        e.stopPropagation(); if (!ready()) release(true); else d.update(e.ray);
      },
      onPointerUp(e: XRPointer) {
        e.stopPropagation(); const d = drag.current; if (!d?.source || d.id !== e.pointerId) return;
        const frame = (e.nativeEvent as unknown as Partial<XRInputSourceEvent>).frame;
        const valid = ready() && tracked(d.source,gl.xr.getSession(),frame,gl.xr.getReferenceSpace());
        if (valid) d.update(e.ray); release(!valid);
      },
      onPointerCancel(e: XRPointer) { if (e.pointerId === drag.current?.id) release(true); },
      onLostPointerCapture(e: XRPointer) { if (e.pointerId === drag.current?.id) release(true); },
      onPointerLeave(e: XRPointer) {
        const d = drag.current;
        if (d?.source && d.id === e.pointerId && d.target.hasPointerCapture?.(d.id) === false) release(true);
      },
      onClick(e: ThreeEvent<MouseEvent>) { e.stopPropagation(); },
    };
  }
  return <group ref={root} name="pose:handles">{keys.map(k => <group key={k} name={`pose:${k}`} ref={el => { if (el) joints.current.set(k,el); else joints.current.delete(k); }}>
    <mesh raycast={noRaycast} pointerEvents="none" renderOrder={8}><planeGeometry args={[6.4,6.4]}/>
      <meshBasicMaterial map={art[Number(k === selected)]} fog={false} toneMapped={false} transparent depthWrite={false} depthTest={false}/></mesh>
    <mesh name={`pose:point:${k}`} {...xrBindings({key:k,ring:false})}><circleGeometry args={[1.15,24]}/><meshBasicMaterial visible={false}/></mesh>
    {selected === k && <mesh name={`pose:dial:${k}`} {...xrBindings({key:k,ring:true})}><ringGeometry args={[1.72,3.0,48]}/><meshBasicMaterial visible={false}/></mesh>}
  </group>)}</group>;
}
