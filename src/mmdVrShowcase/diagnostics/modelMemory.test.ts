import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, Scene, Texture, type WebGLRenderer } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { clearBackpack, syncBackpackFiles, useBackpack } from '../backpack/store';
import { mountedModelBytePool } from '../mmdRuntime/mountedModelBytes';
import { inspectMountedRoot } from './modelMemoryInventory';
import { observeModelMemory } from './modelMemory';

afterEach(() => {clearBackpack(); vi.restoreAllMocks();});

it('counts proxy draws, overlapping views and image clones by identity without scanning texels or vertices', () => {
  const image = {width:8,height:4}, map = new Texture(image), positions = new Float32Array(48);
  const g = new BufferGeometry().setAttribute('position',new BufferAttribute(positions.subarray(0,24),3));
  g.morphAttributes.position = [new BufferAttribute(positions.subarray(12,36),3), new BufferAttribute(new Float32Array(24),3)];
  const material = new MeshBasicMaterial({map}), root = new Group();
  root.add(new Mesh(g,[material,material]),new Mesh(g,new MeshBasicMaterial({map:map.clone()})));
  expect(inspectMountedRoot(root)).toEqual({geometries:1,positionBackings:2,positionBackingBytes:288,baseMapTextures:2,baseMapImages:1,baseMapPixels:32,truncated:false});
  // One oversized array on one geometry must also terminate, not just a large node tree.
  g.morphAttributes.position = Array(32000).fill(g.attributes.position);
  expect(inspectMountedRoot(root).truncated).toBe(true);
});

function context() {
  const session = Object.assign(new EventTarget(),{visibilityState:'visible'});
  const memory = {textures:1,geometries:2}, scene = new Scene();
  const gl = {info:{memory},xr:{isPresenting:true,getSession:()=>session}} as unknown as WebGLRenderer;
  const trace = () => observeModelMemory(scene,gl,session as unknown as XRSession,0)!;
  return {scene,session,memory,trace};
}

it('captures short real backpack command edges, throttles frame reads, separates scene returns and never exports names', () => {
  const clock = vi.spyOn(performance,'now').mockReturnValue(0);
  const {scene,session,memory,trace} = context();
  const pmx = new File(['1234567'],'private-filename.pmx'); syncBackpackFiles([pmx]);
  const bag = useBackpack.getState, id = bag().entries[0].id;
  const model = new Group(); model.name = 'private-model'; model.userData.mmdModelId = 'private-runtime-id';
  scene.add(model);
  const capture = trace(); capture.frame();
  bag().beginPlace(id); bag().confirmPlace(id,0,0,0);
  const first = mountedModelBytePool.acquire(pmx)!, second = mountedModelBytePool.acquire(pmx)!;
  try {
    clock.mockReturnValue(100); memory.textures=999; capture.frame(); // transient between reads is not a measured peak
    memory.textures=11; clock.mockReturnValue(300); capture.frame();
    bag().finishCommand(bag().command!);
    session.visibilityState='hidden';session.dispatchEvent(new Event('visibilitychange'));
    const hidden = new Group();hidden.userData.stagePropSolid=true; scene.add(hidden);scene.remove(hidden);
    session.visibilityState='visible';session.dispatchEvent(new Event('visibilitychange'));
    first.release();second.release();memory.textures=1;clock.mockReturnValue(700);capture.frame();
    clock.mockReturnValue(1000);capture.frame();
    scene.remove(model);const restored = new Group(); restored.userData.mmdModelId='also-private';scene.add(restored);
    const out=capture.finish();
    scene.add(new Group().copy(restored)); // listener retired with session
    expect(out.mounts.map(m=>m.seen)).toEqual(['entry','add']);
    expect(out.runs.map(r=>[r.phase,r.commandEdge,r.textures,r.pmxSourceReservedBytes,r.reads])).toEqual([
      ['idle',undefined,1,0,1],['place-model','start',1,0,1],['place-model',undefined,11,7,1],
      ['place-model','end',11,7,1],['idle',undefined,1,0,2],
    ]);
    expect(JSON.stringify(out)).not.toMatch(/private|asset-\d|999/);
  } finally {first.release();second.release();}
});

it('retains chronological bounded histories and reports omissions', () => {
  const clock=vi.spyOn(performance,'now'), {scene,memory,trace}=context(), capture=trace();
  const mount=new Group();mount.userData.stagePropSolid=true;
  for(let i=0;i<520;i++){
    clock.mockReturnValue(i*250); memory.textures=i; capture.frame();
    if(i<70){const group=mount.clone();scene.add(group);scene.remove(group);}
  }
  const {runs,runsOmitted,mounts,mountsOmitted}=capture.finish();
  expect(runsOmitted+runs.length).toBe(520);expect(runsOmitted).toBeGreaterThan(0);
  expect(runs[0].textures).toBe(runsOmitted);expect(runs.at(-1)?.textures).toBe(519);
  expect(mountsOmitted+mounts.length).toBe(70);expect(mountsOmitted).toBeGreaterThan(0);
});
