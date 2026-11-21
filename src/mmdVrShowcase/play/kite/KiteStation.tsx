import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Group, Object3D, Vector3 } from 'three';
import { useBackpack } from '../../backpack';
import { useMmdVrStore } from '../../mmdVrStore';
import { noPick } from '../../scenery/sceneryPaint';
import { MEADOW_SEAT } from '../../scenery/meadowLandmarks';
import { useStagePlay } from '../stagePlay';
import { CORD_SAMPLES, displayedEyelet, EYELET_NAME, flightPoint, headOf, REEL_NAME, registerEyelet, writeCord } from './kiteFlight';
import { GUIDE, makeReel, makeStreamer, makeSwallow } from './kiteModels';
import { setKiteWind, useKiteStore } from './kiteStore';

export function KiteReel() {
  const scene = useThree(s => s.scene), eyelet = useRef<Group>(null);
  const spool = useMemo(makeReel, []);
  useLayoutEffect(() => registerEyelet(scene, eyelet.current!), [scene]);
  useLayoutEffect(() => () => spool.dispose(), [spool]);
  return <group name={REEL_NAME} position={[0,-.042,-.06]} pointerEvents="none">
    <mesh geometry={spool} raycast={noPick}><meshStandardMaterial vertexColors roughness={.83}/></mesh>
    <group ref={eyelet} name={EYELET_NAME} position={GUIDE}/>
  </group>;
}

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
    eyelet: null as Object3D | null, actor: null as Object3D | null, time: 0, lane: 1 }), []);
  useFrame(({scene,camera,gl},delta) => {
    const group = rig.current!, kite = bird.current!, stage = useMmdVrStore.getState(), play = useStagePlay.getState();
    const { active,wind } = useKiteStore.getState(), c = play.character?.toy === 'kite' ? play.character : null;
    const eyelet = displayedEyelet(scene, !!c), live = c && useBackpack.getState().live[c.assetId];
    const actor = live && scene.children.find(o => o.userData.mmdModelId === live.runtimeId);
    if (!active || stage.prefs.scenery !== 'lawn' || !eyelet || (!c && play.held?.toy !== 'kite') ||
        (c && (!live?.visible || !live.wrists?.[c.hand] || !actor?.visible || stage.physicsBusy))) {
      group.visible = false; s.eyelet = null; s.actor = null; return;
    }
    eyelet.getWorldPosition(s.anchor);
    const fresh = s.eyelet !== eyelet || s.actor !== (actor ?? null);
    const unit = actor ? Math.max(.38,Math.min(2.4,(live?.bounds?.size[1] ?? 1.65)/1.65)) : 1;
    if (actor && live) {
      const head = headOf(actor);
      if (head) { head.getWorldPosition(s.face); s.face.y += .075*unit; }
      else if (live.bounds) { s.face.set(...live.bounds.center); s.face.y += .34*live.bounds.size[1]; }
      else { s.face.set(...live.position); s.face.y += 1.46*unit; }
    } else { s.face.copy(s.anchor); s.face.y += .21; }
    if (!Number.isFinite(s.anchor.distanceToSquared(s.face)) || s.anchor.distanceToSquared(s.face) > (3.6*unit)**2) {
      group.visible = false; s.eyelet = null; return;
    }
    const dt = Math.max(0,Math.min(.05,delta)), targetLane = wind === 'left' ? -1 : 1;
    if (fresh) { s.time = 0; s.lane = targetLane; }
    s.eyelet = eyelet; s.actor = actor ?? null; s.time += dt;
    s.lane += (targetLane-s.lane)*(1-Math.exp(-dt*2.8));
    // Frame the shoulder in the viewer's horizontal plane. With a hand-held
    // controller lock the launch heading rather than swinging with head turns.
    if (fresh || actor || stage.presentation === 'screen') {
      const view = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
      if (!actor && gl.xr.isPresenting) { view.getWorldDirection(s.viewer); group.rotation.y = Math.atan2(-s.viewer.x,-s.viewer.z); }
      else { view.getWorldPosition(s.viewer); group.rotation.y = Math.atan2(s.viewer.x-s.face.x,s.viewer.z-s.face.z); }
    }
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

export function KiteStation() {
  const active = useKiteStore(s => s.active);
  const owner = useStagePlay(s => s.character?.toy === 'kite' ? `${s.character.assetId}:${s.character.hand}` : s.held?.toy === 'kite' ? `held:${s.held.hand}` : null);
  // Equip alone (XR shelf or first handoff from the screen) starts a flight.
  // Don't override an explicit simultaneous cue, or relaunch on resetKite().
  useLayoutEffect(() => { if (owner && !useKiteStore.getState().active) setKiteWind('right'); }, [owner]);
  return active && owner ? <Flight key={owner}/> : null;
}

export function MeadowStation() {
  const screen=useMmdVrStore(s=>s.presentation==='screen');
  const held=useStagePlay(s=>s.held?.toy==='kite');
  return <>{screen&&held&&<group name="story:bench-reel" position={[MEADOW_SEAT.x,.53,MEADOW_SEAT.z]} rotation-y={MEADOW_SEAT.yaw} pointerEvents="none"><KiteReel/></group>}<KiteStation/></>;
}
