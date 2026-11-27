import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { afterEach, expect, it, vi } from 'vitest';
import { createMmdRuntimeHandle } from '../mmdRuntime/mmdRuntime';
import { createStageActors } from './stageActors';

// The same prop contains a line, a point cloud, a skin and an instancing extension.
// Two line nodes share a geometry and a material within each decoded instance.
const json = JSON.stringify({
  asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, 1, 2, 3, 4, 5] }],
  extensionsUsed: ['EXT_mesh_gpu_instancing'],
  nodes: [{ name: 'Rail', mesh: 0 }, { name: 'Rail2', mesh: 0 }, { name: 'Cloud', mesh: 1 },
    { name: 'Skin', mesh: 2, skin: 0 }, { name: 'Joint' },
    { name: 'Instances', mesh: 3, extensions: { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 0 } } } }],
  meshes: [
    { primitives: [{ mode: 1, attributes: { POSITION: 3 } }] },
    { primitives: [{ mode: 0, attributes: { POSITION: 0 } }] },
    { primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] },
    { primitives: [{ attributes: { POSITION: 0 } }] },
  ],
  skins: [{ joints: [4] }],
  accessors: [
    { componentType: 5126, type: 'VEC3', count: 3, min: [0,0,0], max: [0,0,0] },
    { componentType: 5121, type: 'VEC4', count: 3 },
    { componentType: 5126, type: 'VEC4', count: 3 },
    { componentType: 5126, type: 'VEC3', count: 2, min: [0,0,0], max: [0,0,0] },
  ],
});

function room() {
  const scene = new THREE.Scene();
  const actors = createStageActors(scene, createMmdRuntimeHandle(scene), () => false, () => 0);
  const slot = { kind: 'object' as const, objectFile: new File([json], 'mixed.gltf'), companionFiles: [] };
  return { actors, scene, load: (stale = () => false) => actors.restoreTasks([slot], null, stale)[0].run() };
}

function watch(group: THREE.Group, mounted: boolean) {
  const line = group.getObjectByName('Rail') as THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  const duplicate = group.getObjectByName('Rail2') as typeof line;
  const cloud = group.getObjectByName('Cloud') as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  const skin = group.getObjectByName('Skin') as THREE.SkinnedMesh;
  const instances = group.getObjectByName('Instances') as THREE.InstancedMesh;
  expect(duplicate.geometry).toBe(line.geometry);
  expect(duplicate.material).toBe(line.material);
  const resources = { lineGeometry: line.geometry, lineMaterial: line.material, pointGeometry: cloud.geometry,
    pointMaterial: cloud.material, instanceMatrix: instances.instanceMatrix,
    ...(mounted && { palette: skin.skeleton.computeBoneTexture().boneTexture! }) };
  const counts: Record<string, number> = {};
  for (const [key, resource] of Object.entries(resources)) {
    counts[key] = 0;
    resource.addEventListener('dispose', () => counts[key]++);
  }
  return (count: number) => expect(counts).toEqual(Object.fromEntries(Object.keys(counts).map(key => [key, count])));
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('reclaims each imported primitive and palette on put-away and room exit without releasing a neighbour', async () => {
  vi.stubGlobal('ProgressEvent', Event); // Node FileLoader streams the real blob without a browser.
  const { actors, scene, load } = room();
  await load(); await load();
  const [a, b] = [...actors.objects.entries()];
  const removed = watch(a[1].group, true), neighbour = watch(b[1].group, true);
  actors.putAway(a[0]);
  expect(scene.children).toEqual([b[1].group]);
  removed(1); neighbour(0);
  actors.disposeObjects();
  removed(1); neighbour(1);
});

it('also releases a glTF that finishes after its room was retired, without mounting it', async () => {
  const { actors, scene, load } = room();
  const result = await new GLTFLoader().parseAsync(json, '');
  const check = watch(result.scene, false);
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValueOnce(result);
  let retired = false;
  const pending = load(() => retired);
  retired = true;
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(actors.objects.size).toBe(0);
  expect(scene.children).toHaveLength(0);
  check(1);
});

it.each([false,true])('keeps a neighbour usable and only closes owned bitmap sources (global image cache: %s)', async cached => {
  class Bitmap { width=16; height=8; close=vi.fn(() => {this.width=this.height=0;}); }
  vi.stubGlobal('self',globalThis); vi.stubGlobal('ProgressEvent', Event);
  vi.stubGlobal('ImageBitmap', Bitmap); vi.stubGlobal('createImageBitmap', async () => new Bitmap());
  const {actors} = room();
  const data = {asset:{version:'2.0'}, scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0}],
    meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],
    accessors:[{componentType:5126,type:'VEC3',count:3,min:[0,0,0],max:[0,0,0]}],
    materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}},normalTexture:{index:1}}],
    textures:[{sampler:0,source:0},{sampler:1,source:0}],samplers:[{}, {wrapS:33071}],
    images:[{uri:'data:image/png;base64,AA=='}]};
  const slot = {kind:'object' as const, objectFile:new File([JSON.stringify(data)],'item.gltf'),companionFiles:[]};
  const load = () => actors.restoreTasks([slot],null,()=>false)[0].run();
  const previous=THREE.Cache.enabled;
  try {
    THREE.Cache.enabled=cached; await load(); await load(); THREE.Cache.enabled=false;
    const [a,b] = [...actors.objects.entries()];
    const maps = (root:THREE.Group) => (root.children[0] as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material;
    const mat = maps(a[1].group), first = mat.map!.image as Bitmap, second = maps(b[1].group).map!.image as Bitmap;
    expect(mat.normalMap).not.toBe(mat.map); expect(mat.normalMap!.image).toBe(first); expect(second===first).toBe(cached);
    actors.putAway(a[0]); expect(first.close).toHaveBeenCalledTimes(cached?0:1); expect(second.width).toBe(16);
    actors.disposeObjects(); expect(second.close).toHaveBeenCalledTimes(cached?0:1);
  } finally { THREE.Cache.clear(); THREE.Cache.enabled=previous; }
});

it('rejects a prop with a missing texture instead of mounting a white substitute', async () => {
  vi.stubGlobal('self', globalThis); vi.stubGlobal('ProgressEvent', Event);
  vi.stubGlobal('createImageBitmap', vi.fn());
  const { actors, scene } = room();
  const json = { asset:{version:'2.0'}, scenes:[{nodes:[0]}], nodes:[{mesh:0}], meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],
    accessors:[{componentType:5126,type:'VEC3',count:3,min:[0,0,0],max:[0,0,0]}],
    materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}], textures:[{source:0}], images:[{uri:'missing.png'}] };
  const slot = { kind:'object' as const, objectFile:new File([JSON.stringify(json)], 'sign.gltf'), companionFiles:[] };
  vi.spyOn(console, 'error').mockImplementation(() => {}); // GLTFLoader logs and catches its image failure.
  await expect(actors.restoreTasks([slot],null,()=>false)[0].run()).rejects.toThrow('Missing glTF resource: missing.png');
  expect(actors.objects.size).toBe(0); expect(scene.children).toHaveLength(0);
});
