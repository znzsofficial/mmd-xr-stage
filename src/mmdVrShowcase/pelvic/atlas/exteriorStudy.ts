import {Vector3} from 'three';
import {pelvicSeal} from '../geometry';
import {rod} from '../path';
import {readCut,restingCut as rest,type CutBasis} from '../vulvaForm';
import type {PelvicSample} from '../stateTypes';
import {drawVulva,exteriorBox,exteriorLens} from './vulvaSurface';
import type {OrganArtOptions} from './organArt';

// Use the stage's actual shaft/plane intersection. An idle, unverified or
// untracked tool cannot open this figure, even if its last pose was inside.
export function observedCut(s:PelvicSample|null|undefined,parked=false):CutBasis {
  if(!s?.outletInside||parked||s.shaft?.length!==rod.length||!(s.radiusM>0))return rest;
  const seal=pelvicSeal(s,{inside:true,outletInside:true,outletVisible:!!s.outletVisible,atCervix:s.atCervix,
    depthM:s.depth,outletLocal:new Vector3(...s.tip),shaftLocal:s.shaft.map(p=>new Vector3(...p))},true);
  if(!seal?.openness)return rest;
  const c={...rest};readCut(seal.lip,s.radiusM,c);
  return {x:c.x/s.radiusM,y:c.y/s.radiusM,xx:c.xx/s.radiusM,xy:c.xy/s.radiusM,yx:c.yx/s.radiusM,yy:c.yy/s.radiusM};
}

export function createExteriorStudy(){
  let cut=rest;
  return (ctx:CanvasRenderingContext2D,o:OrganArtOptions)=>{
    const {x,y,width:w,height:h,sample:s,yaw}=o,box=exteriorBox;
    const next=observedCut(s,o.parked);
    if((Object.keys(next) as (keyof CutBasis)[]).some(k=>Math.abs(cut[k]-next[k])>1e-5))cut=next;
    ctx.save();ctx.translate(x,y);ctx.fillStyle='#211722';ctx.fillRect(0,0,w,h);
    ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
    const zoom=Math.min(w/(box.right-box.left),h/(box.bottom-box.top))*0.94;
    ctx.translate(w/2,h/2);ctx.scale(zoom,zoom);
    ctx.translate(-(box.left+box.right)/2,-(box.top+box.bottom)/2);
    drawVulva(ctx,yaw,cut,o.foldStyle,o.rim);
    if(s&&s.radiusM>0){
      const point=exteriorLens(yaw,s.radiusM),state=o.parked?'#ebc68e':s.outletInside?'#c3d9fa':s.outletVisible?'#c7a5ff':'#ffba9f';
      const shaft=s.shaft;
      // Show only the exterior portions of the sampled mould. In particular,
      // don't draw an internal nozzle or an unverified buried rod over skin.
      if(shaft&&(o.parked||s.outletInside||s.outletVisible)){
        ctx.beginPath();ctx.setLineDash(o.parked?[3,3]:[]);
        for(let i=1;i<shaft.length;i++){
          const a=shaft[i-1],b=shaft[i];if(a[2]<0&&b[2]<0)continue;
          const k=a[2]/(a[2]-b[2]);
          const rim=()=>point(a[0]+k*(b[0]-a[0]),a[1]+k*(b[1]-a[1]),0);
          const from=a[2]<0?rim():point(...a),to=b[2]<0?rim():point(...b);
          ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);
        }
        ctx.strokeStyle='#3a2534';ctx.lineWidth=3.6;ctx.stroke();ctx.strokeStyle=state;ctx.lineWidth=1.7;ctx.stroke();ctx.setLineDash([]);
      }
      if(s.tip[2]>=0){const p=point(...s.tip);ctx.beginPath();if(o.parked)ctx.rect(p.x-2.7,p.y-2.7,5.4,5.4);else ctx.arc(p.x,p.y,3,0,2*Math.PI);
        ctx.fillStyle='#291d29';ctx.fill();ctx.strokeStyle=state;ctx.lineWidth=1.3;ctx.stroke();}
    }
    ctx.restore();
  };
}
