import { TextureLoader, type Texture } from 'three';
import type { SlotBinding } from './slots';

type Saved={choices:File[];selected:File|null};
const library=new WeakMap<File,Map<number,Saved>>();
export const isSkinImage=(file:File)=>/\.(png|jpe?g|webp)$/i.test(file.name);
export const hasSavedSkins=(actor:File)=>!!library.get(actor)?.size;
async function decode(file:File){
  const url=URL.createObjectURL(file);
  try{return await new TextureLoader().loadAsync(url);}finally{URL.revokeObjectURL(url);}
}
function fitMap(image:Texture,original:Texture){
  // Do not clone a loader texture: Texture.source may be shared with other
  // materials. Keep the new image and adopt the existing UV/sampler contract.
  image.channel=original.channel;image.flipY=original.flipY;image.colorSpace=original.colorSpace;
  image.wrapS=original.wrapS;image.wrapT=original.wrapT;image.magFilter=original.magFilter;image.minFilter=original.minFilter;
  image.anisotropy=original.anisotropy;image.premultiplyAlpha=original.premultiplyAlpha;
  image.generateMipmaps=original.generateMipmaps||!!original.mipmaps?.length;
  image.offset.copy(original.offset);image.repeat.copy(original.repeat);image.center.copy(original.center);image.rotation=original.rotation;
  image.matrixAutoUpdate=original.matrixAutoUpdate;image.matrix.copy(original.matrix);image.needsUpdate=true;
}

/** Only Files/slot indices survive leaving the room. A decode commits all
 * map-bearing draws of one slot together, or leaves the last good image. */
export function bindSkinMaps(actor:File,slots:SlotBinding[],load:(file:File)=>Promise<Texture>=decode){
  const entries=slots.filter(s=>s.textured).map(s=>({slot:s,originals:s.maps.map(m=>m.map!),active:null as File|null,
    texture:null as Texture|null,pending:null as File|null,error:false,epoch:0}));
  const byKey=new Map(entries.map(e=>[e.slot.key,e]));
  const listeners=new Set<()=>void>();let version=0,disposed=false;
  const publish=()=>{version++;for(const fn of listeners)fn();};
  function assign(e:typeof entries[number],next:Texture|null){
    for(const [i,m] of e.slot.maps.entries())m.map=next??e.originals[i];
    const previous=e.texture;e.texture=next;previous?.dispose();
  }
  async function select(key:string,file:File|null,current:()=>boolean=()=>true){
    const e=byKey.get(key);if(disposed||!e||!current()||file&&!isSkinImage(file))return false;
    const epoch=++e.epoch;e.pending=null;e.error=false;
    if(file===null){assign(e,null);e.active=null;const saved=library.get(actor)?.get(e.slot.index);if(saved)saved.selected=null;publish();return true;}
    if(file===e.active){publish();return true;}
    e.pending=file;publish();let next:Texture;
    try{next=await load(file);}catch{
      if(epoch===e.epoch&&!disposed){e.pending=null;e.error=current();publish();}return false;
    }
    if(disposed||epoch!==e.epoch||!current()){
      next.dispose();if(!disposed&&epoch===e.epoch){e.pending=null;publish();}return false;
    }
    fitMap(next,e.originals[0]);assign(e,next);e.active=file;e.pending=null;
    let prefs=library.get(actor);if(!prefs)library.set(actor,prefs=new Map());
    let saved=prefs.get(e.slot.index);if(!saved)prefs.set(e.slot.index,saved={choices:[],selected:null});
    if(!saved.choices.includes(file))saved.choices.push(file);saved.selected=file;publish();return true;
  }
  for(const e of entries){const file=library.get(actor)?.get(e.slot.index)?.selected;if(file)void select(e.slot.key,file);}
  return {
    select, subscribe:(fn:()=>void)=>{listeners.add(fn);return ()=>{listeners.delete(fn);};},snapshot:()=>version,
    status:(key:string)=>{const e=byKey.get(key);return {active:e?.active??null,pending:e?.pending??null,error:e?.error??false,
      choices:e?library.get(actor)?.get(e.slot.index)?.choices??[]:[]};},
    cancel(key:string){const e=byKey.get(key);if(!e?.pending)return;++e.epoch;e.pending=null;e.error=false;publish();},
    dispose(){disposed=true;listeners.clear();for(const e of entries){e.epoch++;if(e.texture)assign(e,null);}},
  };
}
