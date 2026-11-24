import {useCallback,useEffect,useState} from 'react';
import {useBackpack} from '../backpack/store';
import {useBodyState} from '../bodyState/store';
import {useMmdVrStore} from '../mmdVrStore';
import type {SceneryId} from '../scenery/catalog';

type Item = {asset:string; runtime:string; room:SceneryId; visit:number};
type Panels = {view:'backpack'|'item'|null; item:Item|null};

/** Selection also exists while browsing the bag. Only a pick or a successful
 * placement opens tools; a body draft can retain its own mounted editor. */
export function useScreenPanels(){
  const [panels,setPanels]=useState<Panels>({view:null,item:null});
  const selected=useBackpack(s=>s.selected),runtime=useBackpack(s=>s.selected&&s.live[s.selected]?.runtimeId);
  const room=useMmdVrStore(s=>s.prefs.scenery),draftAsset=useBodyState(s=>s.draft?.assetId??null);
  const {item,view}=panels,current=item?.room===room&&item.asset===selected&&item.runtime===runtime;
  const suspended=!!current&&!!draftAsset&&draftAsset===selected&&view!=='item';
  const showItem=useCallback((fromPlacement=false)=>{
    const bag=useBackpack.getState(),asset=bag.selected,runtime=asset&&bag.live[asset]?.runtimeId;
    if(!asset||!runtime)return;
    const room=useMmdVrStore.getState().prefs.scenery,draft=useBodyState.getState().draft?.assetId;
    setPanels(previous=>{
      // The user may have opened the full bag while a large PMX was loading.
      if(fromPlacement&&previous.view==='backpack')return previous;
      const old=previous.item,keep=draft===asset&&old?.asset===asset&&old.runtime===runtime&&old.room===room;
      return {view:'item',item:keep?old:{asset,runtime,room,visit:(old?.visit??0)+1}};
    });
  },[]);
  useEffect(()=>useBackpack.subscribe((b,prev)=>{
    if(prev.command?.type==='place'&&!b.command&&b.lastCompletedPlacement?.token===prev.command.token)showItem(true);
  }),[showItem]);
  return {visible:view!==null,bag:view==='backpack'||(view==='item'&&!current),suspended,visit:item?.visit??0,openItem:()=>showItem(),
    openBackpack:()=>setPanels(p=>({...p,view:'backpack'})), close:()=>setPanels(p=>({...p,view:null}))};
}
