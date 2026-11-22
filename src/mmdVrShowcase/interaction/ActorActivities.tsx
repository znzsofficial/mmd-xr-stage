import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {useLanguageStore} from '../../languageStore';
import {HudButton,HudLine,HudSheet} from '../components/PorcelainControls';
import {ObservationScreenControls,ObservationHudControls} from '../observation/ActorObservation';
import {PelvicScreenControls,PelvicHudControls} from '../pelvic/Controls';
import {WardrobeScreenControls,WardrobeHudControls} from '../wardrobe/WardrobeControls';
import {MilkScreenControls,MilkHudControls} from './MilkInteraction';

export type ActivityEntry='wardrobe'|'interact'|'observe';
type Page=ActivityEntry|'insert'|'milk';
type Props={assetId:string;runtimeId:string;entry:ActivityEntry;onBack:()=>void;onCloseUp?:(focus?:'face')=>void;hud?:boolean};

function ScreenPage({page,children}:{page:Page;children:ReactNode}){
  const host=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const panel=host.current?.closest<HTMLElement>('.screen-library');if(panel)panel.scrollTop=0;
    // A button in the previous sheet has been removed. Keep keyboard users
    // in this sheet, not at the start of the stage's dialog.
    const heading=host.current?.querySelector<HTMLElement>('h3,h4');
    if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}
  },[page]);
  return <div ref={host} data-actor-activity={page}>{children}</div>;
}

/** A short actor-local trail. Returning from clothing or a diagram goes back
 * to the initiating interaction; the mounted room still owns its simulation. */
function ActivityTrail({entry,onBack,onCloseUp,hud=false,...actor}:Props){
  const t=useLanguageStore(s=>s.t),[trail,setTrail]=useState<readonly Page[]>([entry]);
  const page=trail[trail.length-1],previous=trail[trail.length-2];
  const go=(next:Page)=>setTrail(old=>old.at(-1)===next?old:[...old,next]);
  const back=()=>{if(!previous)onBack();else setTrail(old=>old.slice(0,-1));};
  const backLabel=t(previous==='insert'?'backToInsert':previous==='milk'?'backToMilk':previous==='interact'?'backToInteraction':'actorBack');
  const child={...actor,onBack:back,backLabel};
  let content:ReactNode;
  switch(page){
    case 'wardrobe': {const View=hud?WardrobeHudControls:WardrobeScreenControls;content=<View {...child}/>;break;}
    case 'observe': {const View=hud?ObservationHudControls:ObservationScreenControls;content=<View {...child}/>;break;}
    case 'insert': {const View=hud?PelvicHudControls:PelvicScreenControls;content=<View {...child} onClothing={()=>go('wardrobe')} onFace={onCloseUp&&(()=>onCloseUp('face'))}/>;break;}
    case 'milk': {const View=hud?MilkHudControls:MilkScreenControls;content=<View {...child} onObserve={()=>go('observe')} onClothing={()=>go('wardrobe')} onCloseUp={onCloseUp}/>;break;}
    case 'interact': content=hud?<group name="actor:interaction">
      <HudSheet size={[1.45,.49]}/><HudLine position={[-.27,.12,0]} width={.79} role="title" text={t('actorInteraction')}/>
      <HudButton position={[.46,.12,0]} size={[.43,.14]} variant="quiet" label={backLabel} onPress={back}/>
      <HudButton position={[-.35,-.09,0]} size={[.65,.16]} label={t('actorInsert')} onPress={()=>go('insert')}/>
      <HudButton position={[.35,-.09,0]} size={[.65,.16]} label={t('actorMilk')} onPress={()=>go('milk')}/>
    </group>:<div className="screen-activity-choices"><div className="screen-library-head"><h3>{t('actorInteraction')}</h3><button onClick={back}>{backLabel}</button></div>
      <div className="screen-actor-primary"><button onClick={()=>go('insert')}>{t('actorInsert')}</button><button onClick={()=>go('milk')}>{t('actorMilk')}</button></div></div>;
  }
  return hud?content:<ScreenPage page={page}>{content}</ScreenPage>;
}
export function ActorActivities(props:Props){
  return <ActivityTrail key={JSON.stringify([props.assetId,props.runtimeId,props.entry])} {...props}/>;
}
