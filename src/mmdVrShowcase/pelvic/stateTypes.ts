import type { PelvicCalibration, PelvicXYZ } from './contract';
import type {RailTechnique} from './railTechnique';
import type {RimMode} from './vulvaForm';

export const PELVIC_LIMITS = {
  offsetM:[-.5,.5], pitchDeg:[-90,90], yawDeg:[-180,180], radiusM:[.008,.08], lengthM:[.035,.20],
  unitsPerMeter:[.01,10000], speedHz:[.1,2], stroke:[.05,1], position:[-.2,1], replayRate:[.5,2], capacity:[1,100], dose:1,
} as const;

/** Relative game units, not physiological measurements. Each bottle has its own
 * balance and capacity. Switching the section being simulated never moves liquid. */
export type PelvicContainer = 'vaginal'|'fantasyUterine';
export type PelvicDoseTarget = PelvicContainer|'external';
export type PelvicMode = 'xrManual'|'standManual'|'standAuto';
export type PelvicProfile = {
  /** A clothed session never confirms a visibly exposed opening. Both choices
   * belong to this fit and are cleared when its calibration changes. */
  calibration:PelvicCalibration; clothingClear:boolean; clothed?:boolean; container:PelvicContainer;
  apertureMorph?:string|null; showAdapter:boolean;
  /** The player fitted the optional mesh to underlying skin. This is not
   * evidence that the rod's exterior outlet is exposed. */
  adapterSkinFit?:boolean;
  /** A chosen game event, local to this backpack actor. No medical meaning. */
  rimMode?:RimMode; rimMemory?:'left'|'right'|'center';
  /** Auto from the mounted face by default; null turns actor response off. */
  responseMorph?:string|null;
  fluid:Record<PelvicContainer,number>; capacity:Record<PelvicContainer,number>;
  overflow:number; drained:number; speedHz:number; stroke:number;
  technique?:RailTechnique; replayRate?:number; replayLoop?:boolean;
};
export type PelvicPatch = Partial<Pick<PelvicProfile,'clothingClear'|'clothed'|'container'|'speedHz'|'stroke'|'showAdapter'|'replayRate'|'replayLoop'|'rimMode'>> & {
  calibration?:Partial<PelvicCalibration>;
};
export type PelvicActive = {
  assetId:string; runtimeId:string; mode:PelvicMode; source:'screen'|'xr';
  token:number; running:boolean; awaitingWorld:boolean; position:number;
  take?:{kind:'record';seconds:number;canSave:boolean}|{kind:'replay'};
};
/** UI evidence in calibrated local WORLD metres; +Z outward. Null sample means
 * no current geometry, never a nozzle implied by a slider or a saved depth. */
export type PelvicSample = {
  depth:number; outletInside:boolean; outletVisible?:boolean; exteriorCovered?:boolean; aligned:boolean; atCervix:boolean;
  tip:PelvicXYZ; tail:PelvicXYZ; shaft?:readonly PelvicXYZ[]; angleDeg:number; radiusM:number; lengthM:number;
  /** A measured, fully retracted stand, not the slider target or an admission flag. */
  railHome?:boolean;
};
export type PelvicSupport = {
  runtimeId:string; kind:'bones'|'manual'|'missing'; anchorName:string;
  obstruction?:'garment'|'unverified'; manualSeed?:NonNullable<PelvicCalibration['manual']>;
  /** Named garment layers on this drawable; blockerName requires a current triangle hit. */
  garmentNames?:readonly string[]; blockerName?:string;
  responseMorphs?:readonly string[];
};

export const canDrawAdapter=(p:PelvicProfile,s:PelvicSupport)=>p.showAdapter&&
  !!(p.clothingClear||p.adapterSkinFit)&&s.kind!=='missing'&&s.obstruction!=='unverified';

export function canStartAtOpening(p:PelvicProfile,s:PelvicSupport|undefined){
  return !!s&&s.kind!=='missing'&&(!!p.clothed||p.clothingClear&&!s.obstruction);
}
