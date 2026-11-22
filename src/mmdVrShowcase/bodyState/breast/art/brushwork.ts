import { breastPoint, cutAt, settleWeight, type BreastMesh } from './breastSurface';
import { chest, torsoWidth, wallPoint } from './figure';
import { cutBounds, type Camera, type Ink, type P, type Side, type V } from './geometry';
import { clamp } from './mesh';
import { portraitX, portraitY, RASTER_HEIGHT, RASTER_SCALE, RASTER_WIDTH } from './raster';
import { ductPoint, fatPoint, glandPoint } from './section';

export type Marks={muscle:P;wall:P;gland:P;duct:P;fat:P};

/** Attach leaders to the deformed cut. Chest-wall landmarks also need a
 * visibility check, since either shoulder can cover them in a three-quarter view. */
export function labelAnchors(mesh:BreastMesh,side:Side,cam:Camera,z:Float32Array):Marks {
  const project=([x,y,w]:V):P=>[portraitX(cam,x,w),portraitY(y,x*cam.s+w*cam.c)];
  const tissue=([s,h]:readonly[number,number])=>{
    const [hi,lo]=cutBounds(s);
    return project(cutAt(mesh,(1-s)**(1/1.6),clamp((h-lo)/(hi-lo))));
  };
  const wallSide=Math.abs(cam.s)<.40?(side===1?-1:1):side;
  const wallMark=(ty:number,tx:number)=>{
    let best=Infinity,anchor=project(wallPoint(wallSide,ty,tx));
    for(let j=0;j<17;j++)for(let i=0;i<8;i++){
      const t=.035+j*.059, u=(tx>.5 ? .64 : .036)+i*.040, v=wallPoint(wallSide,t,u), pt=project(v);
      const d=v[0]*cam.s+v[2]*cam.c+.057*v[1];
      const diff=Math.abs(d-z[Math.round(pt[1]*RASTER_SCALE)*RASTER_WIDTH+Math.round(pt[0]*RASTER_SCALE)]), dist=Math.abs(t-ty)+Math.abs(u-tx)*.5;
      if(diff<.019 && dist<best){best=dist;anchor=pt;}
    }
    return anchor;
  };
  return {muscle:wallMark(.91,.29),wall:wallMark(.26,.83),gland:tissue(glandPoint),duct:tissue(ductPoint),fat:tissue(fatPoint)};
}

// The marks are curves on the volumes, not screen-space decoration. Flush a
// tapered stroke wherever its surface passes behind a nearer mesh.
export function brushwork(ctx:Ink,cam:Camera,z:Float32Array,left:BreastMesh,right:BreastMesh,settle:number) {
  const brush=(point:(t:number)=>V,ink:string,width:number,steps=36)=>{
    let pts:Array<[number,number,number]>=[];
    const finish=()=>{
      if(pts.length<2){pts=[];return;}
      const rim:P[]=[],aft:P[]=[];
      for(let i=0;i<pts.length;i++){
        const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],p=pts[i],dx=b[0]-a[0],dy=b[1]-a[1],k=p[2]/(Math.hypot(dx,dy)||1);
        rim.push([p[0]-dy*k,p[1]+dx*k]);aft.push([p[0]+dy*k,p[1]-dx*k]);
      }
      ctx.beginPath();ctx.moveTo(...rim[0]);for(const p of rim)ctx.lineTo(...p);for(let i=aft.length-1;i>=0;i--)ctx.lineTo(...aft[i]);
      ctx.closePath();ctx.fillStyle=ink;ctx.fill();pts=[];
    };
    for(let i=0;i<=steps;i++){
      const t=i/steps,[x,y,w]=point(t),d=x*cam.s+w*cam.c,px=portraitX(cam,x,w)*RASTER_SCALE,py=portraitY(y,d)*RASTER_SCALE;
      const k=Math.floor(py)*RASTER_WIDTH+Math.floor(px),visible=px>=0&&py>=0&&px<RASTER_WIDTH&&py<RASTER_HEIGHT&&Math.abs(d+y*.057-z[k])<.027;
      if(visible)pts.push([px,py,width*RASTER_SCALE*.5*Math.sin(t*Math.PI)**.62]);else finish();
    }
    finish();
  };
  for(const side of [-1,1] as const){
    const clav=(t:number,dy:number)=>{const a=.074+t*.90,ax=torsoWidth(.70)*Math.sin(a);return chest(side*a,.701+.073*Math.sin(ax*4.6)+dy);};
    brush(t=>clav(t,0),'#b77676',1.34);
    brush(t=>clav(.17+.56*t,.028),'#ffeacd',1.83);
    brush(t=>chest(side*(.116+.138*t),.898-.151*t),'#c68b86',.88);
    brush(t=>chest(side*(1.064+.38*t),.53-.25*t+.027*Math.sin(t*Math.PI)),'#b57578',1.36);
    const mesh=side===1?left:right;
    const at=(u:number,v:number)=>{
      const p=breastPoint(mesh,u,v);if(settle)p[1]+=settle*settleWeight(Math.hypot(u,v),v);return p;
    };
    brush(t=>{const a=3.63+1.87*t,r=.941-.060*Math.sin(Math.PI*t);return at(r*Math.cos(a),r*Math.sin(a));},'#aa737d',.90);
    brush(t=>at(-side*.20+.067*Math.sin(t*1.9),.43-.207*t),'#fff1d8',2.91,22);
    brush(t=>at(-side*.23+.025*t,.27-.049*t),'#fff4dd',1.48,14);
    brush(t=>at(side*(-.022+.047*t),.024+.008*Math.sin(t*Math.PI)),'rgba(255,222,196,.81)',1.27,14);
  }
  brush(t=>chest((t-.5)*.19,.736-.021*Math.sin(t*Math.PI)),'#af7477',1.20,20);
}
