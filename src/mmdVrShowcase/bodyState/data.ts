/** Page-local fictional character settings. Units are days, simulation seconds,
 * and relative amounts; no wall clock, real volumes or motion-track timing. */
export type BodyProfile = {
  day:number; length:number; bleedDays:number; peakDays:number; lutealDays:number;
  locked:boolean; ovulation:boolean; daySeconds:number;
  liningGain:number; secretionGain:number; liningOverride:number|null; secretionOverride:number|null;
  fullness:number; cycleGain:number; compression:number; rebound:number; morph:string|null;
  sensitivityMode:'off'|'cycle'|'manual'; sensitivity:number;
  lactating:boolean; left:number; right:number; refillSeconds:number;
};
export const BODY_DAY_SECONDS = 120;
export const DEFAULT_BODY_PROFILE: Readonly<BodyProfile> = Object.freeze({
  day:1, length:28, bleedDays:5, peakDays:3, lutealDays:12, locked:true, ovulation:true, daySeconds:0,
  liningGain:1, secretionGain:.65, liningOverride:null, secretionOverride:null,
  fullness:0, cycleGain:.35, compression:1, rebound:.085, morph:null,
  sensitivityMode:'off', sensitivity:.5,
  lactating:false, left:.5, right:.5, refillSeconds:180,
});
type Range = readonly [number,number];
const clamp = (n:number, low:number, high:number) => Math.max(low,Math.min(high,n));
const unit = (n:number) => clamp(n,0,1);
const ranged = (n:number, fallback:number, [min,max]:Range) => clamp(Number.isFinite(n)?n:fallback,min,max);
const smooth = (n:number) => {const t=unit(n); return t*t*(3-2*t);};
const mix = (a:number,b:number,t:number) => a+(b-a)*smooth(t);

export function bodyRanges(p: Pick<BodyProfile,'length'|'bleedDays'|'peakDays'|'ovulation'>) {
  const length = Math.round(ranged(p.length,28,[14,60]));
  const bleedMax=Math.min(12,length-3), bleed=Math.round(ranged(p.bleedDays,5,[1,bleedMax]));
  const peakMax=Math.min(6,length-bleed-2), peak=p.ovulation!==false?Math.round(ranged(p.peakDays,3,[1,peakMax])):0;
  return {day:[1,length], length:[14,60], bleedDays:[1,bleedMax], peakDays:[1,peakMax],
    lutealDays:[1,Math.min(22,length-bleed-peak-1)], compression:[0,1], rebound:[.02,.4], refillSeconds:[15,3600]} as const;
}

export function normalizeBody(p:BodyProfile):BodyProfile {
  const r=bodyRanges(p), d=DEFAULT_BODY_PROFILE;
  const val=(key:'day'|'length'|'bleedDays'|'peakDays'|'lutealDays'|'compression'|'rebound'|'refillSeconds')=>ranged(p[key],d[key],r[key]);
  const gain=(key:'liningGain'|'secretionGain'|'fullness'|'cycleGain'|'sensitivity'|'left'|'right')=>ranged(p[key],d[key],[0,1]);
  const override=(n:number|null)=>typeof n==='number'&&Number.isFinite(n)?unit(n):null;
  return {day:Math.round(val('day')),length:Math.round(val('length')),bleedDays:Math.round(val('bleedDays')),
    peakDays:Math.round(val('peakDays')),lutealDays:Math.round(val('lutealDays')),
    locked:p.locked!==false,ovulation:p.ovulation!==false,daySeconds:ranged(p.daySeconds,0,[0,BODY_DAY_SECONDS-1e-6]),
    liningGain:gain('liningGain'),secretionGain:gain('secretionGain'),liningOverride:override(p.liningOverride),secretionOverride:override(p.secretionOverride),
    fullness:gain('fullness'),cycleGain:gain('cycleGain'),compression:val('compression'),rebound:val('rebound'),morph:typeof p.morph==='string'&&p.morph?p.morph:null,
    sensitivityMode:p.sensitivityMode==='cycle'||p.sensitivityMode==='manual'?p.sensitivityMode:'off',sensitivity:gain('sensitivity'),
    lactating:p.lactating===true,left:gain('left'),right:gain('right'),refillSeconds:val('refillSeconds')};
}

/** Relative shapes for the illustration, not measurements or a fertility model.
 * functionalDepth is the intact envelope ABOVE the persistent basal layer. */
export type EndometrialTissue = { functionalDepth:number; breakdown:number; glandCoil:number; vesselCoil:number };
export type BodySample = { phase:'bleed'|'follicular'|'ovulatory'|'luteal'; tissue:EndometrialTissue; lining:number; shedding:number; secretion:number; fullness:number; sensitivity:number };

// Fixed sites: tracking the SAME tissue across two dates is part of the comparison.
export const ENDOMETRIAL_PATCHES = [
  {center:.18,radius:.105,loss:.98}, {center:.53,radius:.14,loss:1}, {center:.84,radius:.08,loss:.84},
] as const;
export function functionalDepthAt(tissue:EndometrialTissue, u:number) {
  if (!tissue.breakdown) return tissue.functionalDepth;
  let loss=0;
  for (const patch of ENDOMETRIAL_PATCHES) {
    const distance=Math.abs(u-patch.center)/patch.radius;
    loss=Math.max(loss,patch.loss*(1-smooth((distance-.18)/.82)));
  }
  return tissue.functionalDepth*(1-loss*tissue.breakdown);
}

// Shape landmarks [intact functional layer, gland winding, vessel winding].
// Basal gland ends persist; repaired tubes are relatively straight. Secretory
// glands and spiral vessels become tortuous, not merely darker or thicker.
// Anatomy: https://histology.siu.edu/erg/uterus.htm
type TissueShape = readonly [depth:number, gland:number, vessel:number];
const repaired:TissueShape=[.09,.025,.05], grown:TissueShape=[.53,.05,.16],
  peri:TissueShape=[.72,.09,.31], secretory:TissueShape=[.94,.96,.98], lateSecretory:TissueShape=[.82,.74,.80],
  nonOvulatory:TissueShape=[.70,.05,.18];

function sampleTissue(p:BodyProfile, t:number, peak:number, late:number):EndometrialTissue {
  const endShape=p.ovulation?lateSecretory:nonOvulatory;
  let from:TissueShape, to:TissueShape, progress:number, breakdown=0;
  if(t<p.bleedDays){
    from=endShape; to=repaired; progress=t/p.bleedDays;
    breakdown=Math.sin(Math.PI*progress)**2*p.liningGain;
  }else if(!p.ovulation||t<peak){
    from=repaired; to=p.ovulation?grown:nonOvulatory; progress=(t-p.bleedDays)/(peak-p.bleedDays);
  }else if(t<late){
    from=grown; to=peri; progress=(t-peak)/(late-peak);
  }else{
    const m=(t-late)/(p.length-late);
    if(m<.65){from=peri;to=secretory;progress=m/.65;}
    else{from=secretory;to=lateSecretory;progress=(m-.65)/.35;}
  }
  const depth=mix(from[0],to[0],progress);
  return { functionalDepth:p.liningOverride??(.25+(depth-.25)*p.liningGain), breakdown,
    glandCoil:mix(from[1],to[1],progress)*p.liningGain, vesselCoil:mix(from[2],to[2],progress)*p.liningGain };
}

export function sampleBody(p:BodyProfile):BodySample {
  // Day N denotes the start of that day. Labels, tissue and the other envelopes
  // all read the same fractional date, including the instant a new cycle begins.
  const end=p.length, bleed=p.bleedDays, t=p.day-1+p.daySeconds/BODY_DAY_SECONDS;
  const late=p.ovulation?end-p.lutealDays:end, peak=p.ovulation?late-p.peakDays:end;
  const phase=t<bleed?'bleed':!p.ovulation||t<peak?'follicular':t<late?'ovulatory':'luteal';
  const tissue=sampleTissue(p,t,peak,late);
  const peakMid=(peak+late)/2;
  const secretion=!p.ovulation ? .20+.12*Math.sin(Math.PI*t/end)**2
    : t<bleed ? .20 : t<peakMid ? mix(.2,.95,(t-bleed)/(peakMid-bleed)) : mix(.95,.2,(t-peakMid)/(end-peakMid)*1.8);
  // Gentle cyclic characteristics and editable steady baselines are separate.
  const lateWave=p.ovulation&&t>=late?Math.sin(Math.PI*(t-late)/(end-late))**2:0;
  return {phase, tissue, lining:tissue.functionalDepth, shedding:tissue.breakdown,
    secretion:p.secretionOverride??(.2+(secretion-.2)*p.secretionGain),
    fullness:p.fullness+(1-p.fullness)*p.cycleGain*lateWave,
    sensitivity:p.sensitivityMode==='manual'?p.sensitivity:p.sensitivityMode==='cycle'?p.sensitivity*lateWave:0};
}

export function moveDay(p:BodyProfile, days:number):BodyProfile {
  if(!Number.isFinite(days))return p;
  return {...p,day:1+((p.day-1+Math.trunc(days))%p.length+p.length)%p.length};
}

/** Caller supplies elapsed, bounded active-stage simulation only; editing a
 * draft advances that working copy alone so Cancel restores the exact baseline. */
export function advanceBody(p:BodyProfile, seconds:number):BodyProfile {
  if(!(seconds>0) || !Number.isFinite(seconds) || (p.locked&&(!p.lactating||(p.left===1&&p.right===1))))return p;
  const elapsed=p.daySeconds+(p.locked?0:seconds), days=Math.floor(elapsed/BODY_DAY_SECONDS);
  const refill=p.lactating?seconds/p.refillSeconds:0;
  return {...p,day:1+(p.day-1+days)%p.length,daySeconds:elapsed%BODY_DAY_SECONDS,left:unit(p.left+refill),right:unit(p.right+refill)};
}
