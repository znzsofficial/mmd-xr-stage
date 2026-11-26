import {useLanguageStore} from '../../languageStore';
import {isPortalRoom, mainSceneryIds, portalRooms,SCENERY, type SceneryId} from './catalog';

/** Preserve the displayed room on a direct link / resume without offering
 * the room as a destination in the open menu. */
export function SceneryOptions({current,offerPortals=false}:{current:SceneryId;offerPortals?:boolean}) {
  const t=useLanguageStore(s=>s.t);
  return <>{offerPortals&&portalRooms.map(id=><option value={id} key={id}>{t(SCENERY[id].label)}</option>)}
    {isPortalRoom(current)&&!offerPortals&&<option value={current} hidden disabled>{t(SCENERY[current].label)}</option>}
    {mainSceneryIds.map(id=><option key={id} value={id}>{t(SCENERY[id].label)}</option>)}</>;
}
