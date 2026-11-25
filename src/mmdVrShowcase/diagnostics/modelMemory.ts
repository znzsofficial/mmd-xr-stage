import type { Object3D, Scene, WebGLRenderer } from 'three';
import { useBackpack } from '../backpack/store';
import { mountedModelBytePool } from '../mmdRuntime/mountedModelBytes';
import { useMmdVrStore } from '../mmdVrStore';
import type { SceneryId } from '../scenery/catalog';
import { inspectMountedRoot } from './modelMemoryInventory';

const FRAME_PERIOD_MS = 250, MAX_RUNS = 512, MAX_MOUNTS = 64;
type Kind = 'model' | 'object';
type Phase = 'idle' | 'restore' | 'physics-switch' | 'place-model' | 'place-object' | 'move' | 'remove' | 'motion';
type Bag = ReturnType<typeof useBackpack.getState>;
function commandPhase(bag: Bag): Phase | undefined {
  const command = bag.command;
  if (!command) return;
  if (command.type !== 'place') return command.type;
  if (command.moveRuntimeId != null) return 'move';
  return bag.placement?.kind === 'object' ? 'place-object' : 'place-model';
}
type Reading = { scenery:SceneryId; phase:Phase; models:number; objects:number; textures:number; geometries:number; pmxSourceReservedBytes:number };
type Run = Reading & { firstWallMs:number; lastWallMs:number; reads:number; commandEdge?:'start'|'end' };
type Mount = { wallMs:number; scenery:SceneryId; kind:Kind; seen:'entry'|'add'; scanWallMs:number; resources:ReturnType<typeof inspectMountedRoot> };

/** Session-local, from the first visible XR frame. No GL interception, file
 * identifiers, resource references in rows, or timers surviving the renderer. */
export function observeModelMemory(scene: Scene, gl: WebGLRenderer, session: XRSession, wallStart: number) {
  if (!gl.info?.memory) return;
  const runs:Run[] = [], mounts:Mount[] = [];
  let runsOmitted = 0, mountsOmitted = 0, nextRead = -Infinity, gap = true;
  const visible = () => gl.xr.getSession() === session && gl.xr.isPresenting && (!session.visibilityState || session.visibilityState === 'visible');
  const now = () => Math.round(performance.now() - wallStart);
  function read(at:number, phase?:Phase, edge?:Run['commandEdge']) {
    const state = useMmdVrStore.getState(), scenery = state.prefs.scenery;
    phase ??= commandPhase(useBackpack.getState()) ?? (state.assetLoad.running ? 'restore' : state.physicsBusy ? 'physics-switch' : 'idle');
    const models = state.models.length, objects = state.objects.length, {textures,geometries} = gl.info.memory;
    const pmxSourceReservedBytes = mountedModelBytePool.reservedBytes;
    const last = runs.at(-1);
    if (!gap && !edge && last && !last.commandEdge && last.scenery === scenery && last.phase === phase && last.models === models &&
      last.objects === objects && last.textures === textures && last.geometries === geometries && last.pmxSourceReservedBytes === pmxSourceReservedBytes) {
      last.lastWallMs = at; last.reads++;
    } else {
      if (runs.length === MAX_RUNS) { runs.shift(); runsOmitted++; }
      runs.push({firstWallMs:at,lastWallMs:at,reads:1,scenery,phase,models,objects,textures,geometries,pmxSourceReservedBytes,...(edge && {commandEdge:edge})});
    }
    gap = false;
  }
  const observed = new WeakSet<Object3D>();
  function mount(root:Object3D, seen:Mount['seen']) {
    const kind = root.userData.stagePropSolid === true ? 'object' : typeof root.userData.mmdModelId === 'string' ? 'model' : null;
    if (!kind || !visible() || observed.has(root)) return;
    observed.add(root);
    if (mounts.length === MAX_MOUNTS) { mounts.shift(); mountsOmitted++; }
    const start = performance.now(), resources = inspectMountedRoot(root);
    mounts.push({wallMs:Math.round(start-wallStart),scenery:useMmdVrStore.getState().prefs.scenery,kind,seen,
      scanWallMs:performance.now()-start, resources});
  }
  const added = ({child}:{child:Object3D}) => mount(child,'add');
  scene.addEventListener('childadded',added);
  // A resumed layout may already be mounted before the first visible frame.
  const maxInitialRoots = 256, entryScanTruncated = scene.children.length > maxInitialRoots;
  for (let i=0; i < Math.min(scene.children.length,maxInitialRoots); i++) mount(scene.children[i],'entry');
  const stopBag = useBackpack.subscribe((bag,old) => {
    if (bag.command === old.command || !visible()) return;
    const at = now();
    if (old.command) read(at,commandPhase(old),'end'); // cancellation/failure also ends a command
    if (bag.command) read(at,commandPhase(bag),'start');
  });
  const interrupt = () => { gap = true; nextRead = -Infinity; };
  session.addEventListener('visibilitychange',interrupt);
  return {
    frame() { const at = now(); if (at < nextRead) return; nextRead = at + FRAME_PERIOD_MS; read(at); },
    interrupt,
    finish() {
      stopBag(); scene.removeEventListener('childadded',added); session.removeEventListener('visibilitychange',interrupt);
      return { framePeriodMs:FRAME_PERIOD_MS, runsOmitted, runs, mountsOmitted, mounts, entryScanTruncated };
    },
  };
}
export type ModelMemoryTrace = ReturnType<NonNullable<ReturnType<typeof observeModelMemory>>['finish']>;
