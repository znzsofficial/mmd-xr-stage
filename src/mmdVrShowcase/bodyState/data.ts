/** Reversible settings owned by the actor's backpack entry. Only enabled
 * milk stores use elapsed stage time; the actor's base shape is literal. */
export type BodyProfile = {
  fullness:number; compression:number; rebound:number; morph:string|null;
  sensitivityMode:'off'|'manual'; sensitivity:number;
  lactating:boolean; left:number; right:number; refillSeconds:number; bareLeft:boolean; bareRight:boolean;
};
export const DEFAULT_BODY_PROFILE: Readonly<BodyProfile> = Object.freeze({
  fullness:0,compression:1,rebound:.085,morph:null,sensitivityMode:'off',sensitivity:.5,
  lactating:false,left:.5,right:.5,refillSeconds:180,bareLeft:false,bareRight:false,
});

export const BODY_BOUNDS={fullness:[0,1],compression:[0,1],rebound:[.02,.4],sensitivity:[0,1],
  left:[0,1],right:[0,1],refillSeconds:[15,3600]} as const;

export function normalizeBody(p:BodyProfile):BodyProfile {
  function value(key:keyof typeof BODY_BOUNDS){
    const [min,max]=BODY_BOUNDS[key];return Number.isFinite(p[key])?Math.max(min,Math.min(max,p[key])):DEFAULT_BODY_PROFILE[key];
  }
  return {fullness:value('fullness'),compression:value('compression'),rebound:value('rebound'),morph:typeof p.morph==='string'&&p.morph?p.morph:null,
    sensitivityMode:p.sensitivityMode==='manual'?'manual':'off',sensitivity:value('sensitivity'),lactating:p.lactating===true,
    left:value('left'),right:value('right'),refillSeconds:value('refillSeconds'),bareLeft:p.bareLeft===true,bareRight:p.bareRight===true};
}

export function refillMilk(p:BodyProfile,seconds:number):BodyProfile {
  if(!p.lactating||p.left===1&&p.right===1||!(seconds>0)||!Number.isFinite(seconds))return p;
  const amount=seconds/p.refillSeconds;
  return {...p,left:Math.min(1,p.left+amount),right:Math.min(1,p.right+amount)};
}

/** Static illustration data, not an attribute of the actor. */
export type EndometrialTissue = { functionalDepth:number; breakdown:number; glandCoil:number; vesselCoil:number };
export const REFERENCE_TISSUE:Readonly<EndometrialTissue>=Object.freeze({functionalDepth:.44,breakdown:0,glandCoil:.14,vesselCoil:.23});

export const ENDOMETRIAL_PATCHES = [
  {center:.18,radius:.105,loss:.98}, {center:.53,radius:.14,loss:1}, {center:.84,radius:.08,loss:.84},
] as const;
export function functionalDepthAt(tissue:EndometrialTissue,u:number){
  if(!tissue.breakdown)return tissue.functionalDepth;
  let loss=0;
  for(const patch of ENDOMETRIAL_PATCHES){
    const t=Math.max(0,Math.min(1,(Math.abs(u-patch.center)/patch.radius-.18)/.82));
    loss=Math.max(loss,patch.loss*(1-t*t*(3-2*t)));
  }
  return tissue.functionalDepth*(1-loss*tissue.breakdown);
}
