import { Vector3 } from 'three';
import type { PelvicSample } from '../stateTypes';
import type { PelvicXYZ } from '../contract';
import { pelvicCenterline, projectDepth, tangent } from '../path';
import { canalY, clamp, ENTRY, organMeshes, smooth, STOP, stride } from './model';
import type { Mesh, V } from './model';

export interface OrganArtOptions {
  x:number; y:number; width:number; height:number; yaw:number; time:number;
  /** Illustrative normalized tissue inputs, not physical measurements. */
  lining:number; shedding:number; pressure:number; zh:boolean;
  /** Selected balance / its OWN capacity. Optional second balance is vaginal. */
  fluid:number; fantasy:boolean; vaginalFluid?:number; sample?:PelvicSample|null;
}
export const organPigments={endometrium:'#f4b396',myometrium:'#d28177',ovary:'#e0c1a0',liquid:'#84c4be'} as const;
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
function lens(w:number,h:number,yaw:number){
  const ca=cos(yaw),sa=sin(yaw),a=Math.acos(clamp(abs(ca),0,1));
  const cut=smooth(.72,1.54,a),angle=cut*(sa<0?-1:1)*PI/2;
  const pitch=.095*abs(ca),cp=cos(pitch),sp=sin(pitch),scale=Math.min(w*.91/11.99,h*.88/8.78);
  return {ca,sa,cut,cp,sp,scale,dc:cos(yaw-angle),ds:sin(yaw-angle),
    ox:w*.5+.37*sa*scale,oy:h*.5+.45*scale,nearAlpha:1-smooth(.96,1.45,a),farAlpha:1-smooth(1.29,1.54,a)};
}
function point(l:Lens,x:number,y:number,z:number):V{
  const d=l.sa*x+l.ca*y;return [l.ox+(l.ca*x-l.sa*y)*l.scale,l.oy-(z*l.cp-d*l.sp)*l.scale,d*l.cp+z*l.sp];
}

// Smooth colour and depth interpolation; no graphics context or actor meshes.
// For the static adnexa, the depth/pigment buffers survive the entire rotation stop.
const N=6;
function triangles(p:Plate,mesh:Mesh,v:Float32Array,sectionMix=0){
  const {w,h,z,color}=p,ix=mesh.indices;
  const etch=mesh.etch,tex=etch?.[sectionMix>.5?1:0],ink=tex?.ink,tw=tex?.width??0,th=tex?.height??0,qu=(tw-1)/(mesh.cols-1),qv=(th-1)/(mesh.rows-1);
  for(let k=0;k<ix.length;k+=3){
    const ai=ix[k],bi=ix[k+1],ci=ix[k+2];
    const a=ai*N,b=bi*N,c=ci*N,ax=v[a],ay=v[a+1],ux=v[b]-ax,uy=v[b+1]-ay,vx=v[c]-ax,vy=v[c+1]-ay;
    const det=ux*vy-uy*vx;if(abs(det)<.00001)continue;
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
        color[4*i]=ra+u*ru+t*rv+mark*.87;color[4*i+1]=ga+u*gu+t*gv+mark;color[4*i+2]=ba+u*bu+t*bv+mark*.87;
      }
    }
  }
}
function projectMesh(mesh:Mesh,out:Float32Array,l:Lens,o:OrganArtOptions,vag:boolean){
  const a=mesh.a,b=mesh.b,section=mesh.section,q=section?l.cut:0,iq=1-q,dc=section?l.dc:l.ca,ds=section?l.ds:l.sa;
  const lining=sane(o.lining),shed=sane(o.shedding),pressure=sane(o.pressure),time=Number.isFinite(o.time)?o.time:0;
  const fill=vag?sane(o.vaginalFluid??(o.fantasy?0:o.fluid)):o.fantasy?sane(o.fluid):0;
  const level=vag?mix(ENTRY,STOP,fill):mix(.47,3.77,fill);
  let i=0,j=0;
  for(let row=0;row<mesh.rows;row++){
    const rowZ=a[i+2];
    const wave=section?(.5+.5*cos(rowZ*1.14-time*2.45))**4:0;
    const constr=section?(vag?.014:.042)*wave:0, lift=section?(vag?.018:.074)*wave:0;
    for(let col=0;col<mesh.cols;col++,i+=stride,j+=N){
      let x=a[i]*iq+b[i]*q,y=a[i+1]*iq+b[i+1]*q,z=a[i+2]*iq+b[i+2]*q;
      const xc=a[i+9]*iq+b[i+9]*q,lw=a[i+10]*iq+b[i+10]*q,lum=a[i+11]*iq+b[i+11]*q;
      if(section){x=x*(1-constr)-(x<0?-1:1)*lw*lining*.095;y=y*(1-constr)+lw*(.045+.08*lining);
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
      if(section){r+=lw*(lining*6-shed*19)+wave*2.6;g-=lw*shed*38;bl-=lw*shed*20;
        // Only a tagged lumen receives the actual compartment balance. No drops,
        // inferred flow, or retained fantasy balance in ordinary-mode uterus.
        const coverage=vag?smooth(.8,1.72,lum):smooth(.60,.92,lum);
        if(fill>0&&coverage>0){const wet=(1-smooth(level-.025,level+.025,z))*coverage;
          const rim=clamp(1-abs(z-level)/.085)*wet;r=mix(r,113+72*rim,wet*.88);g=mix(g,191+38*rim,wet*.88);bl=mix(bl,184+40*rim,wet*.88);}
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
    return point(l,p[0]/s.radiusM*.83,canalY(clamp(t))+offset*.55,ENTRY+(STOP-ENTRY)*t);
  };
  const tip=map(s.tip),k=Math.min(o.width/344,o.height/250),uncertain=!s.outletInside&&!s.outletVisible;
  if(!Number.isFinite(tip[0]+tip[1])||tip[0]<0||tip[1]<0||tip[0]>o.width||tip[1]>o.height)return;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
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
  let canvas:HTMLCanvasElement|OffscreenCanvas|null=null,ic:CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null=null;
  let frame:Plate|undefined,back:Plate|undefined,near:Plate|undefined,img:ImageData|undefined,lastYaw=NaN;
  let meshes:Mesh[]|undefined,work=new Float32Array(0);
  return {draw(ctx:CanvasRenderingContext2D,o:OrganArtOptions){
    if(!(o.width>0&&o.height>0))return;
    meshes??=organMeshes();
    if(!work.length)work=new Float32Array(Math.max(...meshes.map(m=>m.rows*m.cols))*N);
    const m=ctx.getTransform(),scale=Math.min(2.0,Math.max(1,Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)),680/o.width,540/o.height);
    // Measurement-view convention: at +90 degrees anterior points RIGHT.
    const w=Math.max(1,Math.round(o.width*scale)),h=Math.max(1,Math.round(o.height*scale)),yaw=Number.isFinite(o.yaw)?-o.yaw:0;
    if(!canvas||!frame||!back||!img||frame.w!==w||frame.h!==h){
      canvas??=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');
      canvas.width=w;canvas.height=h;ic=canvas.getContext('2d') as typeof ic;if(!ic)return;
      frame=plate(w,h);back=plate(w,h,true);near=undefined;img=ic.createImageData(w,h);lastYaw=NaN;
    }
    const l=lens(w,h,yaw);
    const sectioning=l.nearAlpha>0&&l.nearAlpha<1;
    if(yaw!==lastYaw){new Uint32Array(back.color.buffer).fill(0xff221721);back.z.fill(-1e4);
      if(sectioning){near??=plate(w,h);near.z.fill(-1e4);}
      for(const mesh of meshes)if(!mesh.section){const ipsi=mesh.wing===(l.sa<0?-1:1);
        if((ipsi?l.nearAlpha:l.farAlpha)===0)continue;
        projectMesh(mesh,work,l,o,false);triangles(ipsi&&sectioning?near!:back,mesh,work);}
      if(l.farAlpha<1&&l.farAlpha>0){const c=back.color;for(let i=0;i<back.z.length;i++)if(back.z[i]>-999){const j=4*i;
        c[j]=mix(33,c[j],l.farAlpha);c[j+1]=mix(23,c[j+1],l.farAlpha);c[j+2]=mix(34,c[j+2],l.farAlpha);}}
      lastYaw=yaw;
    }
    frame.z.set(back.z);frame.color.set(back.color);
    for(let i=0;i<4;i++){const mesh=meshes[i];projectMesh(mesh,work,l,o,i<2);triangles(frame,mesh,work,l.cut);}
    if(sectioning&&near){const c=frame.color,n=near.color;for(let i=0;i<near.z.length;i++)if(near.z[i]>frame.z[i]){const j=4*i;
      c[j]=mix(c[j],n[j],l.nearAlpha);c[j+1]=mix(c[j+1],n[j+1],l.nearAlpha);c[j+2]=mix(c[j+2],n[j+2],l.nearAlpha);}}
    // The leader lands on the actual moving luminal margin, including at the
    // in-between cut angles. Two labels leave enough room for 14px thumbnails.
    const m4=meshes[3],iRow=Math.round((1.94+1.618)/6.437*(m4.rows-1))*m4.cols;
    let best=0,idx=iRow+Math.floor(m4.cols*.72);
    for(let i=iRow+Math.floor(m4.cols*.50);i<iRow+m4.cols;i++){const j=i*stride+10,weight=mix(m4.a[j],m4.b[j],l.cut);if(weight>best){best=weight;idx=i;}}
    const logicalPt=(i:number):V=>[work[i*N]*o.width/w,work[i*N+1]*o.height/h,work[i*N+2]];
    const liningPt=logicalPt(idx),musclePt=logicalPt(Math.round((2.82+1.618)/6.437*(m4.rows-1))*m4.cols+Math.round(m4.cols*.17));
    img.data.set(frame.color);ic!.putImageData(img,0,0);
    ctx.save();ctx.translate(o.x,o.y);ctx.beginPath();ctx.rect(0,0,o.width,o.height);ctx.clip();
    ctx.drawImage(canvas,0,0,o.width,o.height);const logical=lens(o.width,o.height,yaw);
    annotations(ctx,logical,o,liningPt,musclePt);sampleMark(ctx,logical,o);ctx.restore();
  },dispose(){canvas=null;ic=null;frame=back=near=undefined;img=undefined;meshes=undefined;work=new Float32Array(0);lastYaw=NaN;}};
}
