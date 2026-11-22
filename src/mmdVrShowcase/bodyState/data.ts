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
  const peakMax=Math.min(6,length-bleed-2), peak=p.ovulation?Math.round(ranged(p.peakDays,3,[1,peakMax])):0;
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

export type BodySample = { phase:'bleed'|'follicular'|'ovulatory'|'luteal'; lining:number; shedding:number; secretion:number; fullness:number; sensitivity:number };
export function sampleBody(p:BodyProfile):BodySample {
  // A whole-day preview samples the middle of that day rather than the exact
  // instant bleeding begins. The envelope remains continuous across day 1.
  const end=p.length, bleed=p.bleedDays,day=p.day-1+p.daySeconds/BODY_DAY_SECONDS,t=(day+.5)%end;
  const late=p.ovulation?end-p.lutealDays:end, peak=p.ovulation?late-p.peakDays:end;
  const phase=day<bleed?'bleed':day<peak?'follicular':day<late?'ovulatory':'luteal';
  const lining=t<bleed?mix(.88,.12,t/bleed):mix(.12,.88,(t-bleed)/(end-bleed)*1.25);
  const peakMid=(peak+late)/2;
  const secretion=!p.ovulation ? .20+.12*Math.sin(Math.PI*t/end)**2
    : t<bleed ? .20 : t<peakMid ? mix(.2,.95,(t-bleed)/(peakMid-bleed)) : mix(.95,.2,(t-peakMid)/(end-peakMid)*1.8);
  // Gentle cyclic characteristics and editable steady baselines are separate.
  const lateWave=p.ovulation&&t>=late?Math.sin(Math.PI*(t-late)/(end-late))**2:0;
  return {phase, lining:p.liningOverride??(.25+(lining-.25)*p.liningGain),
    shedding:t<bleed?Math.sin(Math.PI*t/bleed)*p.liningGain:0,
    secretion:p.secretionOverride??(.2+(secretion-.2)*p.secretionGain),
    fullness:p.fullness+(1-p.fullness)*p.cycleGain*lateWave,
    sensitivity:p.sensitivityMode==='manual'?p.sensitivity:p.sensitivityMode==='cycle'?p.sensitivity*lateWave:0};
}

export function moveDay(p:BodyProfile, days:number):BodyProfile {
  if(!Number.isFinite(days))return p;
  return {...p,day:1+((p.day-1+Math.trunc(days))%p.length+p.length)%p.length,daySeconds:0};
}

/** Caller supplies elapsed, bounded active-stage simulation only; editing a
 * draft advances that working copy alone so Cancel restores the exact baseline. */
export function advanceBody(p:BodyProfile, seconds:number):BodyProfile {
  if(!(seconds>0) || !Number.isFinite(seconds) || (p.locked&&(!p.lactating||(p.left===1&&p.right===1))))return p;
  const elapsed=p.daySeconds+(p.locked?0:seconds), days=Math.floor(elapsed/BODY_DAY_SECONDS);
  const refill=p.lactating?seconds/p.refillSeconds:0;
  return {...p,day:1+(p.day-1+days)%p.length,daySeconds:elapsed%BODY_DAY_SECONDS,left:unit(p.left+refill),right:unit(p.right+refill)};
}
