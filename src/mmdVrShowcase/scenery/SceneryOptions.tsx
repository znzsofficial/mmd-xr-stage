import {useLanguageStore} from '../../languageStore';
import {mainSceneryIds, SCENERY, type SceneryId} from './catalog';

/** Preserve the displayed room on a direct link / resume without offering
 * the room as a destination in the open menu. */
export function SceneryOptions({current}:{current:SceneryId}) {
  const t=useLanguageStore(s=>s.t);
  return <>{!mainSceneryIds.includes(current)&&<option value={current} hidden disabled>{t(SCENERY[current].label)}</option>}
    {mainSceneryIds.map(id=><option key={id} value={id}>{t(SCENERY[id].label)}</option>)}</>;
}
