import { Vector3 } from 'three';
import { pelvicCenterline, projectDepth, tangent } from './path';
import type { PelvicXYZ } from './contract';
import type { PelvicProfile, PelvicSample } from './stateTypes';

export type SectionAngle = 'front'|'side'|'oblique'|number;
export const sectionYaw = { front:0, oblique:.66, side:Math.PI/2 } as const;
export const SECTION_W = 344, SECTION_H = 282;
export const plot = { left:74, right:338, top:28, bottom:195 } as const;
export const canalPlot = { left:174, right:338, top:39, bottom:215 } as const;
export type Point = { x:number; y:number };
const mix = (a:number,b:number,t:number) => a+(b-a)*t;
// Upright illustration of the calibrated socket. X stays lateral, +Z is OUT.
// The tilt is a rigid change of drawing basis, never a change to a sample.
const pitch = .91, c = Math.cos(pitch), s = Math.sin(pitch);
const up = (p:Vector3) => c*p.y-s*p.z, anterior = (p:Vector3) => s*p.y+c*p.z;

type Ring = { t:number; center:Vector3; normal:Vector3; width:number; thick:number; openX:number; openN:number; sag:number; crownX:number };
const fundalInset=(r:Ring,x:number)=>r.sag*Math.max(0,1-(x/r.crownX)**2);
type Key = readonly [at:number, width:number, thick:number, openX:number, openN:number];
function loft(center:(t:number)=>Vector3, normal:(t:number)=>Vector3, keys:Key[]) {
  const rings:Ring[]=[];
  keys.forEach((a,i)=>{
    const b=keys[i+1]??a, n=i===keys.length-1?1:Math.max(3,Math.ceil((b[0]-a[0])*18));
    for(let j=0;j<n;j++) {
      const k=j/n, t=mix(a[0],b[0],k),before=keys[Math.max(0,i-1)],after=keys[Math.min(keys.length-1,i+2)];
      // Monotone Hermite interpolation: no ripples at the knots, and no
      // negative radii at the closed fundus or where the cavity ends.
      const value=(ch:1|2|3|4)=>{
        if(a===b)return a[ch];const d=b[ch]-a[ch],dt=b[0]-a[0];
        const slope=(p:Key,q:Key)=>p===q?d:(q[ch]-p[ch])*dt/(q[0]-p[0]);
        const harmonic=(k:number)=>d*k<=0?0:2*d*k/(d+k);
        return mix(a[ch],b[ch],k*k*(3-2*k))+k*(1-k)*((1-k)*harmonic(slope(before,a))-k*harmonic(slope(b,after)));
      };
      rings.push({t,center:center(t),normal:normal(t),width:value(1),thick:value(2),openX:value(3),openN:value(4),sag:0,crownX:1});
    }
  });
  return rings;
}

/** Illustration in metres, not an extension of the rail. The two adjacent
 * lofts share the same section at the stop and isthmus; only the canal has a
 * calibrated traversable centreline. Outer wall, cut face and lumen have
 * independent transverse and AP dimensions. */
function anatomy(l:number,r:number,entryFocus:boolean) {
  const frame={lengthM:l}, stop=pelvicCenterline(frame,l), axis=tangent(frame,l,new Vector3()), n=new Vector3(0,-axis.z,axis.y);
  const distal=(axial:number,x:number,forward:number)=>stop.clone().addScaledVector(axis,axial).addScaledVector(n,forward).setX(x);
  const canal=loft(t=>pelvicCenterline(frame,l*t),t=>{const v=tangent(frame,l*t,new Vector3());return new Vector3(0,-v.z,v.y);},[
    [0,1.18*r,1.18*r,r,r],[.13,1.12*r,1.03*r,.85*r,.74*r],
    [.72,.99*r,1.05*r,.79*r,.76*r],[.91,1.05*r,1.09*r,.74*r,.77*r],[1,.78*r,.84*r,.40*r,.41*r],
  ]);
  const neck=.23*l;
  const cervix=loft(t=>distal(neck*t,0,0),()=>n,[
    [0,.78*r,.84*r,.10*r,.08*r],[.24,.88*r,.84*r,.17*r,.12*r],
    [.72,.69*r,.69*r,.11*r,.09*r],[1,.75*r,.68*r,.12*r,.10*r],
  ]);
  const bodyLength=.94*l, breadth=.415*l+.68*r, thickness=.15*l+.41*r;
  const bodyAt=(t:number)=>distal(neck+bodyLength*t,0,.29*l*t*t);
  const body=entryFocus?[]:loft(bodyAt,t=>{
    const dir=axis.clone().multiplyScalar(bodyLength).addScaledVector(n,.58*l*t).normalize();
    return new Vector3(0,-dir.z,dir.y);
  },[
    [0,.75*r,.68*r,.12*r,.10*r],[.20,.51*breadth,.79*thickness,.16*breadth,.12*thickness],
    [.54,.86*breadth,thickness,.40*breadth,.22*thickness],[.73,breadth,.99*thickness,.66*breadth,.27*thickness],
    [.84,.97*breadth,.90*thickness,.70*breadth,.21*thickness],[.91,.83*breadth,.73*thickness,0,0],
    [.97,.54*breadth,.48*thickness,0,0],[1,0,0,0,0],
  ]);
  // The cavity roof is lower at the midline than the two tubal corners. An
  // AP slice through that roof and a coronal slice do not have the same cap.
  for(const r of body){const k=Math.min(1,Math.max(0,(r.t-.46)/.43));r.sag=.15*l*k*k*(3-2*k);r.crownX=.70*breadth;}
  const root=bodyAt(.77), tubeAt=(side:number,x:number,h:number,f:number)=>root.clone().addScaledVector(axis,h*l)
    .addScaledVector(n,f*l).setX(side*x*breadth);
  const adnexa=entryFocus?[]:[-1,1].map(side=>{
    const p=(x:number,h:number,f:number)=>tubeAt(side,x,h,f);
    // Tubal isthmus → rising ampulla → recurved infundibulum and fimbriae.
    const tube=[p(.76,0,0),p(1.20,.018,-.018),p(1.27,.26,-.06),p(1.63,.18,-.10),
      p(2.00,.14,-.14),p(2.03,-.03,-.07),p(1.82,-.12,.025)];
    const fringe=Array.from({length:5},(_,i)=>{
      const k=i/4; return [tube[6],p(1.79+.10*k,-.15,.04),p(1.61+.43*k,-.18-.08*k,.04+.09*k),p(1.58+.46*k,-.245-.045*Math.sin(k*Math.PI),.02+.13*k)];
    });
    const ovary=p(1.60,-.245,.105), long=axis.clone().multiplyScalar(-.124*l).setX(side*.126*l);
    const short=axis.clone().multiplyScalar(.081*l).setX(side*.079*l), deep=n.clone().multiplyScalar(.092*l);
    return {tube,fringe,ovary,axes:[long,short,deep]};
  });
  // Fit the full turn once, rather than resizing the ruler as the view turns
  // or a tracked tool leaves the chart. Include a little of the exterior.
  const bounds=[new Vector3(0,0,entryFocus?l*.38:Math.min(.033,l*.27))];
  for(const ring of [...canal,...cervix,...body])for(const u of [-1,1])for(const v of [-1,1])
    bounds.push(ring.center.clone().addScaledVector(ring.normal,v*ring.thick).setX(u*ring.width));
  for(const a of adnexa){bounds.push(...a.tube,...a.fringe.flat());for(const v of a.axes)bounds.push(a.ovary.clone().add(v),a.ovary.clone().sub(v));}
  function fit(points:Vector3[],box:typeof plot|typeof canalPlot){
    const zs=points.map(anterior),ys=points.map(up),az=(Math.min(...zs)+Math.max(...zs))/2,lo=Math.min(...ys),hi=Math.max(...ys);
    const extent=Math.max(...points.map(p=>Math.hypot(p.x,anterior(p)-az)));
    return {az,uy:(lo+hi)/2,scale:Math.min((box.right-box.left-12)/(2*extent),(box.bottom-box.top-10)/(hi-lo))};
  }
  const yrange=(rings:Ring[])=>{
    const edges:number[]=[];for(const r of rings){
      if(!r.sag){const center=up(r.center),half=Math.abs(up(r.normal)*r.openN);edges.push(center-half,center+half);if(!r.openX)break;continue;}
      for(let i=0;i<64;i++){const a=i*Math.PI/32;edges.push(up(r.center)+up(r.normal)*r.openN*Math.sin(a)-
        (s*r.normal.y+c*r.normal.z)*fundalInset(r,r.openX*Math.cos(a)));}
      if(!r.openX)break;
    }
    return [Math.min(...edges),Math.max(...edges)] as const;
  };
  return {canal,cervix,body,adnexa,stop,fit:fit(bounds,entryFocus?canalPlot:plot),canalLevel:yrange(canal),bodyLevel:entryFocus?[0,0] as const:yrange(body)};
}
// Bounded to the handful of actors in a room. A turn reuses the 3-D lofts;
// no image buffers or per-angle frames accumulate here.
const models=new Map<string,ReturnType<typeof anatomy>>();
// Decomposing the animated anchor can wobble in the last few IEEE digits
// despite identical scale. Ignore sub-nanometre fit noise in the art cache;
// never quantise the observed coordinates or the continuous heading.
const dimensionKey=(l:number,r:number)=>`${l.toPrecision(10)}/${r.toPrecision(10)}`;
function model(l:number,r:number,entryFocus:boolean){
  const key=`${dimensionKey(l,r)}/${+entryFocus}`;let m=models.get(key);
  if(!m){m=anatomy(l,r,entryFocus);if(models.size>=4)models.delete(models.keys().next().value!);models.set(key,m);}
  return m;
}

function buildLayout(lengthM:number,radiusM:number,yaw:number,entryFocus:boolean) {
  const co=Math.cos(yaw),si=Math.sin(yaw),m=model(lengthM,radiusM,entryFocus);
  const fit=m.fit,box=entryFocus?canalPlot:plot;
  const pxPerM=fit.scale, cx=(box.left+box.right)/2-si*fit.az*pxPerM,cy=(box.top+box.bottom)/2+fit.uy*pxPerM;
  const project=(x:number,y:number,z:number):Point=>({x:cx+pxPerM*(co*x+si*(s*y+c*z)),y:cy-pxPerM*(c*y-s*z)});
  const depth=(p:Vector3)=>co*anterior(p)-si*p.x;
  const screen=(p:Vector3)=>project(p.x,p.y,p.z);
  function slice(r:Ring){
    // Support directions of the projected elliptical ring normal to the
    // projected axis. Rotate its two radii together: a side cut sees AP
    // thickness, a frontal cut sees transverse width, 3/4 sees both.
    const ownUp=c*r.normal.y-s*r.normal.z, ownAnt=anterior(r.normal);
    const tx=si*(-c*r.normal.y+s*r.normal.z),ty=-(s*r.normal.y+c*r.normal.z);
    const a=co*r.width*(-ty),b=r.thick*(-ty*si*ownAnt-tx*ownUp);
    const h=Math.hypot(a,b)||1, cos=a/h,sin=b/h;
    const near=(-sin*(-si)*r.width+cos*co*ownAnt*r.thick)<0?-1:1;
    const center=screen(r.center);
    function at(u:number,v:number,lumen=false):Point {
      const dx=(cos*u-near*sin*v)*(lumen?r.openX:r.width),dn=(sin*u+near*cos*v)*(lumen?r.openN:r.thick);
      const inset=lumen?fundalInset(r,dx):0;
      return {x:center.x+pxPerM*(co*dx+si*ownAnt*dn-tx*inset),y:center.y-pxPerM*(ownUp*dn+ty*inset)};
    }
    return {center,at,t:r.t,open:r.openX>0};
  }
  const adnexa=m.adnexa.map(a=>{
    // Orthographic image of a rotated triaxial ellipsoid: eigensystem of its
    // projected covariance. End-on it shortens instead of flipping a sprite.
    let xx=0,xy=0,yy=0;for(const v of a.axes){const x=pxPerM*(co*v.x+si*anterior(v)),y=-pxPerM*up(v);xx+=x*x;xy+=x*y;yy+=y*y;}
    const d=Math.hypot(xx-yy,2*xy);
    return {tube:a.tube.map(screen),fringe:a.fringe.map(f=>f.map(screen)),at:screen(a.ovary),depth:depth(a.ovary),
      rx:Math.sqrt((xx+yy+d)/2),ry:Math.sqrt(Math.max(0,(xx+yy-d)/2)),roll:Math.atan2(2*xy,xx-yy)/2};
  }).sort((a,b)=>a.depth-b.depth);
  const levelY=(vessel:'canal'|'uterus',fraction:number)=>{const [lo,hi]=vessel==='canal'?m.canalLevel:m.bodyLevel;return cy-pxPerM*mix(lo,hi,fraction);};
  return {project,levelY,pxPerM,lengthM,radiusM,yaw,box,entryFocus,canal:m.canal.map(slice),cervix:m.cervix.map(slice),uterus:m.body.map(slice),adnexa,
    entry:project(0,0,0),stop:screen(m.stop)};
}
export type SectionLayout = ReturnType<typeof buildLayout>;
const layouts=new Map<string,SectionLayout>();
export function sectionLayout(lengthM:number,radiusM:number,angle:SectionAngle='side',entryFocus=false) {
  const yaw=typeof angle==='number'?angle:sectionYaw[angle],key=`${dimensionKey(lengthM,radiusM)}/${yaw}/${+entryFocus}`;
  let v=layouts.get(key);if(!v){v=buildLayout(lengthM,radiusM,yaw,entryFocus);if(layouts.size>=4)layouts.delete(layouts.keys().next().value!);layouts.set(key,v);}return v;
}
export type Slice = SectionLayout['canal'][number];

// Location relative to a real entrance or stop is useful even before admission.
// Only the solver can verify insertion. In particular an on-axis tip behind
// the plane after reacquisition is neither "inside" nor necessarily off-axis.
const observed=new Vector3(),center=new Vector3();
export function outletObservation(s:PelvicSample|null){
  if(!s)return 'waiting';
  if(s.outletInside)return s.atCervix?'stop':'inside';
  if(s.exteriorCovered)return 'coveredOutside';
  const [x,y,z]=s.tip;
  if(s.outletVisible){
    if(!s.aligned)return 'outsideOffset';
    return z<=Math.min(.004,s.radiusM*.14)&&Math.hypot(x,y)<=s.radiusM?'approach':'outside';
  }
  const d=projectDepth(s,observed.fromArray(s.tip));
  if(s.atCervix||d>s.lengthM+1e-6)return 'past';
  if(Math.abs(z)<=1e-6&&Math.hypot(x,y)<=s.radiusM)return 'plane';
  if(d>=0&&observed.distanceTo(pelvicCenterline(s,d,center))>s.radiusM)return 'offset';
  return 'unknown';
}
export const observationText={waiting:['等待杆位采样','Waiting for sample'],outside:['外侧 · 已对准','Outside · aligned'],outsideOffset:['外侧 · 未对准','Outside · off axis'],
  coveredOutside:['入口外 · 不外喷','Outside · no spray'],
  approach:['入口前 · 已对准','At rim · outside'],plane:['入口平面 · 未确认','At entry · unverified'],inside:['喷口在内','Outlet inside'],stop:['在内 · 抵达限位','Inside · at stop'],
  past:['越过限位 · 未确认','Past stop · unverified'],offset:['偏离通道 · 未确认','Off axis · unverified'],unknown:['未确认进入','Entry unverified']} as const;
export const outletLabel=(s:PelvicSample|null,zh:boolean,parked=false)=>s&&parked?(zh?'待命 · 实测杆位':'Parked · measured position'):observationText[outletObservation(s)][zh?0:1];

/** Projection is deliberately downstream of the solver and ledger. A
 * physically sampled but unverified nozzle is a point, not an admitted rod.
 * No inference from location, depth, an old sample or a slider. */
export function sectionEvidence(layout:SectionLayout,profile:PelvicProfile,sample:PelvicSample|null,parked=false){
  const state=!sample?'absent':parked?'parked':sample.outletInside?'inside':sample.outletVisible?'outside':'unverified';
  const point=(p:PelvicXYZ)=>layout.project(...p);
  const level=(k:keyof PelvicProfile['fluid'])=>Math.min(1,Math.max(0,profile.fluid[k]/profile.capacity[k]));
  const shaft=sample?.shaft;
  // A visible nozzle can face backwards; its exterior status does not verify
  // any of the mould sampled behind the plane. Only draw an all-exterior run.
  return {state,tip:sample&&point(sample.tip),shaft:shaft&&(state==='parked'||state==='inside'||state==='outside'&&shaft.every(p=>p[2]>=0))?shaft.map(point):[],
    depth:state==='inside'?sample!.depth:null,lateral:sample?.tip[0]??null,angle:sample?.angleDeg??null,atCervix:!parked&&(sample?.atCervix??false),
    vaginal:level('vaginal'),uterine:profile.container==='fantasyUterine'?level('fantasyUterine'):0};
}
