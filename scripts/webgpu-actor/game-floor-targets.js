// Read the SAME mounted room as the XR pointer. These are coordinates for a
// simulated tracked controller, not intersections or calls into event handlers.
import { _roots } from '@react-three/fiber';
import { useLanguageStore } from '../../src/languageStore';
import { useBackpack } from '../../src/mmdVrShowcase/backpack/store';
import { useMmdVrStore } from '../../src/mmdVrShowcase/mmdVrStore';

export function floorState() {return [..._roots.values()].map(r=>r.store.getState()).find(s=>s.gl.xr.isPresenting);}
function room() {return floorState()?.scene;}

export function find({key, name, row, toy, setting}) {
  const scene = room();
  const root = toy ? scene?.getObjectByName(`play:shelf:${toy}`) : row ? scene?.getObjectByName('hud-backpack')?.getObjectByName(`hud-label:${row}`)?.parent : scene;
  let mesh;
  if(setting){
    const label=`hud:${useLanguageStore.getState().t(setting)} · `;
    root?.traverse(o=>{if(o.name.startsWith(label))mesh=o;});
  }else mesh = root?.getObjectByName(key ? `hud:${useLanguageStore.getState().t(key)}` : name);
  if (!mesh) return null;
  for (let p = mesh; p; p = p.parent) if (!p.visible) return null;
  return mesh.getWorldPosition(mesh.position.clone()).toArray();
}

// Include invisible nodes. A hidden, still-mounted first PMX must not pass a
// swap just because a second model is the only one in the published live map.
export function model(name) {
  const b=useBackpack.getState(), entry=b.entries.find(e=>e.kind==='model' && e.file.name===name);
  if(!entry)throw Error('Expected imported model missing from the backpack');
  const live=b.live[entry.id], layout=b.layouts[useMmdVrStore.getState().prefs.scenery], ids=new Set();
  room()?.traverse(o=>{if(o.userData.mmdModelId)ids.add(o.userData.mmdModelId);});
  return {draft:b.draft===entry.id,selected:b.selected===entry.id,runtime:live?.runtimeId,
    visible:live?.visible,foot:live?.position,mounted:[...ids],
    soleFile:layout?.assets.length===1 && layout.assets[0].modelFile===entry.file && layout.models.length===1 && layout.models[0].file===entry.file};
}
