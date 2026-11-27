import { PELVIC_LIMITS, type PelvicSample } from '../stateTypes';
import {defaultPelvicCalibration} from '../contract';
import {semenColor,semenRGB} from '../../play/semenAppearance';
import { canalY, cavityColumn, clamp, ENTRY, organMeshes, ovary, tubePath, smooth, STOP, stride } from './model';
import {canalBands,canalStudy,type CanalStudy} from './canalGeometry';
import {createCanalContact,fitWall,type CanalContact} from './canalContact';
import {createOverviewTract} from './overviewTract';
import type { Mesh, V } from './model';
import type {EndometrialTissue} from '../../bodyState/data';
import {createWallStudy,wallStride} from './uterineWall';
import {cavityDistension,cavityLevel,cavitySurface,createCanalLiquid} from './retainedFluid';
import {drawEncounter,drawTransit} from './reproductionArt';
import type {ConceptionEvent,Ovum} from '../../bodyState/reproduction/game';
import {createExteriorStudy} from './exteriorStudy';
import type {FoldStyle,RimState} from '../vulvaForm';

export interface OrganArtOptions {
  x:number; y:number; width:number; height:number; yaw:number; time:number;
  focus?:'uterus'|'vagina'|'vulva'|'egg';
  /** Actor reference metres. The sample's world-metre ruler also includes placement scale. */
  canalLengthM?:number;
  event?:ConceptionEvent;encounterSeconds?:number;egg?:Ovum;
  foldStyle?:FoldStyle;rim?:RimState;exteriorDisplayScale?:number;
  /** Illustrative normalized tissue inputs, not physical measurements. */
  lining:number; shedding:number; pressure:number; zh:boolean; tissue?:EndometrialTissue; labels?:boolean;
  /** Caption metadata and the two independent retained/capacity fractions. */
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
type CanalFraming={frontPitch:number;sidePitch:number;width:number;height:number;lateral:number};
const focusedFraming:CanalFraming={frontPitch:-.13,sidePitch:-.0975,width:.80,height:.89,lateral:-.12};
const referenceLength=defaultPelvicCalibration.lengthM;
// The vault above the cervical stop translates intact rather than growing with the canal.
function canalHeight(z:number,stretch:number){return z+(stretch-1)*clamp(z-ENTRY,0,STOP-ENTRY);}
function lens(w:number,h:number,yaw:number,canal?:CanalFraming,stretch=1){
  const ca=cos(yaw),sa=sin(yaw),a=Math.acos(clamp(abs(ca),0,1));
  const cut=smooth(.72,1.54,a),angle=cut*(sa<0?-1:1)*PI/2;
  const pitch=canal?mix(canal.sidePitch,canal.frontPitch,abs(ca)):.095*abs(ca),cp=cos(pitch),sp=sin(pitch);
  let scale=Math.min(w*.91/11.99,h*.88/8.78),ox=w*.5+.37*sa*scale,oy=h*.5+.45*scale;
  if(canal){
    // Ease back on the longer studies while reserving visibly less height
    // for a short canal. Fitting every length to the same box hides the edit.
    const [min,max]=PELVIC_LIMITS.lengthM,travel=(stretch*referenceLength-min)/(max-min);
    const extent=3.6+(stretch-1)*(STOP-ENTRY);
    scale=Math.min(w*canal.width/3.1,h*canal.height*mix(.74,1,travel)/extent);
    // Register the camera on the same entrance in front, oblique and side views.
    const entryY=canalY(0);
    ox=w*(.5+canal.lateral*sa/3.1)+entryY*sa*scale;
    oy=h*.91+(ENTRY*cp-entryY*ca*sp)*scale;
  }
  return {ca,sa,cut,cp,sp,scale,dc:cos(yaw-angle),ds:sin(yaw-angle),
    ox,oy,nearAlpha:1-smooth(.96,1.45,a),farAlpha:1-smooth(1.29,1.54,a)};
}
function point(l:Lens,x:number,y:number,z:number):V{
  const d=l.sa*x+l.ca*y;return [l.ox+(l.ca*x-l.sa*y)*l.scale,l.oy-(z*l.cp-d*l.sp)*l.scale,d*l.cp+z*l.sp];
}

// Smooth colour and depth interpolation; no graphics context or actor meshes.
// For the static adnexa, the depth/pigment buffers survive the entire rotation stop.
const N=6;
type Topology=Pick<Mesh,'indices'|'etch'|'cols'|'rows'>;
function triangles(p:Plate,mesh:Topology,v:Float32Array,sectionMix=0,indexCount=mesh.indices.length,opacity=1,firstIndex=0){
  const {w,h,z,color}=p,ix=mesh.indices;
  const etch=mesh.etch,tex=etch?.[sectionMix>.5?1:0],ink=tex?.ink,tw=tex?.width??0,th=tex?.height??0,qu=(tw-1)/(mesh.cols-1),qv=(th-1)/(mesh.rows-1);
  for(let k=firstIndex;k<indexCount;k+=3){
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
// plates. The overview tract also supplies actual world-space positions here.
function projectCanal(mesh:Mesh,data:Float32Array,out:Float32Array,l:Lens,stretch=1){
  for(let i=0,j=0;i<data.length;i+=stride,j+=N){
    const x=data[i],y=data[i+1],restZ=data[i+2],z=canalHeight(restZ,stretch),d=x*l.sa+y*l.ca;
    out[j]=l.ox+(x*l.ca-y*l.sa)*l.scale;out[j+1]=l.oy-(z*l.cp-d*l.sp)*l.scale;out[j+2]=d*l.cp+z*l.sp;
    let nx=data[i+3]*l.ca-data[i+4]*l.sa,front=data[i+3]*l.sa+data[i+4]*l.ca,nz=data[i+5];
    if(stretch!==1&&restZ>ENTRY&&restZ<STOP){
      nz/=stretch;const norm=1/(sqrt(nx*nx+front*front+nz*nz)||1);nx*=norm;front*=norm;nz*=norm;
    }
    let up=nz*l.cp-front*l.sp;front=front*l.cp+nz*l.sp;if(front<0){nx=-nx;up=-up;front=-front;}
    const diffuse=clamp(.35-.39*nx+.48*up+.43*front),gloss=mesh.a[i+11];
    // The long softbox breaks into small highlights as the fold tips turn;
    // only the exposed epithelium carries the sharp reflection. The broad
    // diffuse lobes and warm backscatter describe bulk on the cut surfaces.
    const half=clamp(-.31*nx+.37*up+.875*front),spec=half*half,glint=spec*spec*spec*spec;
    const stripe=clamp(1-abs(up-.37)*5.8)*clamp(.62-.60*nx+.46*front),sheen=stripe*stripe;
    const shine=glint*glint*(3+gloss*13)+gloss*(40*sheen*sheen+7*glint),bounce=(1-front)*(1-diffuse)*16;
    const r=data[i+6],g=data[i+7],b=data[i+8];
    out[j+3]=r*(.72+.28*diffuse)+shine+bounce;out[j+4]=g*(.64+.36*diffuse)+shine*.84;out[j+5]=b*(.68+.32*diffuse)+shine*.73+bounce*.59;
  }
}

// The cutaway paints the same mould that parts the walls. A satin silicone
// highlight is distinct from the finer wet reflections on living tissue.
const sleeveSides=28,sleeveCols=sleeveSides+1;
const sleeveCircle=Array.from({length:sleeveCols},(_,i)=>[cos(i*2*PI/sleeveSides),sin(i*2*PI/sleeveSides)]);
function sleeveTopology():Topology{
  const rows=canalBands+2,indices=new Uint32Array((rows-1)*sleeveSides*6);
  for(let j=0,k=0;j<rows-1;j++)for(let i=0;i<sleeveSides;i++){
    const a=j*sleeveCols+i;indices.set([a,a+1,a+sleeveCols,a+1,a+sleeveCols+1,a+sleeveCols],k);k+=6;
  }return {cols:sleeveCols,rows,indices};
}
function drawSleeve(contact:CanalContact,mesh:Topology,out:Float32Array,p:Plate,l:Lens,overview=false,stretch=1){
  const rows=contact.rings((row,restZ,x,y,rx,ry,shear)=>{
    const z=canalHeight(restZ,stretch);
    for(let i=0,j=row*sleeveCols*N;i<sleeveCols;i++,j+=N){const [cx,cy]=sleeveCircle[i],sx=x+cx*rx,sy=y+cy*ry+cx*rx*shear,d=sx*l.sa+sy*l.ca;
      out[j]=l.ox+(sx*l.ca-sy*l.sa)*l.scale;out[j+1]=l.oy-(z*l.cp-d*l.sp)*l.scale;out[j+2]=d*l.cp+z*l.sp;
    }
  });if(rows<2)return;
  // Light the true crown: its radius and centre change along the measured
  // shaft. A circular swatch lit only around its axis reads as a flat strip.
  const inv=1/l.scale;
  for(let row=0;row<rows;row++)for(let i=0;i<sleeveCols;i++){
    const idx=row*sleeveCols,k=(idx+i)*N,prev=(idx+(i+sleeveSides-1)%sleeveSides)*N,next=(idx+(i+1)%sleeveSides)*N;
    const lo=(Math.max(0,row-1)*sleeveCols+i)*N,hi=(Math.min(rows-1,row+1)*sleeveCols+i)*N;
    const ax=(out[next]-out[prev])*inv,ay=(out[prev+1]-out[next+1])*inv,az=out[next+2]-out[prev+2];
    const bx=(out[hi]-out[lo])*inv,by=(out[lo+1]-out[hi+1])*inv,bz=out[hi+2]-out[lo+2];
    const x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx,n=(z<0?-1:1)/(Math.hypot(x,y,z)||1);
    const nx=x*n,ny=y*n,nz=z*n,lam=clamp(.49-.39*nx+.28*ny+.40*nz),shine=clamp(-.43*nx+.37*ny+.81*nz)**19;
    // Dusty mauve in the shadow and a broad pearl highlight, as on the
    // model's moulded outer coat. White remains identifiable as retained fluid.
    if(overview){
      // Narrow full-figure window: a long satin highlight and cooler shadow
      // separate the round silicone from the two warm, wet cut margins.
      const strip=clamp(1-abs(nx+.32)*2.55)*nz,pearl=28*strip*strip;
      out[k+3]=79+93*lam+35*shine+pearl;out[k+4]=62+66*lam+31*shine+pearl;out[k+5]=99+74*lam+32*shine+pearl;
    }else{out[k+3]=115+86*lam+34*shine;out[k+4]=65+83*lam+43*shine;out[k+5]=92+77*lam+40*shine;}
  }
  triangles(p,mesh,out,0,(rows-1)*sleeveSides*6,overview?1:.88);
}
function projectMesh(mesh:Mesh,out:Float32Array,l:Lens,o:OrganArtOptions,vag:boolean,wall?:readonly [Float32Array,Float32Array],first=0,end=mesh.rows,cervicalContact=false){
  const a=mesh.a,b=mesh.b,section=mesh.section,q=section?l.cut:0,iq=1-q,dc=section?l.dc:l.ca,ds=section?l.ds:l.sa;
  const lining=sane(o.lining),shed=sane(o.shedding),pressure=sane(o.pressure),time=Number.isFinite(o.time)?o.time:0;
  const fill=vag&&o.focus==='uterus'?0:sane((vag?o.vaginalFluid:o.uterineFluid)??0);
  const level=vag?mix(ENTRY,STOP,fill):cavityLevel(fill),pool={height:0,opacity:0,pearl:0};
  const start=first*mesh.cols;
  let i=start*stride,j=start*N,k=start*wallStride;
  for(let row=first;row<end;row++){
    const rowZ=a[i+2];
    const wave=section&&o.focus!=='uterus'?(.5+.5*cos(rowZ*1.14-time*2.45))**4:0;
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
        if(!vag&&fill>0&&mesh.etch){const u=cavityColumn(col/(mesh.cols-1));
          if(q>0)x+=q*cavityDistension(level,z,u);
          if(lum>0){cavitySurface(pool,level,z,u,lum);y+=pool.height;}}
        if(cervicalContact){const press=1-smooth(STOP-.08,STOP+.39,z);x*=1+.13*press;z+=.095*press;}
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
        if(fill>0&&lum>0){const alpha=vag?(1-smooth(level-.03,level+.03,z))*smooth(.8,1.72,lum)*.91:pool.opacity;
          const pearl=vag?0:pool.pearl;
          r=mix(r,semenRGB[0]+pearl*.74,alpha);g=mix(g,semenRGB[1]+pearl,alpha);bl=mix(bl,semenRGB[2]+pearl,alpha);}
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
  if(front){const s=l.ca>=0?-1:1;call(point(l,...ovary(s)),o.zh?'卵巢':'Ovary',false,h*.48,organPigments.ovary);
    if(o.focus==='uterus')call(point(l,...tubePath(.48,s)),o.zh?'输卵管':'Tube',false,h*.077,organPigments.myometrium);}
  if(o.focus==='uterus')call(point(l,0,1.3,4.1),o.zh?'子宫':'Uterus',true,h*.44,organPigments.myometrium);
  if(o.labels&&l.ca>-.25)call(liningPt,o.zh?'子宫内膜':'Endometrium',true,h*.63,organPigments.endometrium);
  if(o.labels&&!front)call(musclePt,o.zh?'子宫肌层':'Myometrium',false,h*.32,organPigments.myometrium);
}

function labelPoints(mesh:Mesh,work:Float32Array,l:Lens,sx:number,sy:number):[V,V]{
  const iRow=Math.round((1.94+1.618)/6.437*(mesh.rows-1))*mesh.cols;let best=0,idx=iRow+Math.floor(mesh.cols*.72);
  for(let i=iRow+Math.floor(mesh.cols*.50);i<iRow+mesh.cols;i++){const j=i*stride+10,weight=mix(mesh.a[j],mesh.b[j],l.cut);if(weight>best){best=weight;idx=i;}}
  const pt=(i:number):V=>[work[i*N]*sx,work[i*N+1]*sy,work[i*N+2]];
  return [pt(idx),pt(Math.round((2.82+1.618)/6.437*(mesh.rows-1))*mesh.cols+Math.round(mesh.cols*.17))];
}

const neckSeam=(m:Mesh)=>Math.ceil((STOP+.40+1.618)/6.437*(m.rows-1));
function veil(p:Plate,near:Plate,alpha:number){
  const c=p.color,n=near.color;for(let i=0;i<near.z.length;i++)if(near.z[i]>p.z[i]){const j=4*i;
    c[j]=mix(c[j],n[j],alpha);c[j+1]=mix(c[j+1],n[j+1],alpha);c[j+2]=mix(c[j+2],n[j+2],alpha);}
}

/** One owner per DOM canvas / HUD texture. Reuses model topology and CPU depth
 * buffers; the caller's current canvas transform, clip and alpha are respected. */
export function createOrganArt(canalFraming:CanalFraming=focusedFraming){
  const wall=createWallStudy(),exterior=createExteriorStudy();
  let canvas:HTMLCanvasElement|OffscreenCanvas|null=null,ic:CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D|null=null;
  let frame:Plate|undefined,back:Plate|undefined,near:Plate|undefined,img:ImageData|undefined,lastYaw=NaN;
  let meshes:Mesh[]|undefined,work=new Float32Array(0),lastFocus:OrganArtOptions['focus'];
  let cut:CanalStudy|undefined,liquid:ReturnType<typeof createCanalLiquid>|undefined,contact:CanalContact|undefined,dynamic:Float32Array[]|undefined,sleeve:Topology|undefined,previousFill=NaN;
  let previousStretch=NaN;
  let overview:ReturnType<typeof createOverviewTract>|undefined,overviewKey='',labelAnchors:[V,V]|undefined,lastPress=false;
  return {draw(ctx:CanvasRenderingContext2D,o:OrganArtOptions){
    if(!(o.width>0&&o.height>0))return;
    if(o.focus==='vulva'){exterior(ctx,o);return;}
    if(o.focus==='egg'){
      ctx.save();ctx.translate(o.x,o.y);drawEncounter(ctx,o.egg,o.width,o.height,o.zh,o.encounterSeconds,o.yaw*180/PI);ctx.restore();return;
    }
    const canal=o.focus==='vagina',whole=o.focus==='uterus';
    const stretch=canal&&o.canalLengthM!==undefined&&Number.isFinite(o.canalLengthM)?clamp(o.canalLengthM,...PELVIC_LIMITS.lengthM)/referenceLength:1;
    if(canal||whole){contact??=createCanalContact();sleeve??=sleeveTopology();}
    if(canal){
      if(!cut){cut=canalStudy();liquid=createCanalLiquid(cut);dynamic=[cut.posterior.a.slice(),cut.anterior.a.slice()];}
      const size=cut.anterior.rows*cut.anterior.cols*N;if(work.length<size)work=new Float32Array(size);
    }else if(!meshes){meshes=organMeshes();const size=Math.max(...meshes.map(m=>m.rows*m.cols))*N;if(work.length<size)work=new Float32Array(size);}
    // Fold geometry and readings remain at their authored resolution. For the
    // small observation plate, 1.5× is enough for the shaded triangles; avoid
    // allocating two 2× depth/color surfaces on the first headset frame.
    if(whole)overview??=createOverviewTract();
    const m=ctx.getTransform(),scale=Math.min(canal?1.5:2.0,Math.max(1,Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)),680/o.width,540/o.height);
    // Measurement-view convention: at +90 degrees anterior points RIGHT.
    const w=Math.max(1,Math.round(o.width*scale)),h=Math.max(1,Math.round(o.height*scale)),yaw=Number.isFinite(o.yaw)?-o.yaw:0;
    if(!canvas||!frame||!back||!img||frame.w!==w||frame.h!==h){
      canvas??=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');
      canvas.width=w;canvas.height=h;ic=canvas.getContext('2d') as typeof ic;if(!ic)return;
      frame=plate(w,h);back=plate(w,h,true);near=undefined;img=ic.createImageData(w,h);lastYaw=NaN;
    }
    const framing=canal?canalFraming:undefined,l=lens(w,h,yaw,framing,stretch);
    const sectioning=!canal&&l.nearAlpha>0&&l.nearAlpha<1;
    const pageChanged=o.focus!==lastFocus,turned=yaw!==lastYaw||pageChanged;
    // A moving mould does not invalidate the corpus or the adnexa. Keep the
    // ledger/tissue in the same cached depth plate as the organ. Workers receive
    // structured clones, so use the tissue values rather than object identity.
    const tissue=o.tissue,key=whole?[o.lining,o.shedding,o.uterineFluid??0,tissue?.functionalDepth,tissue?.breakdown,tissue?.glandCoil,tissue?.vesselCoil,o.width/w,o.height/h].join('|'):'';
    const newBase=turned||whole&&key!==overviewKey||canal&&stretch!==previousStretch;
    if(newBase){new Uint32Array(back.color.buffer).fill(0xff221721);back.z.fill(-1e4);
      if(sectioning){near??=plate(w,h);near.z.fill(-1e4);}
      if(canal){for(const mesh of [cut!.commissure,cut!.vault,cut!.fornix,cut!.cervix]){projectCanal(mesh,mesh.a,work,l,stretch);triangles(back,mesh,work);}}
      else for(const mesh of meshes!)if(!mesh.section){const ipsi=mesh.wing===(l.sa<0?-1:1);
        if((ipsi?l.nearAlpha:l.farAlpha)===0)continue;
        projectMesh(mesh,work,l,o,false);triangles(ipsi&&sectioning?near!:back,mesh,work);}
      if(!canal&&l.farAlpha<1&&l.farAlpha>0){const c=back.color;for(let i=0;i<back.z.length;i++)if(back.z[i]>-999){const j=4*i;
        c[j]=mix(33,c[j],l.farAlpha);c[j+1]=mix(23,c[j+1],l.farAlpha);c[j+2]=mix(34,c[j+2],l.farAlpha);}}
      if(whole){
        for(let i=2;i<4;i++){
          const mesh=meshes![i],first=neckSeam(mesh);projectMesh(mesh,work,l,o,false,i===3&&tissue?wall.forDate(mesh,tissue):undefined,first);
          triangles(back,mesh,work,l.cut,mesh.indices.length,1,first*(mesh.cols-1)*6);
          if(i===3)labelAnchors=labelPoints(mesh,work,l,o.width/w,o.height/h);
        }
        // The wings overlap the fundus only. Blend once, on the same fixed
        // plate; strokes and the lower cervical lip are entirely inferior.
        if(sectioning&&near)veil(back,near,l.nearAlpha);
      }
      lastYaw=yaw;lastFocus=o.focus;overviewKey=key;previousStretch=stretch;
    }
    if(canal){
      const fit=contact!,s=cut!,shifted=fit.update(o.sample,o.parked),fill=sane(o.vaginalFluid??0);
      if(newBase||shifted||fill!==previousFill){
        frame.z.set(back.z);frame.color.set(back.color);previousFill=fill;
        for(const [i,mesh] of [s.posterior,s.anterior].entries()){
          if((shifted||pageChanged)&&fit.active)fitWall(mesh,i===0?-1:1,fit,dynamic![i]);
          projectCanal(mesh,fit.active?dynamic![i]:mesh.a,work,l,stretch);triangles(frame,mesh,work);
        }
        for(const m of liquid!.update(fill,fit.active?dynamic![0]:s.posterior.a,shifted||pageChanged)){projectCanal(m,m.a,work,l,stretch);triangles(frame,m,work);}
        if(fit.active)drawSleeve(fit,sleeve!,work,frame,l,false,stretch);
        img.data.set(frame.color);ic!.putImageData(img,0,0);
      }
    }else{
      const shifted=whole&&contact!.update(o.sample,o.parked);
      const press=whole&&!!o.sample?.atCervix&&contact!.active;
      if(!whole||newBase||shifted||lastPress!==press){
        frame.z.set(back.z);frame.color.set(back.color);
        if(whole){const tract=overview!,fit=contact!;
         const section=l.cut*PI/2*(l.sa<0?-1:1),data=tract.prepare(section,fit);
         projectCanal(tract.mesh,data,work,l);triangles(frame,tract.mesh,work);
         const atStop=press&&tract.tipZ>=STOP-(STOP-ENTRY)*1e-5/o.sample!.lengthM;
         for(let i=2;i<4;i++){const mesh=meshes![i],last=neckSeam(mesh);
           projectMesh(mesh,work,l,o,false,undefined,0,last+1,atStop);triangles(frame,mesh,work,l.cut,last*(mesh.cols-1)*6);}
          if(fit.active)drawSleeve(fit,sleeve!,work,frame,l,true);
        }else{
          for(let i=0;i<4;i++){const mesh=meshes![i],tissue=i===3&&o.tissue?wall.forDate(mesh,o.tissue):undefined;
            projectMesh(mesh,work,l,o,i<2,tissue);triangles(frame,mesh,work,l.cut);
            if(i===3&&o.labels)labelAnchors=labelPoints(mesh,work,l,o.width/w,o.height/h);}
          if(sectioning&&near)veil(frame,near,l.nearAlpha);
        }
        img.data.set(frame.color);ic!.putImageData(img,0,0);lastPress=press;
      }
    }
    ctx.save();ctx.translate(o.x,o.y);ctx.beginPath();ctx.rect(0,0,o.width,o.height);ctx.clip();
    ctx.drawImage(canvas,0,0,o.width,o.height);const logical=lens(o.width,o.height,yaw,framing,stretch);
    if((o.labels||whole)&&!canal&&labelAnchors)annotations(ctx,logical,o,...labelAnchors);
    if(o.focus==='uterus'&&o.event)drawTransit(ctx,o.event,v=>point(logical,...v),Math.min(o.width/344,o.height/282),o.encounterSeconds);
    ctx.restore();
  },dispose(){canvas=null;ic=null;frame=back=near=undefined;img=undefined;meshes=undefined;cut=undefined;liquid=undefined;dynamic=undefined;sleeve=undefined;contact=undefined;
    overview=undefined;labelAnchors=undefined;wall.clear();work=new Float32Array(0);lastYaw=NaN;}};
}
