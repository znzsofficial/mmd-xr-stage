import {useEffect,useRef,useState} from 'react';
import type { FloorSession, LoadFloorBackend, StartFloorSession } from '../xr/floorBackend';

/** Preload only for the selected WebGPU floor. Never await an import between the
 * user's click and requestSession. A failed session returns to this same prep
 * page; the original WebGL launch buttons can then use the retained files. */
export function useFloorBackend(load?:LoadFloorBackend) {
  const [start,setStart]=useState<StartFloorSession>(),[failed,setFailed]=useState<string|null>(null);
  const current=useRef<FloorSession|null>(null), [phase,setPhase]=useState<string|null>(null);
  useEffect(()=>{
    if(!load)return;
    let retired=false;
    load().then(fn=>{if(!retired)setStart(()=>fn);},err=>{if(!retired)setFailed(String(err));});
    return ()=>{retired=true; const host=current.current; current.current=null;host?.stop();};
  },[load]);
  function enter(resume:boolean){
    if(!start||current.current||failed)return;
    try {
      let host:FloorSession|undefined;
      host=start({resume,onStatus:()=>{if(host && current.current===host)setPhase(host.status.phase);}});
      current.current=host;setPhase(host.status.phase);
      const finish=(err?:unknown)=>{
        if(!host||current.current!==host)return;
        current.current=null;setPhase(null);
        const message=host.status.error??(err==null?null:String(err));if(message)setFailed(message);
      };
      void host.done.then(()=>finish(),finish);
    } catch(error){setFailed(String(error));setPhase(null);}
  }
  return {enabled:!!load&&!failed,loading:!!load&&!failed&&!start,phase,failed,enter,stop:()=>current.current?.stop()};
}
