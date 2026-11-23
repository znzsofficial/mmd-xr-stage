import {Vector3} from 'three';
import {pelvicSeal,type PelvicSeal} from '../geometry';
import {rod} from '../path';
import {readCut,restingCut as rest,type CutBasis} from '../vulvaForm';
import type {PelvicSample} from '../stateTypes';
import {drawVulva,exteriorBox} from './vulvaSurface';
import {entranceLoad} from './entranceWall';
import type {OrganArtOptions} from './organArt';

// Use the stage's actual shaft/plane intersection. An idle, unverified or
// untracked tool cannot open this figure, even if its last pose was inside.
function cutSampler(){
  const contact={inside:true,outletInside:true,outletVisible:false,atCervix:false,depthM:0,outletLocal:new Vector3(),shaftLocal:rod.map(()=>new Vector3())},c={...rest};
  let seal:PelvicSeal|undefined;
  return (s:PelvicSample|null|undefined,parked=false)=>{
    if(!s?.outletInside||parked||s.shaft?.length!==rod.length||!(s.radiusM>0))return rest;
    contact.outletLocal.fromArray(s.tip);contact.depthM=s.depth;contact.outletVisible=!!s.outletVisible;contact.atCervix=s.atCervix;
    for(let i=0;i<rod.length;i++)contact.shaftLocal[i].fromArray(s.shaft[i]);
    seal=pelvicSeal(s,contact,true,seal)!;if(!seal.openness)return rest;
    readCut(seal.lip,s.radiusM,c);const n=1/s.radiusM;c.x*=n;c.y*=n;c.xx*=n;c.xy*=n;c.yx*=n;c.yy*=n;return c;
  };
}
const sectionCut=cutSampler();
export function observedCut(s:PelvicSample|null|undefined,parked=false):CutBasis {
  const c=sectionCut(s,parked);return c===rest?rest:{...c};
}

export function createExteriorStudy(){
  const sampleCut=cutSampler();
  return (ctx:CanvasRenderingContext2D,o:OrganArtOptions)=>{
    const {x,y,width:w,height:h,sample:s,yaw}=o,box=exteriorBox;
    const cut=sampleCut(s,o.parked);
    ctx.save();ctx.translate(x,y);ctx.fillStyle='#211722';ctx.fillRect(0,0,w,h);
    ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    const zoom=Math.min(w/(box.right-box.left),h/(box.bottom-box.top))*0.94;
    ctx.translate(w/2,h/2);ctx.scale(zoom,zoom);
    ctx.translate(-(box.left+box.right)/2,-(box.top+box.bottom)/2);
    // Tissue-only section. The actual mould drives both surfaces; the
    // calibration view owns the pointer and the canal view shows the mould.
    drawVulva(ctx,yaw,cut,o.foldStyle,o.rim,(o.exteriorDisplayScale??Infinity)*zoom,entranceLoad(s,cut));
    ctx.restore();
  };
}
