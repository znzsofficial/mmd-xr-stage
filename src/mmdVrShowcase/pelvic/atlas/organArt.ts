import { Vector3 } from 'three';
import type { PelvicSample } from '../stateTypes';
import {semenColor,semenRGB} from '../../play/semenAppearance';
import type { PelvicXYZ } from '../contract';
import { pelvicCenterline, projectDepth, tangent } from '../path';
import { canalY, clamp, ENTRY, organMeshes, smooth, STOP, stride } from './model';
import {canalBands,canalStudy,type CanalStudy} from './canalGeometry';
import {canalAspectX,canalAspectY,createCanalContact,fitWall,type CanalContact} from './canalContact';
import type { Mesh, V } from './model';
import type {EndometrialTissue} from '../../bodyState/data';
import {createWallStudy,wallStride} from './uterineWall';
import {createExteriorStudy} from './exteriorStudy';
import type {FoldStyle} from '../vulvaForm';

export interface OrganArtOptions {
  x:number; y:number; width:number; height:number; yaw:number; time:number;
  focus?:'uterus'|'vagina'|'vulva';
  foldStyle?:FoldStyle;
  /** Illustrative normalized tissue inputs, not physical measurements. */
  lining:number; shedding:number; pressure:number; zh:boolean; tissue?:EndometrialTissue; labels?:boolean;
  /** Selected balance / its OWN capacity. Optional second balance is vaginal. */
  fluid:number; fantasy:boolean; vaginalFluid?:number; uterineFluid?:number; sample?:PelvicSample|null; parked?:boolean;
}
export const organPigments={endometrium:'#f4b396',myometrium:'#d28177',ovary:'#e0c1a0',liquid:semenColor} as const;
const {sin,cos,abs,PI,sqrt}=Math;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const sane=(x:number)=>Number.isFinite(x)?clamp(x):0;
type Plate={w:number;h:number;color:Uint8ClampedArray;z:Float32Array};
function plate(w:number,h:number,base=false):Plate {
  const color=new Uint8ClampedArray(w*h*4),z=new Float32Array(w*h);z.fill(-1e4);
  if(base)new Uint32Array(color.buffer).fill(0xff221721); // solid #211722, little-endian RGBA
  return {w,h,color,z};
}
type Lens=ReturnType<typeof lens>;
function lens(w:number,h:number,yaw:number,canal=false){
  const ca=cos(yaw),sa=sin(yaw),a=Math.acos(clamp(abs(ca),0,1));
  const cut=smooth(.72,1.54,a),angle=cut*(sa<0?-1:1)*PI/2;
  const pitch=.095*abs(ca),cp=cos(pitch),sp=sin(pitch),scale=canal?Math.min(w*.74/3.1,h*.83/3.6):Math.min(w*.91/11.99,h*.88/8.78);
  return {ca,sa,cut,cp,sp,scale,dc:cos(yaw-angle),ds:sin(yaw-angle),
    ox:w*.5+(canal?0:.37)*sa*scale,oy:h*.5+(canal?ENTRY+1.61:.45)*scale,nearAlpha:1-smooth(.96,1.45,a),farAlpha:1-smooth(1.29,1.54,a)};
}
function point(l:Lens,x:number,y:number,z:number):V{
  const d=l.sa*x+l.ca*y;return [l.ox+(l.ca*x-l.sa*y)*l.scale,l.oy-(z*l.cp-d*l.sp)*l.scale,d*l.cp+z*l.sp];
}

// Smooth colour and depth interpolation; no graphics context or actor meshes.
// For the static adnexa, the depth/pigment buffers survive the entire rotation stop.
const N=6;
type Topology=Pick<Mesh,'indices'|'etch'|'cols'|'rows'>;
function triangles(p:Plate,mesh:Topology,v:Float32Array,sectionMix=0,indexCount=mesh.indices.length,opacity=1){
  const {w,h,z,color}=p,ix=mesh.indices;
  const etch=mesh.etch,tex=etch?.[sectionMix>.5?1:0],ink=tex?.ink,tw=tex?.width??0,th=tex?.height??0,qu=(tw-1)/(mesh.cols-1),qv=(th-1)/(mesh.rows-1);
  for(let k=0;k<indexCount;k+=3){
    const ai=ix[k],bi=ix[k+1],ci=ix[k+2];
    const a=ai*N,b=bi*N,c=ci*N,ax=v[a],ay=v[a+1],ux=v[b]-ax,uy=v[b+1]-ay,vx=v[c]-ax,vy=v[c+1]-ay;
    const det=ux*vy-uy*vx;if(abs(det)<.00001||opacity<1&&det<0)continue;
    const x0=Math.max(0,Math.ceil(ax+Math.min(0,ux,vx))),x1=Math.min(w-1,Math.floor(ax+Math.max(0,ux,vx)));
    const y0=Math.max(0,Math.ceil(ay+Math.min(0,uy,vy))),y1=Math.min(h-1,Math.floor(ay+Math.max(0,uy,vy)));
    const du=vy/det,dt=-uy/det,eu=-vx/det,et=ux/det,za=v[a+2],zu=v[b+2]-za,zv=v[c+2]-za;
    const ra=v[a+3],ga=v[a+4],ba=v[a+5],ru=v[b+3]-ra,rv=v[c+3]-ra,gu=v[b+4]-ga,gv=v[c+4]-ga,bu=v[b+5]-ba,bv=v[c+5]-ba;
    const tu=(ai%mesh.cols)*qu,tt=Math.floor(ai/mesh.cols)*qv,first=bi===ai+1;
    for(let y=y0;y<=y1;y++){
      let u=(x0-ax)*du+(y-ay)*eu,t=(x0-ax)*dt+(y-ay)*et;
      for(let x=x0;x<=x1;x++,u+=du,t+=dt){
        if(u<-.0002||t<-.0002||u+t>1.0002)continue;
        const i=y*w+x,d=za+u*zu+t*zv;if(d<z[i])continue;z[i]=d;
        let mark=0;if(ink){const ti=Math.round(tu+(first?u:-t)*qu)+tw*Math.round(tt+(first?t:u+t)*qv);
          mark=sectionMix>.01&&sectionMix<.99?mix(etch![0].ink[ti],etch![1].ink[ti],sectionMix):ink[ti];}
        const j=4*i,r=ra+u*ru+t*rv+mark*.87,g=ga+u*gu+t*gv+mark,b=ba+u*bu+t*bv+mark*.87;
        if(opacity<1){color[j]=mix(color[j],r,opacity);color[j+1]=mix(color[j+1],g,opacity);color[j+2]=mix(color[j+2],b,opacity);}
        else{color[j]=r;color[j+1]=g;color[j+2]=b;}
      }
    }
  }
}
// Dedicated cutaway uses object-space XYZ for BOTH materials, one invariant
// dissection and actual displaced normals. No interpolation of view-specific
// plates. The old overview stays on its independently authored corpus mesh.
function projectCanal(mesh:Mesh,data:Float32Array,out:Float32Array,l:Lens,fill:number){
  const level=mix(ENTRY,STOP,fill);
  for(let i=0,j=0;i<data.length;i+=stride,j+=N){
    const x=data[i],y=data[i+1],z=data[i+2],d=x*l.sa+y*l.ca;
    out[j]=l.ox+(x*l.ca-y*l.sa)*l.scale;out[j+1]=l.oy-(z*l.cp-d*l.sp)*l.scale;out[j+2]=d*l.cp+z*l.sp;
    let nx=data[i+3]*l.ca-data[i+4]*l.sa,front=data[i+3]*l.sa+data[i+4]*l.ca,up=data[i+5]*l.cp-front*l.sp;
    front=front*l.cp+data[i+5]*l.sp;if(front<0){nx=-nx;up=-up;front=-front;}
    const diffuse=clamp(.53-.34*nx+.42*up+.39*front),gloss=mesh.a[i+11];
    const half=clamp(-.31*nx+.37*up+.875*front),spec=half*half,glint=spec*spec*spec*spec;
    const shine=glint*glint*(4+gloss*24),bounce=(1-front)*(1-diffuse)*8;
    let r=data[i+6],g=data[i+7],b=data[i+8];
    if(fill>0&&gloss>0){const coat=gloss*(1-smooth(level-.04,level+.04,z))*.89;
      r=mix(r,semenRGB[0],coat);g=mix(g,semenRGB[1],coat);b=mix(b,semenRGB[2],coat);}
    out[j+3]=r*(.72+.28*diffuse)+shine+bounce;out[j+4]=g*(.64+.36*diffuse)+shine*.85;out[j+5]=b*(.73+.27*diffuse)+shine*.82+bounce;
  }
}

// Same measured sections as the wall, depth-tested *between* the two sheets.
// Slate keeps the measured mould separate from rose tissue and white liquid.
const sleeveSides=20,sleeveCols=sleeveSides+1;
const sleeveCircle=Array.from({length:sleeveCols},(_,i)=>[cos(i*2*PI/sleeveSides),sin(i*2*PI/sleeveSides)]);
function sleeveTopology():Topology{
  const rows=canalBands+2,indices=new Uint32Array((rows-1)*sleeveSides*6);
  for(let j=0,k=0;j<rows-1;j++)for(let i=0;i<sleeveSides;i++){
    const a=j*sleeveCols+i;indices.set([a,a+1,a+sleeveCols,a+1,a+sleeveCols+1,a+sleeveCols],k);k+=6;
  }return {cols:sleeveCols,rows,indices};
}
function drawSleeve(contact:CanalContact,mesh:Topology,out:Float32Array,p:Plate,l:Lens){
  const rows=contact.rings((row,z,x,y,rx,ry,shear)=>{
    for(let i=0,j=row*sleeveCols*N;i<sleeveCols;i++,j+=N){const [cx,cy]=sleeveCircle[i],sx=x+cx*rx,sy=y+cy*ry+cx*rx*shear,d=sx*l.sa+sy*l.ca;
      out[j]=l.ox+(sx*l.ca-sy*l.sa)*l.scale;out[j+1]=l.oy-(z*l.cp-d*l.sp)*l.scale;out[j+2]=d*l.cp+z*l.sp;
      const k=clamp(.31+.49*(cx*l.sa+cy*l.ca)-.30*(cx*l.ca-cy*l.sa));out[j+3]=113+79*k;out[j+4]=103+75*k;out[j+5]=135+70*k;
    }
  });if(rows>=2)triangles(p,mesh,out,0,(rows-1)*sleeveSides*6,.62);
}
function projectMesh(mesh:Mesh,out:Float32Array,l:Lens,o:OrganArtOptions,vag:boolean,wall?:readonly [Float32Array,Float32Array]){
  const a=mesh.a,b=mesh.b,section=mesh.section,q=section?l.cut:0,iq=1-q,dc=section?l.dc:l.ca,ds=section?l.ds:l.sa;
  const lining=sane(o.lining),shed=sane(o.shedding),pressure=sane(o.pressure),time=Number.isFinite(o.time)?o.time:0;
  const fill=vag?sane(o.vaginalFluid??(o.fantasy?0:o.fluid)):sane(o.uterineFluid??(o.fantasy?o.fluid:0));
  const level=vag?mix(ENTRY,STOP,fill):mix(.47,3.77,fill);
  let i=0,j=0,k=0;
  for(let row=0;row<mesh.rows;row++){
    const rowZ=a[i+2];
    const wave=section?(.5+.5*cos(rowZ*1.14-time*2.45))**4:0;
    const constr=section?(vag?.014:.042)*wave:0, lift=section?(vag?.018:.074)*wave:0;
    for(let col=0;col<mesh.cols;col++,i+=stride,j+=N,k+=wallStride){
      let x=a[i]*iq+b[i]*q,y=a[i+1]*iq+b[i+1]*q,z=a[i+2]*iq+b[i+2]*q;
      const xc=a[i+9]*iq+b[i+9]*q,lw=a[i+10]*iq+b[i+10]*q,lum=a[i+11]*iq+b[i+11]*q;
      if(section){
        const thickness=wall?wall[0][k]*iq+wall[1][k]*q:lw*lining;
        const relief=wall?wall[0][k+1]*iq+wall[1][k+1]*q:lw*.08*lining;
        // Keep the narrow sagittal slit from inverting even at maximum
        // thickness. The surface also grows towards the exposed cut face.
        const inset=Math.min(Math.abs(x)*.65,thickness*(wall ? .22 : .095));
        x=x*(1-constr)-Math.sign(x)*inset;y=y*(1-constr)+lw*.045+relief;
        if(vag&&l.sa<0)z-=.38*q*(row/(mesh.rows-1))*Math.sin((col/(mesh.cols-1)-.5)*PI);
        if(vag&&pressure>0){const k=clamp(1-abs(z-STOP)*.63)*pressure;x*=1+.055*k;y-=.075*k*lum;}
        z+=lift;}
      const depth=x*ds+y*dc+xc*l.ca;
      out[j]=l.ox+(x*dc-y*ds-xc*l.sa)*l.scale;out[j+1]=l.oy-(z*l.cp-depth*l.sp)*l.scale;out[j+2]=depth*l.cp+z*l.sp;
      const nx=a[i+3]*iq+b[i+3]*q,ny=a[i+4]*iq+b[i+4]*q,nz=a[i+5]*iq+b[i+5]*q;
      let rx=nx*dc-ny*ds,nd=nx*ds+ny*dc,up=nz*l.cp-nd*l.sp;nd=nd*l.cp+nz*l.sp;
      const nrm=1/(sqrt(rx*rx+up*up+nd*nd)||1);rx*=nrm;up*=nrm;nd*=nrm;
      if(nd<0){rx=-rx;up=-up;nd=-nd;}
      // Diffuse softbox, warm raking glint and a low cool bounce on the silhouette.
      const lam=Math.max(0,-rx*.47+up*.63+nd*.62),spec=Math.max(0,-rx*.265+up*.36+nd*.895)**19;
      const light=.65+.34*lam+.046*up,edge=(1-nd)**3,shine=spec*(section?8:15);
      let r=a[i+6]*iq+b[i+6]*q,g=a[i+7]*iq+b[i+7]*q,bl=a[i+8]*iq+b[i+8]*q;
      if(section){
        if(wall){const gland=wall[0][k+2]*iq+wall[1][k+2]*q,vessel=wall[0][k+3]*iq+wall[1][k+3]*q;
          r+=wave*2.6+gland*21-vessel*31;g+=gland*25-vessel*64;bl+=gland*18-vessel*39;
        }else{r+=lw*(lining*6-shed*19)+wave*2.6;g-=lw*shed*38;bl-=lw*shed*20;}
        // Only a tagged lumen receives the actual compartment balance. No drops,
         // inferred flow, or transfer between organs when changing the view.
        const coverage=vag?smooth(.8,1.72,lum):smooth(.60,.92,lum);
        if(fill>0&&coverage>0){const wet=(1-smooth(level-.025,level+.025,z))*coverage;
          const rim=clamp(1-abs(z-level)/.085)*wet,alpha=wet*.96;
          r=mix(r,semenRGB[0]+8*rim,alpha);g=mix(g,semenRGB[1]+9*rim,alpha);bl=mix(bl,semenRGB[2]+10*rim,alpha);}
      }
      out[j+3]=r*light+shine+edge*11;out[j+4]=g*(light-.017)+shine*.93+edge*7;out[j+5]=bl*(light+.015)+shine*.79+edge*13;
    }
  }
}

function annotations(ctx:CanvasRenderingContext2D,l:Lens,o:OrganArtOptions,liningPt:V,musclePt:V){
  const w=o.width,h=o.height,k=Math.min(w/344,h/250),front=abs(l.ca)>.47;
  ctx.font=`550 ${Math.max(9,14*k)}px system-ui, sans-serif`;ctx.lineJoin='round';ctx.lineCap='round';
  const call=(pos:V,text:string,right:boolean,y:number,color:string)=>{
    const [px,py]=pos,x=right?w-9*k:9*k;
    const tw=ctx.measureText(text).width,elbow=right?x-tw-7*k:x+tw+7*k;
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(elbow,y+1*k);ctx.lineTo(right?elbow+4*k:elbow-4*k,y+1*k);
    ctx.strokeStyle='rgba(240,204,187,.62)';ctx.lineWidth=.72*k;ctx.stroke();
    ctx.beginPath();ctx.arc(px,py,1.7*k,0,2*PI);ctx.fillStyle=color;ctx.fill();
    ctx.textAlign=right?'right':'left';ctx.textBaseline='middle';ctx.lineWidth=2.9*k;ctx.strokeStyle='#211722';ctx.strokeText(text,x,y);
    ctx.fillStyle='#e6cfc5';ctx.fillText(text,x,y);
  };
  if(front){const s=l.ca>=0?-1:1;call(point(l,4.48*s+.24*l.sa,-1.01+.34*l.ca,2.68),o.zh?'卵巢':'Ovary',false,h*.48,organPigments.ovary);}
  if(l.ca>-.25)call(liningPt,o.zh?'子宫内膜':'Endometrium',true,h*.63,organPigments.endometrium);
  if(!front)call(musclePt,o.zh?'子宫肌层':'Myometrium',false,h*.32,organPigments.myometrium);
}

const vec=new Vector3(),c0=new Vector3(),tv=new Vector3();
function sampleMark(ctx:CanvasRenderingContext2D,l:Lens,o:OrganArtOptions){
  const s=o.sample;if(!s||!(s.lengthM>0&&s.radiusM>0))return;
  const map=(p:PelvicXYZ):V=>{
    vec.fromArray(p);const d=projectDepth(s,vec),t=d/s.lengthM;pelvicCenterline(s,d,c0);tangent(s,d,tv);
    if(d>s.lengthM)c0.addScaledVector(tv,d-s.lengthM);
    const offset=(-(vec.y-c0.y)*tv.z+(vec.z-c0.z)*tv.y)/s.radiusM;
    return point(l,p[0]/s.radiusM*canalAspectX,canalY(clamp(t))+offset*canalAspectY,ENTRY+(STOP-ENTRY)*t);
  };
  const tip=map(s.tip),k=Math.min(o.width/344,o.height/250),uncertain=!s.outletInside&&!s.outletVisible;
  if(!Number.isFinite(tip[0]+tip[1])||tip[0]<0||tip[1]<0||tip[0]>o.width||tip[1]>o.height)return;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  if(o.parked){ctx.fillStyle='#211722';ctx.fillRect(tip[0]-3*k,tip[1]-3*k,6*k,6*k);ctx.strokeStyle='#ebc68e';ctx.lineWidth=1.5*k;ctx.strokeRect(tip[0]-3*k,tip[1]-3*k,6*k,6*k);ctx.restore();return;}
  if(s.outletInside&&s.shaft?.length){
    // Only the last, actual mould samples inside the calibrated region. Never
    // invent a shaft axis from the control slider or join to a remote tail.
    ctx.beginPath();ctx.moveTo(tip[0],tip[1]);for(let i=s.shaft.length-1;i>=Math.max(0,s.shaft.length-5);i--){
      const v=s.shaft[i];if(v[2]>0)break;const p=map(v);ctx.lineTo(p[0],p[1]);
    }ctx.strokeStyle='#383040';ctx.lineWidth=4.1*k;ctx.stroke();ctx.strokeStyle='#c3d9fa';ctx.lineWidth=2.1*k;ctx.stroke();
  }
  ctx.beginPath();ctx.arc(tip[0],tip[1],3.7*k,0,PI*2);ctx.strokeStyle='#2e2230';ctx.lineWidth=2.7*k;ctx.stroke();
  if(uncertain)ctx.setLineDash([2.6*k,2*k]);ctx.strokeStyle=uncertain?'#ffc8ac':'#d2e4ff';ctx.lineWidth=1.25*k;ctx.stroke();
  if(s.outletInside){ctx.beginPath();ctx.arc(tip[0],tip[1],1.6*k,0,2*PI);ctx.fillStyle='#def4ff';ctx.fill();}ctx.restore();
}

/** One owner per DOM canvas / HUD texture. Reuses model topology and CPU depth
 * buffers; the caller's current canvas transform, clip and alpha are respected. */
export function createOrganArt(){
  const wall=createWallStudy(),exterior=createExteriorStudy();
  let canvas:HTMLCanvasElement|OffscreenCanvas|null=null,ic:CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null=null;
  let frame:Plate|undefined,back:Plate|undefined,near:Plate|undefined,img:ImageData|undefined,lastYaw=NaN;
  let meshes:Mesh[]|undefined,work=new Float32Array(0),lastCanal=false;
  let cut:CanalStudy|undefined,contact:CanalContact|undefined,dynamic:Float32Array[]|undefined,sleeve:Topology|undefined,previousFill=NaN;
  return {draw(ctx:CanvasRenderingContext2D,o:OrganArtOptions){
    if(!(o.width>0&&o.height>0))return;
    if(o.focus==='vulva'){exterior(ctx,o);return;}
    const canal=o.focus==='vagina';
    if(canal){
      if(!cut){cut=canalStudy();contact=createCanalContact();dynamic=[cut.posterior.a.slice(),cut.anterior.a.slice()];sleeve=sleeveTopology();}
      const size=cut.anterior.rows*cut.anterior.cols*N;if(work.length<size)work=new Float32Array(size);
    }else if(!meshes){meshes=organMeshes();const size=Math.max(...meshes.map(m=>m.rows*m.cols))*N;if(work.length<size)work=new Float32Array(size);}
    // Fold geometry and readings remain at their authored resolution. For the
    // small observation plate, 1.5× is enough for the shaded triangles; avoid
    // allocating two 2× depth/color surfaces on the first headset frame.
    const m=ctx.getTransform(),scale=Math.min(canal?1.5:2.0,Math.max(1,Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)),680/o.width,540/o.height);
    // Measurement-view convention: at +90 degrees anterior points RIGHT.
    const w=Math.max(1,Math.round(o.width*scale)),h=Math.max(1,Math.round(o.height*scale)),yaw=Number.isFinite(o.yaw)?-o.yaw:0;
    if(!canvas||!frame||!back||!img||frame.w!==w||frame.h!==h){
      canvas??=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');
      canvas.width=w;canvas.height=h;ic=canvas.getContext('2d') as typeof ic;if(!ic)return;
      frame=plate(w,h);back=plate(w,h,true);near=undefined;img=ic.createImageData(w,h);lastYaw=NaN;
    }
    const l=lens(w,h,yaw,canal);
    const sectioning=!canal&&l.nearAlpha>0&&l.nearAlpha<1;
    const turned=yaw!==lastYaw||canal!==lastCanal;
    if(turned){new Uint32Array(back.color.buffer).fill(0xff221721);back.z.fill(-1e4);
      if(sectioning){near??=plate(w,h);near.z.fill(-1e4);}
      if(canal){for(const mesh of [cut!.commissure,cut!.vault,cut!.cervix]){projectCanal(mesh,mesh.a,work,l,0);triangles(back,mesh,work);}}
      else for(const mesh of meshes!)if(!mesh.section){const ipsi=mesh.wing===(l.sa<0?-1:1);
        if((ipsi?l.nearAlpha:l.farAlpha)===0)continue;
        projectMesh(mesh,work,l,o,false);triangles(ipsi&&sectioning?near!:back,mesh,work);}
      if(!canal&&l.farAlpha<1&&l.farAlpha>0){const c=back.color;for(let i=0;i<back.z.length;i++)if(back.z[i]>-999){const j=4*i;
        c[j]=mix(33,c[j],l.farAlpha);c[j+1]=mix(23,c[j+1],l.farAlpha);c[j+2]=mix(34,c[j+2],l.farAlpha);}}
      lastYaw=yaw;lastCanal=canal;
    }
    if(canal){
      const fit=contact!,s=cut!,shifted=fit.update(o.sample,o.parked),fill=sane(o.vaginalFluid??(o.fantasy?0:o.fluid));
      if(turned||shifted||fill!==previousFill){
        frame.z.set(back.z);frame.color.set(back.color);previousFill=fill;
        for(const [i,mesh] of [s.posterior,s.anterior].entries()){
          if(shifted&&fit.active)fitWall(mesh,i===0?-1:1,fit,dynamic![i]);
          projectCanal(mesh,fit.active?dynamic![i]:mesh.a,work,l,fill);triangles(frame,mesh,work);
        }
        if(fit.active)drawSleeve(fit,sleeve!,work,frame,l);
        img.data.set(frame.color);ic!.putImageData(img,0,0);
      }
    }else{
      frame.z.set(back.z);frame.color.set(back.color);
      for(let i=0;i<4;i++){const mesh=meshes![i],tissue=i===3&&o.tissue?wall.forDate(mesh,o.tissue):undefined;
        projectMesh(mesh,work,l,o,i<2,tissue);triangles(frame,mesh,work,l.cut);}
      if(sectioning&&near){const c=frame.color,n=near.color;for(let i=0;i<near.z.length;i++)if(near.z[i]>frame.z[i]){const j=4*i;
        c[j]=mix(c[j],n[j],l.nearAlpha);c[j+1]=mix(c[j+1],n[j+1],l.nearAlpha);c[j+2]=mix(c[j+2],n[j+2],l.nearAlpha);}}
      img.data.set(frame.color);ic!.putImageData(img,0,0);
    }
    ctx.save();ctx.translate(o.x,o.y);ctx.beginPath();ctx.rect(0,0,o.width,o.height);ctx.clip();
    ctx.drawImage(canvas,0,0,o.width,o.height);const logical=lens(o.width,o.height,yaw,canal);
    if(o.labels&&!canal){
      // Label endpoints follow the deformed surface, not fixed screen points.
      const m4=meshes![3],iRow=Math.round((1.94+1.618)/6.437*(m4.rows-1))*m4.cols;
      let best=0,idx=iRow+Math.floor(m4.cols*.72);
      for(let i=iRow+Math.floor(m4.cols*.50);i<iRow+m4.cols;i++){const j=i*stride+10,weight=mix(m4.a[j],m4.b[j],l.cut);if(weight>best){best=weight;idx=i;}}
      const pt=(i:number):V=>[work[i*N]*o.width/w,work[i*N+1]*o.height/h,work[i*N+2]];
      annotations(ctx,logical,o,pt(idx),pt(Math.round((2.82+1.618)/6.437*(m4.rows-1))*m4.cols+Math.round(m4.cols*.17)));
    }
    sampleMark(ctx,logical,o);ctx.restore();
  },dispose(){canvas=null;ic=null;frame=back=near=undefined;img=undefined;meshes=undefined;cut=undefined;dynamic=undefined;sleeve=undefined;contact=undefined;
    wall.clear();work=new Float32Array(0);lastYaw=NaN;}};
}
