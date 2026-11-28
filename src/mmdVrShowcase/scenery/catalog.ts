export const SCENERY = {
  seasideTerminus: { label: 'hudSeasideTerminus', daylight:true },
  floor: { label: "hudSimpleStage", daylight: false },
  liveHouse: { label: "hudLiveHouse", daylight: false },
  classroom: { label: "hudClassroom", daylight: true },
  pool: { label: "hudPool", daylight: true },
  astralCourt: { label: "hudAstralCourt", daylight: false },
  chapel: { label: "hudChapel", daylight: true },
  clinic: { label: 'hudClinic', daylight:true },
  qinhuai: { label: 'hudQinhuai', daylight:false },
  weddingCourt: { label: 'hudWeddingCourt', daylight:true },
  lanternSuite: { label: 'hudLanternSuite', daylight:false },
  moonSpa: { label: 'hudMoonSpa', daylight:false },
  glassPlanet: { label: 'hudGlassPlanet', daylight:false },
  velvetStudio: { label: 'hudVelvetStudio', daylight:false },
  medievalChamber: { label: 'hudMedievalChamber', daylight:false },
  arcadeHall: { label: 'hudArcadeHall', daylight:true },
} as const;
export type SceneryId = keyof typeof SCENERY;
export const isSceneryId=(value:unknown):value is SceneryId=>typeof value==='string'&&Object.hasOwn(SCENERY,value);
export const sceneryIds = Object.keys(SCENERY) as SceneryId[];
export const portalHall = 'astralCourt';
// These remain real rooms for bookmarks, layout restoration and diagnostics.
export const portalRooms = ['floor','liveHouse','velvetStudio','medievalChamber','lanternSuite','moonSpa'] as const satisfies readonly SceneryId[];
export type PortalRoom = typeof portalRooms[number];
export const isPortalRoom = (id:SceneryId):id is PortalRoom => (portalRooms as readonly SceneryId[]).includes(id);
export const mainSceneryIds:readonly SceneryId[] = [portalHall,'glassPlanet',...sceneryIds.filter(id=>id!==portalHall&&id!=='glassPlanet'&&!isPortalRoom(id))];
export const hasSceneryPeople=(room:SceneryId)=>room==='clinic';

/** A manual room jump must not strand the viewer on a distant terrace.
 * Walked crossings own their translation instead and bypass this policy. */
const entranceRooms:ReadonlySet<SceneryId>=new Set(['clinic','qinhuai','weddingCourt','lanternSuite','moonSpa','glassPlanet','velvetStudio','medievalChamber','arcadeHall','seasideTerminus']);
export function resetViewOnMenuSwitch(from: SceneryId, to: SceneryId) {
  return from !== to && (from === 'astralCourt' || from === 'chapel' || entranceRooms.has(from) || entranceRooms.has(to));
}
export function resolveScenery(value: unknown, legacyLiveHouse?: boolean): SceneryId {
  return isSceneryId(value) ? value : legacyLiveHouse === true ? "liveHouse" : legacyLiveHouse === false ? "floor" : portalHall;
}
export function nextScenery(id: SceneryId) { return mainSceneryIds[(mainSceneryIds.indexOf(id) + 1) % mainSceneryIds.length]; }

export function showSceneryGrid(id: SceneryId, grid: boolean, explicit: boolean) {
  return grid && (id === "floor" || explicit);
}
