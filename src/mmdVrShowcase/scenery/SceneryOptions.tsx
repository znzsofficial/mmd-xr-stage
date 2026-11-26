import {useLanguageStore} from '../../languageStore';
import {isPortalRoom, mainSceneryIds, SCENERY, type SceneryId} from './catalog';

/** Preserve the displayed room on a direct link / resume without offering
 * the room as a destination in the open menu. */
export function SceneryOptions({current,offerFloor=false}:{current:SceneryId;offerFloor?:boolean}) {
  const t=useLanguageStore(s=>s.t);
  return <>{offerFloor&&<option value="floor">{t(SCENERY.floor.label)}</option>}
    {isPortalRoom(current)&&!(offerFloor&&current==='floor')&&<option value={current} hidden disabled>{t(SCENERY[current].label)}</option>}
    {mainSceneryIds.map(id=><option key={id} value={id}>{t(SCENERY[id].label)}</option>)}</>;
}
