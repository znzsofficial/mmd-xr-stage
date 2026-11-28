import {useLanguageStore} from '../../languageStore';
import {isPortalRoom, mainSceneryIds, SCENERY, type SceneryId} from './catalog';

/** A portal room can be current after a direct link or resume. */
export function SceneryOptions({current}:{current:SceneryId}) {
  const t=useLanguageStore(s=>s.t);
  return <>{isPortalRoom(current)&&<option value={current} hidden disabled>{t(SCENERY[current].label)}</option>}
    {mainSceneryIds.map(id=><option key={id} value={id}>{t(SCENERY[id].label)}</option>)}</>;
}
