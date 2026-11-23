import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {useLanguageStore} from '../../languageStore';
import {HudButton,HudLine,HudSheet} from '../components/PorcelainControls';
import {ObservationScreenControls,ObservationHudControls} from '../observation/ActorObservation';
import {PelvicScreenControls,PelvicHudControls} from '../pelvic/Controls';
import {WardrobeScreenControls,WardrobeHudControls} from '../wardrobe/WardrobeControls';
import {MilkScreenControls,MilkHudControls} from './MilkInteraction';
import {FertilityScreenControls,FertilityHudControls} from './FertilityControls';
import {BodyScreenControls,BodyHudControls} from '../bodyState/BodyControls';
import type {ObservationAtlasPart} from '../pelvic/atlas/painter';

export type ActivityEntry='wardrobe'|'interact'|'observe';
const activities=[['insert','actorInsert'],['milk','actorMilk'],['fertility','actorFertility']] as const;
const settings=[['chest','actorChestShape'],['cycle','actorCycle'],['milkSettings','actorMilkStock']] as const;
type Page=ActivityEntry|typeof activities[number][0]|typeof settings[number][0];
type Props={assetId:string;runtimeId:string;entry:ActivityEntry;onBack:()=>void;onCloseUp?:(focus?:'face')=>void;hud?:boolean;suspended?:boolean;onPeek?:()=>void};

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
function ActivityTrail({entry,onBack,onCloseUp,hud=false,suspended,onPeek,...actor}:Props){
  const t=useLanguageStore(s=>s.t),[trail,setTrail]=useState<readonly Page[]>([entry]);
  const [part,select]=useState<ObservationAtlasPart>('vagina');
  const page=trail[trail.length-1],previous=trail[trail.length-2];
  const go=(next:Page)=>setTrail(old=>{const at=old.indexOf(next);return at<0?[...old,next]:old.slice(0,at+1);});
  const back=()=>{if(!previous)onBack();else setTrail(old=>old.slice(0,-1));};
  const backLabel=t(previous==='fertility'?'backToFertility':previous==='insert'?'backToInsert':previous==='milk'?'backToMilk':previous==='interact'?'backToInteraction':'actorBack');
  const child={...actor,onBack:back,backLabel};
  let content:ReactNode;
  switch(page){
    case 'wardrobe': {const View=hud?WardrobeHudControls:WardrobeScreenControls;content=<View {...child}/>;break;}
    case 'observe': {const View=hud?ObservationHudControls:ObservationScreenControls;content=<View {...child}/>;break;}
    case 'insert': {const View=hud?PelvicHudControls:PelvicScreenControls;content=<View {...child} lens={{part,select}} onFertility={()=>go('fertility')} onClothing={()=>go('wardrobe')} onFace={onCloseUp&&(()=>onCloseUp('face'))}/>;break;}
    case 'fertility': {const View=hud?FertilityHudControls:FertilityScreenControls;content=<View {...child} onInsertion={previous==='insert'?undefined:()=>{select('uterus');go('insert');}}/>;break;}
    case 'milk': {const View=hud?MilkHudControls:MilkScreenControls;content=<View {...child} onObserve={()=>go('observe')} onClothing={()=>go('wardrobe')} onCloseUp={onCloseUp}/>;break;}
    case 'chest':case 'cycle':case 'milkSettings': {
      const initialSection=page==='milkSettings'?'milk':page;
      content=hud?<BodyHudControls {...child} initialSection={initialSection} suspended={suspended} onPeek={onPeek}/>:
        <BodyScreenControls {...child} initialSection={initialSection} suspended={suspended}/>;break;
    }
    case 'interact': content=hud?<group name="actor:interaction">
      <HudSheet size={[1.55,.90]}/><HudLine position={[-.30,.32,0]} width={.86} role="title" text={t('actorInteraction')}/>
      <HudButton position={[.49,.32,0]} size={[.47,.14]} variant="quiet" label={backLabel} onPress={back}/>
      {activities.map(([to,key],i)=><HudButton key={to} position={[(i-1)*.49,.105,0]} size={[.46,.16]} label={t(key)} onPress={()=>go(to)}/>)}
      <HudLine position={[0,-.13,0]} width={1.44} role="title" text={t('actorBodyState')}/>
      {settings.map(([to,key],i)=><HudButton key={to} position={[(i-1)*.49,-.32,0]} size={[.46,.145]} variant="quiet" label={t(key)} onPress={()=>go(to)}/>)}
    </group>:<div className="screen-activity-choices"><div className="screen-library-head"><h3>{t('actorInteraction')}</h3><button onClick={back}>{backLabel}</button></div>
      <div className="activity-links">{activities.map(([to,key])=><button key={to} onClick={()=>go(to)}>{t(key)}</button>)}</div>
      <section><h4>{t('actorBodyState')}</h4><div className="activity-links">{settings.map(([to,key])=><button key={to} onClick={()=>go(to)}>{t(key)}</button>)}</div></section></div>;
  }
  return hud?content:<ScreenPage page={page}>{content}</ScreenPage>;
}
export function ActorActivities(props:Props){
  return <ActivityTrail key={JSON.stringify([props.assetId,props.runtimeId,props.entry])} {...props}/>;
}
