import type { PelvicCalibration, PelvicXYZ } from './contract';

export const PELVIC_LIMITS = {
  offsetM:[-.5,.5], pitchDeg:[-90,90], yawDeg:[-180,180], radiusM:[.008,.08], lengthM:[.035,.20],
  unitsPerMeter:[.01,10000], speedHz:[.1,2], stroke:[.05,1], position:[-.2,1], capacity:[1,100], dose:1,
} as const;

/** Relative game units, not physiological measurements. Each bottle has its own
 * balance and capacity. Switching the section being simulated never moves liquid. */
export type PelvicContainer = 'vaginal'|'fantasyUterine';
export type PelvicMode = 'xrManual'|'standManual'|'standAuto';
export type PelvicProfile = {
  calibration:PelvicCalibration; clothingClear:boolean; container:PelvicContainer;
  apertureMorph?:string|null; showAdapter:boolean;
  fluid:Record<PelvicContainer,number>; capacity:Record<PelvicContainer,number>;
  overflow:number; drained:number; speedHz:number; stroke:number;
};
export type PelvicPatch = Partial<Pick<PelvicProfile,'clothingClear'|'container'|'speedHz'|'stroke'|'showAdapter'>> & {
  calibration?:Partial<PelvicCalibration>;
};
export type PelvicActive = {
  assetId:string; runtimeId:string; mode:PelvicMode; source:'screen'|'xr';
  token:number; running:boolean; awaitingWorld:boolean; position:number;
};
/** UI evidence in calibrated local WORLD metres; +Z outward. Null sample means
 * no current geometry, never a nozzle implied by a slider or a saved depth. */
export type PelvicSample = {
  depth:number; outletInside:boolean; outletVisible?:boolean; aligned:boolean; atCervix:boolean;
  tip:PelvicXYZ; tail:PelvicXYZ; shaft?:readonly PelvicXYZ[]; angleDeg:number; radiusM:number; lengthM:number;
};
export type PelvicSupport = {
  runtimeId:string; kind:'bones'|'manual'|'missing'; anchorName:string;
  obstruction?:'garment'|'unverified'; manualSeed?:NonNullable<PelvicCalibration['manual']>;
};
