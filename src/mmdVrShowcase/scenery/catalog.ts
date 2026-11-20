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
  lanternSuite: { label: 'hudLanternSuite', daylight:false },
  moonSpa: { label: 'hudMoonSpa', daylight:false },
} as const;
export type SceneryId = keyof typeof SCENERY;
export const sceneryIds = Object.keys(SCENERY) as SceneryId[];
export const hasSceneryPeople=(room:SceneryId)=>room==='clinic';

/** A manual room jump must not strand the viewer on a distant terrace.
 * Walked crossings own their translation instead and bypass this policy. */
export function resetViewOnMenuSwitch(from: SceneryId, to: SceneryId) {
  const hasEntryPose = (id: SceneryId) => id === 'clinic' || id === 'qinhuai' || id === 'weddingCourt' || id === 'lanternSuite' || id === 'moonSpa';
  return from !== to && (from === 'astralCourt' || from === 'chapel' || hasEntryPose(from) || hasEntryPose(to));
}
export function resolveScenery(value: unknown, legacyLiveHouse?: boolean): SceneryId {
  return typeof value === "string" && Object.hasOwn(SCENERY, value) ? value as SceneryId : legacyLiveHouse === true ? "liveHouse" : "floor";
}
export function nextScenery(id: SceneryId) { return sceneryIds[(sceneryIds.indexOf(id) + 1) % sceneryIds.length]; }

export function showSceneryGrid(id: SceneryId, grid: boolean, explicit: boolean) {
  return grid && (id === "floor" || explicit);
}
