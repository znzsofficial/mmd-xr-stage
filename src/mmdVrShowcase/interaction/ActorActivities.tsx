import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {useLanguageStore} from '../../languageStore';
import {ObservationScreenControls,ObservationHudControls} from '../observation/ActorObservation';
import {PelvicScreenControls,PelvicHudControls} from '../pelvic/Controls';
import {usePelvicToolLifetime} from '../pelvic/usePelvicControls';
import {WardrobeScreenControls,WardrobeHudControls} from '../wardrobe/WardrobeControls';
import {MilkScreenControls,MilkHudControls} from './MilkInteraction';
import {BodyScreenControls,BodyHudControls} from '../bodyState/BodyControls';
import type {ObservationAtlasPart} from '../pelvic/atlas/painter';
import type {ScreenCloseUp} from '../screen/upperBodyView';

export const actorActions=[['insert','actorInsert'],['milk','actorMilk']] as const;
export type ActivityEntry='wardrobe'|'observe'|'body'|typeof actorActions[number][0];
type Props={assetId:string;runtimeId:string;entry:ActivityEntry;onBack:()=>void;closeUp?:ScreenCloseUp;hud?:boolean;webgpu?:boolean;suspended?:boolean;onPeek?:()=>void};

function ScreenPage({page,children}:{page:ActivityEntry;children:ReactNode}){
  const host=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const panel=host.current?.closest<HTMLElement>('.screen-library');if(panel)panel.scrollTop=0;
    const heading=host.current?.querySelector<HTMLElement>('h3,h4');
    if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  },[page]);
  return <div ref={host} data-actor-activity={page}>{children}</div>;
}

/** Clothing and observation can be opened from a running interaction. Back
 * returns to the invoking tool; the mounted room still owns the simulation. */
function ActivityTrail({entry,onBack,closeUp,hud=false,webgpu=false,suspended,onPeek,...actor}:Props){
  usePelvicToolLifetime(actor.assetId,actor.runtimeId,webgpu&&entry==='insert');
  const t=useLanguageStore(s=>s.t),[detail,open]=useState<'wardrobe'|'observe'|null>(null);
  const [part,select]=useState<ObservationAtlasPart>('uterus');
  const page=detail??entry;
  const backLabel=t(detail&&entry==='insert'?'backToInsert':detail&&entry==='milk'?'backToMilk':'actorBack');
  const child={...actor,onBack:detail?()=>open(null):onBack,backLabel};
  const focus=page==='insert'?'face':'body';
  const cameraKey=!hud&&closeUp?{label:t(closeUp.active===focus?'screenReturnView':focus==='face'?'screenFrameFace':'screenCloseUp'),press:()=>closeUp.toggle(focus,actor.assetId,actor.runtimeId)}:undefined;
  let content:ReactNode;
  switch(page){
    case 'wardrobe': {const View=hud?WardrobeHudControls:WardrobeScreenControls;content=<View {...child}/>;break;}
    case 'observe': {const View=hud?ObservationHudControls:ObservationScreenControls;content=<View {...child}/>;break;}
    case 'insert': {const View=hud?PelvicHudControls:PelvicScreenControls;content=<View {...child} webgpu={webgpu} lens={{part,select}} onClothing={()=>open('wardrobe')} cameraKey={cameraKey}/>;break;}
    case 'milk': {const View=hud?MilkHudControls:MilkScreenControls;content=<View {...child} inlineFigure={webgpu} onObserve={()=>open('observe')} onClothing={()=>open('wardrobe')} cameraKey={cameraKey}/>;break;}
    case 'body': content=hud?<BodyHudControls {...child} suspended={suspended} onPeek={onPeek}/>:<BodyScreenControls {...child} suspended={suspended}/>;break;
  }
  return hud?content:<ScreenPage page={page}>{content}</ScreenPage>;
}
export function ActorActivities(props:Props){
  return <ActivityTrail key={JSON.stringify([props.assetId,props.runtimeId,props.entry])} {...props}/>;
}
