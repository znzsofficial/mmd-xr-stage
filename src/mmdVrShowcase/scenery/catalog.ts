export const SCENERY = {
  floor: { label: "hudSimpleStage", daylight: false },
  liveHouse: { label: "hudLiveHouse", daylight: false },
  classroom: { label: "hudClassroom", daylight: true },
  pool: { label: "hudPool", daylight: true },
  lawn: { label: "hudLawn", daylight: true },
  astralCourt: { label: "hudAstralCourt", daylight: false },
  chapel: { label: "hudChapel", daylight: true },
  clinic: { label: 'hudClinic', daylight:true },
  qinhuai: { label: 'hudQinhuai', daylight:false },
  weddingCourt: { label: 'hudWeddingCourt', daylight:true },
} as const;
export type SceneryId = keyof typeof SCENERY;
export const sceneryIds = Object.keys(SCENERY) as SceneryId[];
export function resolveScenery(value: unknown, legacyLiveHouse?: boolean): SceneryId {
  return typeof value === "string" && Object.hasOwn(SCENERY, value) ? value as SceneryId : legacyLiveHouse === true ? "liveHouse" : "floor";
}
export function nextScenery(id: SceneryId) { return sceneryIds[(sceneryIds.indexOf(id) + 1) % sceneryIds.length]; }

// The legacy move tool uses this same bound for its visible plane and command
// validation; it still has to pass the room's real floor and obstacle checks.
export function movePlaneHalfWidth(id:SceneryId) {
  if (id==='lawn') return 30;
  if (id==='clinic'||id==='qinhuai'||id==='weddingCourt') return 16;
  return 5.5;
}
export function showSceneryGrid(id: SceneryId, grid: boolean, explicit: boolean, placing: boolean) {
  return grid && (id === "floor" || explicit || placing);
}
