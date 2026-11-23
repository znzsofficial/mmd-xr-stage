import {canalY,clamp,ENTRY,grid,smooth,STOP,stride,type Mesh,type V} from './model';
import {glazeFoldEdges} from './canalGlaze';

// One fixed longitudinal dissection. The anterior margin steps back just
// enough to show the posterior mucosa. The *intact* tissue behind this margin
// is apposed; turning the figure never chooses a new section or material.
const {abs,cos,exp,PI,sin,sqrt}=Math;
const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;
const bell=(u:number)=>exp(-u*u);
const dye=(a:V,b:V,k:number):V=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];
const tone=(a:V,d:number):V=>[a[0]+d,a[1]+d*.75,a[2]+d*.68];
export const canalBands=100, vaultEnd=1.29, mucosaEnd=5/12;
const divisions=96, mucosaCols=divisions*mucosaEnd;
const span=STOP-ENTRY;
// Cross-sections distinguish a rolled entrance, broader midbody and the
// narrowing vault. Only the opening-to-stop interval has measured stations.
export const canalStation=(row:number)=>row/canalBands*vaultEnd;
const width=(t:number)=>.63+.30*smooth(0,.12,t)-.13*smooth(.17,.39,t)+.12*bell((t-.16)/.095)+.25*smooth(.54,.94,t)-.25*smooth(1.02,vaultEnd,t);
const seamAxis=(t:number)=>canalY(clamp(t))-.095*smooth(.76,1.18,t);
// Authored groups, not a periodically repeated rib: centre, breadth, relief,
// curvature and lateral skew. Rugae crowd near the introitus and fade before
// the fornices. Positive and negative halves do not mirror the same fan.
const rugae=[
  [.051,.030,.140,.067,.035],[.143,.034,.192,.099,-.023],[.234,.036,.168,.127,.051],
  [.354,.045,.200,.146,.049],[.497,.047,.158,.087,-.064],[.657,.052,.117,.131,.058],[.795,.049,.072,.079,-.043],
];
const crestAt=(at:number,arc:number,skew:number,u:number)=>at+arc*(u*u-.27*bell((u+.19)/.27))+skew*u+.017*sin(5*u+at*14);
/** Bed of the same authored ruga sampled by the posterior mucosa. */
export function canalGroove(index:number,x:number,t:number){
  const [at,breadth,,arc,skew]=rugae[index];return crestAt(at,arc,skew,x/width(t))-.96*breadth;
}
function lining(u:number,t:number,folds:number[][],keelHeight:number){
  let ridge=0,trough=0,gleam=0;const track=u+.10+.099*sin(8*t),keel=keelHeight*bell(track/.17);
  for(const [at,breadth,h,arc,skew] of folds){
    const d=(t-crestAt(at,arc,skew,u))/breadth;
    if(d < -3||d>3)continue;
    const fade=clamp(.82-.12*u*u+.33*sin(5*u+at*14)),hump=h*fade;
    // A shorter leaflet forks off the left half and dies into the principal
    // crest. The right half keeps a different sweep down the central column.
    const spur=bell((u+.41+.12*sin(at*20))/.24)*bell((d+1.12-1.68*(u+.38))/.62);
    ridge+=hump*(bell(d*(d<0?1.12:.72))+.52*spur);trough+=hump*bell((d+.99)*1.48);
    gleam+=fade*(bell((d-.23)*2.45)*(.20+.80*bell((u+.32+.29*sin(at*32))/.27))+.41*spur);
  }
  const deep=smooth(.54,.96,t),fan=deep*(.055*bell((track+.36-.16*t)/.13)+.073*bell((track-.32+.10*t)/.17));
  return {height:keel+ridge-.34*trough+fan,crest:ridge,shadow:trough,gleam};
}
const berry:V=[126,36,67],peach:V=[251,147,147],fascia:V=[176,70,103],muscle:V=[191,68,93],lamina:V=[248,153,141];
export type WallSide=-1|1;
// All wall vertices use the same row stations, including the turned rim and
// cut face. Metadata in slots 9..11: apposed surface Y, compliance, mucosa.
function wall(side:WallSide):Mesh{
  const bands=Array.from({length:canalBands+1},(_,i)=>{
    const t=canalStation(i),w=width(t),deep=smooth(.78,1.21,t),vault=smooth(.86,1.18,t);
    const anteriorCut=(.12+.15*sin(t*5.7-.55)+.17*deep-.096*bell((t-.15)/.095))*w;
    const cut=side>0?anteriorCut:(-.86+.096*sin(t*6+.7)+.18*deep)*w;
    const edge=w*(.997-.10*smooth(1.10,1.29,t)),layer=(.33+.18*sin(clamp(t)*PI)+.17*bell((t-.13)/.14)+.074*bell((t-.59)/.12))*(side===1?.93:1.05);
    const round=sqrt((1-(1-clamp(t/.15))**2)*(1-smooth(1.20,vaultEnd,t)));
    const outerCut=cut+side*layer*(side<0?.58:.69)*round,core=seamAxis(t);
    const folds=rugae.filter(([at,b])=>t>at-3*b-.09&&t<at+3*b+.26);
    return {t,w,deep,vault,cut,edge,layer,round,outerCut,core,anteriorCut,folds,keel:.16*(1-smooth(.66,.96,t)),base:1-smooth(0,.18,t),cap:smooth(.99,1.29,t)};
  });
  const mesh=grid(divisions,canalBands,false,0,(u,v)=>{
    const {t,w,deep,vault,cut,edge,layer,round,outerCut,core,anteriorCut,folds,keel,base,cap}=bands[Math.round(v*canalBands)];
    let x:number,thick:number,cutFraction=-1;
    if(u<=mucosaEnd){x=lerp(cut,edge,u/mucosaEnd);thick=0;} // mucosa
    else if(u<=.75){const k=(u-mucosaEnd)*3;x=lerp(edge,outerCut,k);thick=1;} // outer envelope
    else{cutFraction=clamp((1-u)*4);x=lerp(cut,outerCut,cutFraction)-.086*round*sin(PI*cutFraction);thick=smooth(0,1,cutFraction);}
    const along=clamp((x-cut)/(edge-cut));
    // Round, opposed ends; the posterior vault ascends beyond the anterior
    // one and curls back over the cervix. Neither rim is a horizontal trim.
    const hood=side<0?.19:-.14,entry=base*(.13*(x/w)**2+.061*sin(4*x/w+.12)+.023*side-.075*thick*round);
    const crown=cap*(hood-.25*along*along-.12*thick*round);
    const z=ENTRY+span*t+entry+crown,outerRound=sqrt(Math.max(0,1-along**3));
    const bed=lining(x/w,t,folds,keel),pocket=(side>0?.42:.56)*vault*(1-.18*along*along);
    const radial=Math.hypot((x+.21)/.59,(z-STOP-.19)/.37),vaultRim=side<0?bell((radial-1.18)/.28):0,recess=side<0?bell((radial-.80)/.22):0;
    const inner=core+bed.height+side*(.006+pocket)+.13*vaultRim-.10*recess;
    const pillow=layer+.075*bell((x/w-.59+.10*sin(8*t))/.29)-.067*bell((x/w-.78)/.15);
    const outer=inner+side*outerRound*Math.max(.11,pillow-side*bed.height*.58);
    const mixOut=thick*(.86+.14*thick)*round,y=lerp(inner,outer,mixOut);
    const shellColor=()=>tone(dye(fascia,[238,145,142],.18+.37*outerRound),6*cos(x*10+t*2.8)+7*sin(5*t)+4*sin(18*x+1.3*cos(t*6))+bed.crest*31);
    let c:V,wet:number;
    if(cutFraction>=0){
      const border=bell((cutFraction-.20-.054*sin(8*t))/.16),fiber=sin(24*cutFraction+3*sin(t*7)+t*9)*sin(7*t+3*cutFraction);
      c=dye(muscle,lamina,border*(.66+.17*cos(t*7)));c=dye(c,berry,.93*bell(cutFraction/.10));
      c=tone(c,13*fiber+10*sin(PI*thick)-16*deep+bed.crest*48*(1-thick));
      if(cutFraction>.72)c=dye(c,shellColor(),smooth(.72,1,cutFraction));wet=.15+.85*(1-smooth(.04,.29,thick));
    }else if(!thick){
      const turn=.78+.22*cos(x*4+t*4.3),underlip=bell((x-anteriorCut+.035)/.13)*(1-deep);
      const cave=deep*bell((x/w+.23)/.78),rail=bell((x/w+.09+.064*sin(8*t))/.19);
      c=dye(berry,peach,clamp(.32+.12*rail+bed.crest*3.5*turn+.095*along-.24*cave));
      c=tone(c,8*sin(x*3.1+t*9)-bed.shadow*133+bed.gleam*32-17*cave+17*vaultRim-26*recess);
      if(side<0)c=dye(c,[96,29,53],.56*underlip);wet=.52+.48*clamp(bed.gleam+bed.crest*2.4);
    }else{
      c=shellColor();wet=.15;
    }
    return {p:[x,y,z],c,center:inner,lining:lerp(1,.54,mixOut),lumen:wet};
  });
  glazeFoldEdges(mesh,side<0,vaultEnd,mucosaEnd,width,(i,u)=>{const [at,,,arc,skew]=rugae[i];return crestAt(at,arc,skew,u);});
  return mesh;
}

// Closed projecting portio. A pair of lips and a tiny blind external dimple
// occupy its distal pole; there is no hole in this mesh. Its root broadens
// into a continuous vaulted cuff, with an asymmetrically deeper posterior lip.
function pole(h:number,s:number,d:number,k=0):V{return [-.21+.86*h+.18*s-.45*d+.08*k,seamAxis(1.03)+.048+.49*h+.34*s+.81*d,
  STOP+.17-.10*h+.92*s-.30*d+.105*k];}
function cervix():Mesh{
  return grid(64,44,false,0,(u,v)=>{
    const theta=u*2*PI,lip=v<=.5,k=lip?2*v:2*v-1;
    const r=lip?k:(1-k)**.72*(1+.052*sin(PI*k));
    const h=.46*r*cos(theta),s=.229*r*sin(theta),line=s+.026-.29*h*h+.061*h;
    const os=lip?bell((h+.042)/.29)*bell(line/.035):0;
    const lobes=lip?(bell((line-.100)/.12)+.78*bell((line+.102)/.10))*bell(h/.42):0;
    const recess=lip?.075*(1-r*r)-.075*r**5+.135*lobes-.105*os:-.075-.73*k;
    // Oblique caudal face. The transverse os is a *recessed closed surface*,
    // never a black hole; the opposite pole fuses to the vaulted roof.
    const edge=lip?bell((line-.060)/.028)*bell((h+.071)/.22):0;
    const c=tone(dye([141,54,82],[249,159,147],.31+.39*lobes+.12*sin(theta+.7)*r),-89*os-48*(lip?0:k)+4*cos(h*9-s*3)+19*edge);
    return {p:pole(h,s,recess,lip?0:k),c,lumen:.55+.42*lobes};
  });
}
// Reflect the roof's exposed edge into the deep posterior wall. Both seams
// use existing vertices; no floating collar or hole behind the cervical neck.
function vaultReturn(roof:Mesh,posterior:Mesh){
  const bottom=Math.round(1.056/vaultEnd*canalBands),pitch=posterior.cols*stride;
  return grid(roof.rows-1,canalBands-bottom,false,0,(u,v)=>{
    const col=Math.round(u*(roof.rows-1)),i=col*roof.cols*stride,a=roof.a,b=posterior.a;
    const top=canalBands*pitch+col*stride,row=Math.round(lerp(canalBands,bottom,v))*pitch+col*stride;
    const k=1-smooth(0,1,v),bow=sin(PI*v)*sin(PI*u),p:V=[0,0,0],c:V=[0,0,0];
    for(let n=0;n<3;n++){p[n]=b[row+n]+k*(a[i+n]-b[top+n]);c[n]=lerp(b[row+n+6],a[i+n+6],k);}
    p[1]-=.11*bow;
    return {p,c:tone(c,-24*bow+7*bow*cos(PI*u*2)),lumen:.23+.28*v};
  });
}
function returnWall(a:Mesh,b:Mesh,roof:boolean){
  return grid(roof?mucosaCols:canalBands,18,false,0,(u,v)=>{
    const col=roof?Math.round(u*mucosaCols):mucosaCols,row=roof?a.rows-1:Math.round(u*canalBands),i=(row*a.cols+col)*stride,A=a.a,B=b.a,bow=sin(PI*v);
    const z=lerp(A[i+2],B[i+2],v)+(roof?bow*(.21+.08*sin(PI*u)):0);
    const c=tone(dye(fascia,berry,roof?.49+.31*sin(PI*u):.65),4*bow-14*(1-u)-14*bow*sin(PI*u));
    return {p:[lerp(A[i],B[i],v)+(roof?-.08:.11*clamp((B[i+1]-A[i+1])/.55))*bow,lerp(A[i+1],B[i+1],v),z],c};
  });
}
export type CanalStudy=ReturnType<typeof make>;
function make(){const posterior=wall(-1),anterior=wall(1),vault=returnWall(posterior,anterior,true);
  return {posterior,anterior,cervix:cervix(),fornix:vaultReturn(vault,posterior),vault,commissure:returnWall(posterior,anterior,false)};}
let cached:WeakRef<CanalStudy>|undefined;
export function canalStudy(){let s=cached?.deref();if(!s){s=make();cached=new WeakRef(s);}return s;}
