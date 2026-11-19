import type {SceneryId} from '../scenery/catalog';
/** These lights were built around the studio/venue centre. */
export const hasStageLamps=(room:SceneryId)=>room==='floor'||room==='liveHouse';
