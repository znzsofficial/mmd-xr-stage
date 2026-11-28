import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Group, Object3D, Vector3 } from 'three';
import { useBackpack } from '../../backpack/store';
import { useMmdVrStore } from '../../mmdVrStore';
import { noPick } from '../../scenery/sceneryPaint';
import { hasToyStation } from '../propCatalog';
import { useStagePlay } from '../stagePlay';
import { CORD_SAMPLES, createKiteHorizon, displayedEyelet, flightPoint, headOf, writeCord } from './kiteFlight';
import { makeStreamer, makeSwallow } from './kiteModels';
import { useKiteStore } from './kiteStore';

function makeLine() {
  const geometry = new BufferGeometry(), coords = new Float32Array(CORD_SAMPLES*6);
  const position = new BufferAttribute(coords,3).setUsage(DynamicDrawUsage);
  const color: number[] = [], index: number[] = [];
  const dark = new Color('#855f41'), light = new Color('#ffdd94');
  for (let i=0; i<CORD_SAMPLES; i++) {
    color.push(dark.r,dark.g,dark.b,light.r,light.g,light.b);
    const k = i*2;
    if (i) index.push(k-2,k-1,k,k-1,k+1,k);
  }
  geometry.setAttribute('position',position); geometry.setAttribute('color',new BufferAttribute(new Float32Array(color),3)); geometry.setIndex(index);
  return { geometry, position, coords, path: new Float32Array(CORD_SAMPLES*3) };
}

/** Slightly thicker than a WebGL hairline for stereo. A single short ribbon
 * with pinned end vertices, updated in place, with a flax-coloured lit edge. */
function drawLine(line: ReturnType<typeof makeLine>, from: Vector3, to: Vector3, guard: boolean) {
  const { path, coords } = line; writeCord(path, from, to, guard);
  for (let i=0;i<CORD_SAMPLES;i++) {
    const k = 3*i, prev = Math.max(0,k-3), next = Math.min(path.length-3,k+3);
    const dx = path[next] - path[prev], dy = path[next+1] - path[prev+1];
    const w = i===0||i===CORD_SAMPLES-1 ? 0 : .0042 / Math.max(.001,Math.hypot(dx,dy));
    coords[2*k]=path[k]-dy*w; coords[2*k+3]=path[k]+dy*w;
    coords[2*k+1]=path[k+1]+dx*w; coords[2*k+4]=path[k+1]-dx*w;
    coords[2*k+2]=coords[2*k+5]=path[k+2];
  }
  line.position.needsUpdate = true;
}

function Flight() {
  const rig = useRef<Group>(null), bird = useRef<Group>(null), leftTail = useRef<Group>(null), rightTail = useRef<Group>(null);
  const birdMesh = useMemo(makeSwallow, []), streamer = useMemo(makeStreamer, []), line = useMemo(makeLine, []);
  useLayoutEffect(() => () => { birdMesh.dispose(); streamer.dispose(); line.geometry.dispose(); }, [birdMesh,streamer,line]);
  const s = useMemo(() => ({ anchor: new Vector3(), face: new Vector3(), viewer: new Vector3(), end: new Vector3(),
    horizon:createKiteHorizon(), eyelet: null as Object3D | null, actor: null as Object3D | null, time: 0, lane: 1 }), []);
  useFrame(({scene,camera,gl},delta) => {
    const group = rig.current!, kite = bird.current!, stage = useMmdVrStore.getState(), play = useStagePlay.getState();
    const { active,wind } = useKiteStore.getState(), c = play.character?.toy === 'kite' ? play.character : null;
    const mount = c ? 'wrist' : stage.presentation==='screen' ? 'bench' : 'controller';
    const eyelet = displayedEyelet(scene, mount), live = c && useBackpack.getState().live[c.assetId];
    const actor = live && scene.children.find(o => o.userData.mmdModelId === live.runtimeId);
    const room=stage.prefs.scenery;
    if (!active || !eyelet || (!c && play.held?.toy !== 'kite') || (mount==='bench' && !hasToyStation('kite',room)) ||
        (c && (!live?.visible || !live.wrists?.[c.hand] || !actor?.visible || stage.physicsBusy))) {
      group.visible = false; s.eyelet = null; s.actor = null; return;
    }
    eyelet.getWorldPosition(s.anchor);
    const fresh = s.eyelet !== eyelet || s.actor !== (actor ?? null);
    s.horizon.sample(room,s.anchor,fresh);
    const up=s.horizon.up;
    const unit = actor ? Math.max(.38,Math.min(2.4,(live?.bounds?.size[1] ?? 1.65)/1.65)) : 1;
    if (actor && live) {
      const head = headOf(actor);
      if (head) head.getWorldPosition(s.face).addScaledVector(up,.075*unit);
      else if (live.bounds) s.face.set(...live.bounds.center).addScaledVector(up,.34*live.bounds.size[1]);
      else s.face.set(...live.position).addScaledVector(up,1.46*unit);
    } else s.face.copy(s.anchor).addScaledVector(up,.21);
    if (!Number.isFinite(s.anchor.distanceToSquared(s.face)) || s.anchor.distanceToSquared(s.face) > (3.6*unit)**2) {
      group.visible = false; s.eyelet = null; return;
    }
    const dt = Math.max(0,Math.min(.05,delta)), targetLane = wind === 'left' ? -1 : 1;
    if (fresh) { s.time = 0; s.lane = targetLane; }
    s.eyelet = eyelet; s.actor = actor ?? null; s.time += dt;
    s.lane += (targetLane-s.lane)*(1-Math.exp(-dt*2.8));
    const view = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    const heading = actor ? view.getWorldPosition(s.viewer).sub(s.face) : mount==='bench' ? eyelet.getWorldDirection(s.viewer) :
      fresh ? view.getWorldDirection(s.viewer).negate() : null;
    s.horizon.orient(group.quaternion,heading);
    group.position.copy(s.face); group.scale.setScalar(unit); group.worldToLocal(s.anchor);
    flightPoint(s.end,s.time,s.lane,!actor);
    kite.position.copy(s.end);
    kite.rotation.set(-.16 + .035*Math.sin(s.time*2.3),.12*s.lane + .095*Math.sin(s.time*1.5),-.14*s.lane + .065*Math.sin(s.time*2.1));
    kite.scale.setScalar(.68 + .32*Math.min(1,s.time/1.65));
    leftTail.current!.rotation.z = .11*Math.sin(s.time*4.3);
    rightTail.current!.rotation.z = .13*Math.sin(s.time*4.3+.87);
    drawLine(line,s.anchor,s.end,!!actor); group.visible = true;
  });
  return <group ref={rig} name="kite:flight" visible={false} pointerEvents="none">
    <mesh name="kite:line" geometry={line.geometry} frustumCulled={false} raycast={noPick}><meshBasicMaterial vertexColors side={DoubleSide}/></mesh>
    <group ref={bird} name="kite:swallow">
      <group position-z={-.149}>
        <mesh name="kite:sail" geometry={birdMesh} raycast={noPick}><meshStandardMaterial vertexColors roughness={.94} side={DoubleSide}/></mesh>
        <group ref={leftTail} position={[-.195,-.358,-.023]} scale-x={-1}><mesh geometry={streamer} raycast={noPick}><meshStandardMaterial vertexColors roughness={1} side={DoubleSide}/></mesh></group>
        <group ref={rightTail} position={[.195,-.358,-.023]}><mesh geometry={streamer} raycast={noPick}><meshStandardMaterial vertexColors roughness={1} side={DoubleSide}/></mesh></group>
      </group>
    </group>
  </group>;
}

export function FlyingKite() {
  const active = useKiteStore(s => s.active);
  const owner = useStagePlay(s => s.character?.toy === 'kite' ? `actor:${s.character.assetId}:${s.character.hand}` : s.held?.toy === 'kite' ? `held:${s.held.hand}` : null);
  return active&&owner ? <Flight key={owner}/> : null;
}
