import {useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ActorHudDiagram,ActorScreenDiagram,type DiagramActor,type DiagramSpec} from '../components/ActorDiagram';
import {breastDiagram} from '../bodyState/breast/BreastGraphic';
import {atlasDiagrams,eggReplayDiagram} from '../pelvic/atlas/AtlasGraphic';
import type {EggReplay} from '../bodyState/reproduction/eggReplay';
import {PrivateButton,PrivateLine} from '../pelvic/HudPrivateControls';
import {useLanguageStore} from '../../languageStore';
import type {ObservationPart} from './ActorObservation';

// Mount with the part as key. Model generation happens in the local Worker;
// readiness is its first painted frame, not loading a module or receiving mail.
export function ObservationDiagram({part,widthM,loading,replay,...actor}:DiagramActor&{part:ObservationPart;widthM?:number;loading:string;replay?:EggReplay}){
  const base=useMemo(()=>part==='egg'&&replay?eggReplayDiagram(replay):part==='breast'?breastDiagram:atlasDiagrams[part],[part,replay]);
  return <ObservationPlate {...actor} base={base} widthM={widthM} loading={loading}/>;
}

export function ObservationPlate({base,widthM,loading,...actor}:DiagramActor&{base:DiagramSpec;widthM?:number;loading:string}){
  const [ready,setReady]=useState(false);
  const [close,setClose]=useState(false),zh=useLanguageStore(s=>s.language==='zh');
  const zoomLabel=close?(zh?'全图':'Fit'):(zh?'放大':'Zoom');
  const plate=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const node=plate.current;if(!node)return;
    // The shared diagram already handles the orbit via Pointer Events. Let
    // vertical swipes scroll the phone sheet, but don't turn a finished orbit
    // into a native fling that consumes the next tap (including Back).
    let origin:Touch|null=null,orbit:boolean|undefined;
    const start=(e:TouchEvent)=>{origin=e.target instanceof HTMLCanvasElement&&e.touches.length===1?e.touches[0]:null;orbit=undefined;};
    const move=(e:TouchEvent)=>{const p=e.touches[0];if(!origin||e.touches.length!==1||p.identifier!==origin.identifier)return;
      const dx=Math.abs(p.clientX-origin.clientX),dy=Math.abs(p.clientY-origin.clientY);
      if(orbit===undefined&&Math.max(dx,dy)>=4)orbit=dx>=dy;if(orbit&&e.cancelable)e.preventDefault();};
    const end=(e:TouchEvent)=>{if(orbit&&e.cancelable)e.preventDefault();origin=null;orbit=false;};
    node.addEventListener('touchstart',start,{passive:true});node.addEventListener('touchmove',move,{passive:false});
    node.addEventListener('touchend',end,{passive:false});node.addEventListener('touchcancel',end);
    return ()=>{node.removeEventListener('touchstart',start);node.removeEventListener('touchmove',move);node.removeEventListener('touchend',end);node.removeEventListener('touchcancel',end);};
  },[]);
  const spec=useMemo<DiagramSpec>(()=>({...base,open(canvas,owner,wake,upload){
    let first=true;return base.open(canvas,owner,wake,()=>{upload();if(first){first=false;setReady(true);}});
  }}),[base]);
  if(widthM!==undefined)return <><ActorHudDiagram {...actor} spec={spec} widthM={widthM} interactive zoom={close?1.5:1}/>
    {!ready&&<PrivateLine position={[0,0,.012]} width={widthM*.8} text={loading}/>}
    <PrivateButton position={[widthM/2-.11,.074-widthM*spec.height/spec.width/2,.014]} size={[.21,.135]} active={close} label={zoomLabel} onPress={()=>setClose(v=>!v)}/></>;
  return <div ref={plate} className="observation-art" aria-busy={!ready} data-close={close||undefined}><ActorScreenDiagram {...actor} spec={spec}/>
    <button type="button" className="figure-zoom" onClick={()=>setClose(v=>!v)}>{zoomLabel}</button>
    {!ready&&<span className="observation-loading" role="status">{loading}</span>}</div>;
}
