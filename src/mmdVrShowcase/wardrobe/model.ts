import type { SkinnedMesh } from 'three';
import { wardrobeCatalog } from './catalog';

type Slot={weights:number[]; index:number; before:number};
type Override={slots:Slot[]; value:number};
// The page may keep this File in the backpack. Only authored channel keys and
// numbers survive a room/physics rebuild; weight arrays stay on the instance.
const saved=new WeakMap<File,Map<string,number>>();
export function resumeWardrobeModel(mesh:SkinnedMesh,file:File){
  return saved.get(file)?.size?createWardrobeModel(mesh,file):undefined;
}
export function createWardrobeModel(mesh:SkinnedMesh,file:File){
  const pieces=wardrobeCatalog(mesh),overrides=new Map<string,Override>();let applied=false;
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
  const model={pieces,
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
