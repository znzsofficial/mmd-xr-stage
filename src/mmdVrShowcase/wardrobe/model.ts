import type { SkinnedMesh } from 'three';
import { wardrobeCatalog, type Piece } from './catalog';
import { bindSkinMaps, hasSavedSkins } from './skinMaps';
import { bindSlots, publishGarmentKeys, type ModelDraws } from './slots';

type Slot={weights:number[]; index:number; before:number};
type Override={slots:Slot[]; value:number};
// The page may keep this File in the backpack. Only authored channel keys and
// numbers survive a room/physics rebuild; weight arrays stay on the instance.
const saved=new WeakMap<File,Map<string,number>>();
const registered=new WeakMap<File,Set<number>>();
export function resumeWardrobeModel(mesh:SkinnedMesh,file:File,draws?:ModelDraws){
  return saved.get(file)?.size||registered.get(file)?.size||hasSavedSkins(file)?createWardrobeModel(mesh,file,draws):undefined;
}
export function createWardrobeModel(mesh:SkinnedMesh,file:File,draws?:ModelDraws){
  const bindings=bindSlots(mesh,draws),automatic=wardrobeCatalog(mesh,bindings),pieces:Piece[]=[],skin=bindSkinMaps(file,bindings);
  const overrides=new Map<string,Override>();let applied=false,disposed=false;
  const manual=(key:string)=>bindings.some(s=>s.key===key&&registered.get(file)?.has(s.index));
  function updateList(){
    const custom=bindings.filter(s=>registered.get(file)?.has(s.index)).map(({key,label})=>({key,label,kind:'clothing' as const}));
    pieces.splice(0,pieces.length,...automatic,...custom);publishGarmentKeys(mesh,custom.map(p=>p.key));
  }
  updateList();
  // Wireframe uses the actual displayed/skinned triangles, including MMD's
  // shader path. It changes neither visibility/alpha nor contact evidence.
  let unpreview:(()=>void)|undefined;
  function preview(key:string|null){
    unpreview?.();unpreview=undefined;
    const slot=!disposed&&bindings.find(s=>s.key===key);if(!slot)return;
    const previous=slot.wires.map(m=>m.wireframe);slot.wires.forEach(m=>{m.wireframe=true;});
    unpreview=()=>slot.wires.forEach((m,i)=>{m.wireframe=previous[i];});
  }
  // Keep the current frame's stack intact until the room's next evaluation.
  // In particular, removing a channel while paused must still unwind it.
  const drawn:Override[]=[];
  const slots=(name:string)=>{
    const i=mesh.morphTargetDictionary?.[name],source=mesh.morphTargetInfluences,slots:Slot[]=[];
    if(i==null||!source||!Number.isFinite(source[i]))return slots;
    slots.push({weights:source,index:i,before:0});
    for(const body of (mesh.userData.mmdMorphSplitBodyMeshes??[]) as SkinnedMesh[]){
      const j=body.userData.mmdMorphSplitBody?.morphTargetIndices?.indexOf(i)??-1,w=body.morphTargetInfluences;
      if(w&&j>=0&&Number.isFinite(w[j])&&!slots.some(s=>s.weights===w&&s.index===j))slots.push({weights:w,index:j,before:0});
    }
    return slots;
  };
  const model={file,pieces,slots:bindings,skin,preview,manual,
    register(key:string,on:boolean){
      const s=bindings.find(s=>s.key===key);if(disposed||!s||automatic.some(p=>p.kind!=='morph'&&p.key===key))return false;
      let set=registered.get(file);if(!set)registered.set(file,set=new Set());
      if(on===set.has(s.index))return false;if(on)set.add(s.index);else set.delete(s.index);
      updateList();return true;
    },
    dispose(){disposed=true;preview(null);model.restore();skin.dispose();},
    weight(name:string){return overrides.get(name)?.value??null;},
    evaluated(name:string){const index=mesh.morphTargetDictionary?.[name];return index==null?0:mesh.morphTargetInfluences?.[index]??0;},
    setWeight(name:string,value:number|null){
      if(!pieces.some(p=>p.kind==='morph'&&p.key===name))return false;
      if(value===null){saved.get(file)?.delete(name);return overrides.delete(name);}
      if(!Number.isFinite(value)||value<0||value>1)return false;
      let o=overrides.get(name);if(!o){const targets=slots(name);if(!targets.length)return false;overrides.set(name,o={slots:targets,value});}
      o.value=value;let prefs=saved.get(file);if(!prefs)saved.set(file,prefs=new Map());prefs.set(name,value);return true;
    },
    restore(){if(!applied)return;for(const o of drawn)for(const s of o.slots)s.weights[s.index]=s.before;drawn.length=0;applied=false;},
    present(){if(applied)return;for(const o of overrides.values()){for(const s of o.slots){s.before=s.weights[s.index];s.weights[s.index]=o.value;}drawn.push(o);}applied=drawn.length>0;},
  };
  for(const [key,v] of saved.get(file)??[])model.setWeight(key,v);
  return model;
}
export type WardrobeModel=ReturnType<typeof createWardrobeModel>;
