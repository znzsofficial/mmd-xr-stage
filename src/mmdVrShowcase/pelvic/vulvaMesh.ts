import {BufferGeometry,Color,DynamicDrawUsage,Float32BufferAttribute} from 'three';
import {fitSite,formColors,junctionColor,readCut,slitHalfLength,vulvaHalves,type CutBasis,type FoldStyle,type Landmark,type RimState} from './vulvaForm';
import type {PelvicSeal} from './contract';
import {foldFinish} from './vulvaFinish';

const sites=vulvaHalves.flatMap(h=>h.rows.flatMap(r=>r.sites));
const columns=formColors.length,colors=formColors.map(c=>new Color(c));
export function landmarkAt(i:number):Landmark|null{
  const s=sites[i];return s.meatus>.44?'urethra':s.glans>.34&&s.glans>s.hood?'glans':s.hood>.35?'hood':null;
}

/** One indexed surface for the stage and the CPU observation painter. The
 * actor's displayed skin remains intact and visible through the real cut. */
export function createSealShell(){
  const geom=new BufferGeometry(),pos=new Float32BufferAttribute(sites.length*3,3).setUsage(DynamicDrawUsage);
  const pigment=new Float32Array(pos.count*3),uv=new Float32Array(pos.count*2),ix:number[]=[],tint=new Color(),skin=new Color(junctionColor);
  const fields=foldFinish(),rowCount=vulvaHalves[0].rows.length;
  function grid(base:number,rows:number,cols:number,side:number){
    // Weld the midline everywhere except the two free edges of the calibrated
    // opening. The shared index makes grazing-angle normals continuous.
    const index=(j:number,k:number)=>j===0||j===rows-1?j*cols:side===1&&k===0&&Math.abs(sites[base+j*cols].station)>=slitHalfLength?j*cols:base+j*cols+k;
    for(let j=0;j<rows-1;j++)for(let k=0;k<cols-1;k++){
      const a=index(j,k),b=index(j,k+1),c=index(j+1,k),d=index(j+1,k+1);
      if(a!==b){if(side===1)ix.push(a,b,c);else ix.push(a,c,b);}
      if(c!==d){if(side===1)ix.push(b,d,c);else ix.push(b,c,d);}
    }
  }
  for(const [h,{rows,side}] of vulvaHalves.entries())grid(h*rows.length*columns,rows.length,columns,side);
  const coral=new Color('#ef8da6'),blossom=new Color('#ffbdc5'),groove=new Color('#a05f7c'),rose=new Color('#ce819e');
  sites.forEach((s,i)=>{
    tint.copy(colors[i%columns]).lerp(skin,s.blend).lerp(coral,.82*s.glans+.10*s.meatus).lerp(blossom,.60*s.hood)
      .lerp(rose,.63*s.undercurl).lerp(groove,.94*s.well).multiplyScalar(1-.12*s.contactShade).toArray(pigment,i*3);
    // A single continuous chart across the welded midline. Each material
    // station lands at its texel centre, including the uneven terminal rows.
    uv[2*i]=(columns-.5+s.side*(i%columns))/(2*columns-1);
    uv[2*i+1]=(Math.floor(i/columns)%rowCount+.5)/rowCount;
  });
  const dye=new Float32BufferAttribute(pos.count*3,3),pearl=new Color('#ffcfcc');
  const saturate=(v:number)=>Math.max(0,Math.min(1,v));
  // Mix the optional rim first. Its finished colour is intrinsic linear RGB,
  // shared by the stage and the drawing; neither stores a lit/highlight colour.
  function setDye(i:number,pearlMix:number){
    const m=fields[i];tint.fromArray(pigment,3*i).lerp(pearl,pearlMix).convertLinearToSRGB();
    tint.setRGB(saturate(tint.r*m.tone+m.r/255),saturate(tint.g*m.tone+m.g/255),saturate(tint.b*m.tone+m.b/255)).convertSRGBToLinear();
    dye.setXYZ(i,tint.r,tint.g,tint.b);
  }
  for(let i=0;i<sites.length;i++)setDye(i,0);
  geom.setIndex(ix);geom.setAttribute('position',pos);geom.setAttribute('color',dye);
  const normals=new Float32BufferAttribute(pos.count*3,3).setUsage(DynamicDrawUsage);
  geom.setAttribute('uv',new Float32BufferAttribute(uv,2));geom.setAttribute('normal',normals);
  // Near the cut and hood, longitudinal rows are deliberately uneven. A
  // wide triangle must not grab a whole crest's normal. Sum angle-weighted
  // directions (sin of the corner angle), across the same welded indices.
  function smoothNormals(){
    const p=pos.array,n=normals.array;n.fill(0);
    for(let t=0;t<ix.length;t+=3){const a=3*ix[t],b=3*ix[t+1],c=3*ix[t+2],x=p[b]-p[a],y=p[b+1]-p[a+1],z=p[b+2]-p[a+2],u=p[c]-p[a],v=p[c+1]-p[a+1],w=p[c+2]-p[a+2];
      const X=y*w-z*v,Y=z*u-x*w,Z=x*v-y*u,ab=1/Math.sqrt(x*x+y*y+z*z||1),ac=1/Math.sqrt(u*u+v*v+w*w||1),bc=1/Math.sqrt((x-u)**2+(y-v)**2+(z-w)**2||1);
      const wa=ab*ac,wb=ab*bc,wc=ac*bc;n[a]+=X*wa;n[a+1]+=Y*wa;n[a+2]+=Z*wa;n[b]+=X*wb;n[b+1]+=Y*wb;n[b+2]+=Z*wb;n[c]+=X*wc;n[c+1]+=Y*wc;n[c+2]+=Z*wc;
    }
    geom.normalizeNormals();normals.needsUpdate=true;
  }
  const last={x:0,y:0,xx:0,xy:0,yx:0,yy:0},cut={...last},point={x:0,y:0,z:0};
  let fittedRadius=-1,fittedStyle:FoldStyle|undefined,fittedRim:RimState|undefined;
  function fitCut(c:CutBasis,radius:number,style:FoldStyle='natural',rim:RimState='off'){
    if(style===fittedStyle&&rim===fittedRim&&Math.abs(radius-fittedRadius)+Math.abs(c.x-last.x)+Math.abs(c.y-last.y)+
      Math.abs(c.xx-last.xx)+Math.abs(c.xy-last.xy)+Math.abs(c.yx-last.yx)+Math.abs(c.yy-last.yy)<1e-8)return;
    if(rim!==(fittedRim??'off')){
      sites.forEach((s,i)=>{if(s.margin<.001)return;
        const settled=rim==='center'||rim===(s.side<0?'left':'right');
        setDye(i,rim==='off'?0:s.margin*(settled?.21:.67));
      });dye.needsUpdate=true;
    }
    Object.assign(last,c);fittedRadius=radius;fittedStyle=style;fittedRim=rim;
    for(let i=0;i<sites.length;i++){fitSite(sites[i],radius,c,point,style,rim);pos.setXYZ(i,point.x,point.y,point.z);}
    pos.needsUpdate=true;smoothNormals();geom.computeBoundingSphere();if(geom.boundingBox)geom.computeBoundingBox();
  }
  return {geom,fitCut,fit(seal:PelvicSeal,radius:number,style?:FoldStyle,rim?:RimState){readCut(seal.lip,radius,cut);fitCut(cut,radius,style,rim);}};
}
