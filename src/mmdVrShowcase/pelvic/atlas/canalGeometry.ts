import {canalY,clamp,ENTRY,grid,smooth,STOP,stride,type Mesh,type V} from './model';

// One fixed longitudinal dissection. The anterior margin steps back just
// enough to show the posterior mucosa. The *intact* tissue behind this margin
// is apposed; turning the figure never chooses a new section or material.
const {abs,cos,exp,PI,sin,sqrt}=Math;
const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;
const bell=(u:number)=>exp(-u*u);
const dye=(a:V,b:V,k:number):V=>[lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k)];
const tone=(a:V,d:number):V=>[a[0]+d,a[1]+d*.75,a[2]+d*.68];
export const canalBands=76, vaultEnd=1.29;
const span=STOP-ENTRY;
// Cross-sections distinguish a rolled entrance, broader midbody and the
// narrowing vault. Only the opening-to-stop interval has measured stations.
export const canalStation=(row:number)=>row/canalBands*vaultEnd;
const width=(t:number)=>.62+.27*smooth(.03,.36,t)+.20*smooth(.55,.89,t)+.10*bell((t-.075)/.075)-.19*smooth(1.02,vaultEnd,t);
const seamAxis=(t:number)=>canalY(clamp(t))-.095*smooth(.76,1.18,t);
// Authored groups, not a periodically repeated rib: centre, breadth, relief,
// curvature and lateral skew. Rugae crowd near the introitus and fade before
// the fornices. Positive and negative halves do not mirror the same fan.
const rugae=[
  [.055,.026,.085,.030,.031],[.137,.034,.147,.058,-.007],[.231,.028,.092,.076,.026],
  [.354,.044,.148,.088,.028],[.49,.041,.103,.063,-.021],[.661,.050,.076,.088,.028],[.79,.048,.029,.045,-.023],
];
function lining(u:number,t:number,folds:number[][],keelHeight:number){
  let ridge=0,trough=0;const keel=keelHeight*bell((u+.12)/.28);
  for(const [at,breadth,h,arc,skew] of folds){
    const d=(t-at-arc*u*u-skew*u-.010*sin(5*u+at*14))/breadth;
    if(d < -3||d>3)continue;
    const fade=clamp(.78-.13*u*u+.31*sin(4*u+at*14));
    ridge+=h*fade*bell(d);trough+=h*fade*bell((d+.96)*1.28);
  }
  return {height:keel+ridge-.23*trough,crest:ridge,shadow:trough};
}
const berry:V=[156,68,91],peach:V=[250,153,149],fascia:V=[204,115,122],muscle:V=[195,99,109],lamina:V=[250,183,151];
export type WallSide=-1|1;
// All wall vertices use the same row stations, including the turned rim and
// cut face. Metadata in slots 9..11: apposed surface Y, compliance, mucosa.
function wall(side:WallSide):Mesh{
  const bands=Array.from({length:canalBands+1},(_,i)=>{
    const t=canalStation(i),w=width(t),deep=smooth(.78,1.21,t),vault=smooth(.86,1.18,t);
    const anteriorCut=(-.27+.16*sin(t*5)+.65*deep)*w,cut=side>0?anteriorCut:(-.72+.10*sin(t*4+.8)+.13*deep)*w;
    const edge=w*(.997-.07*smooth(1.11,1.29,t)),layer=(.39+.20*sin(clamp(t)*PI)+.14*bell((t-.08)/.09))*(side===1?.97:1.04);
    const round=Math.sqrt(smooth(0,.07,t)*(1-smooth(1.20,vaultEnd,t)));
    const outerCut=cut+side*layer*(side<0?.48:.90)*round,core=seamAxis(t);
    const folds=rugae.filter(([at,b])=>t>at-3*b-.09&&t<at+3*b+.26);
    return {t,w,deep,vault,cut,edge,layer,round,outerCut,core,anteriorCut,folds,keel:.065*(1-smooth(.68,.9,t)),base:1-smooth(0,.16,t),cap:smooth(.99,1.29,t)};
  });
  return grid(48,canalBands,false,0,(u,v)=>{
    const {t,w,deep,vault,cut,edge,layer,round,outerCut,core,anteriorCut,folds,keel,base,cap}=bands[Math.round(v*canalBands)];
    let x:number,thick:number,cutFraction=-1;
    if(u<=.416667){x=lerp(cut,edge,clamp(u*2.4));thick=0;} // mucosa
    else if(u<=.75){const k=(u-5/12)*3;x=lerp(edge,outerCut,k);thick=1;} // outer envelope
    else{cutFraction=clamp((1-u)*4);x=lerp(cut,outerCut,cutFraction)-.048*round*sin(PI*cutFraction);thick=cutFraction;}
    const along=clamp((x-cut)/(edge-cut));
    // Round, opposed ends; the posterior vault ascends beyond the anterior
    // one and curls back over the cervix. Neither rim is a horizontal trim.
    const hood=side<0?.19:-.14,entry=base*(.49*(along-.55)**2+.062*side+.062*thick*round);
    const crown=cap*(hood-.25*along*along-.12*thick*round);
    const z=ENTRY+span*t+entry+crown,outerRound=sqrt(Math.max(0,1-along**3));
    const bed=lining(x/w,t,folds,keel),pocket=(side>0?.42:.52)*vault*(1-.18*along*along);
    const inner=core+bed.height+side*(.006+pocket),outer=inner+side*outerRound*Math.max(.11,layer-side*bed.height*.78);
    const mixOut=thick*(.86+.14*thick)*round,y=lerp(inner,outer,mixOut);
    let c:V,wet:number;
    if(cutFraction>=0){
      const border=bell((cutFraction-.19-.035*sin(8*t))/.14),fiber=sin(24*cutFraction+3*sin(t*7)+t*9)*sin(7*t+3*cutFraction);
      c=dye(muscle,lamina,border*(.59+.13*cos(t*7)));c=dye(c,berry,.80*bell(cutFraction/.12));
      c=tone(c,13*fiber+8*sin(PI*thick)-9*deep);wet=1-smooth(0,.16,thick);
    }else if(!thick){
      const middle=.7+.3*cos(x*3.9+t*3.4);
      c=dye(berry,peach,clamp(.37+bed.crest*4.1*middle+.18*along-.26*deep));c=tone(c,7*sin(x*3.1+t*9)-bed.shadow*84);
      if(side<0)c=dye(c,[115,54,76],.36*bell((x-anteriorCut+.035)/.11)*(1-deep));
      wet=1;
    }else{
      c=tone(dye(fascia,[239,162,145],.22+.39*outerRound),5*cos(x*10+t*2.8)+5*sin(5*t)+3*sin(18*x+1.3*cos(t*6)));wet=0;
    }
    return {p:[x,y,z],c,center:inner,lining:lerp(1,.54,mixOut),lumen:wet};
  });
}

// Closed projecting portio. A pair of lips and a tiny blind external dimple
// occupy its distal pole; there is no hole in this mesh. Its root broadens
// into a continuous vaulted cuff, with an asymmetrically deeper posterior lip.
function cervix():Mesh{
  return grid(48,32,false,0,(u,v)=>{
    const theta=u*2*PI,lip=v<=.5,k=lip?2*v:2*v-1;
    const r=lip?k:1+.09*sin(PI*k)-.22*k-.78*smooth(.78,1,k);
    const h=.57*r*cos(theta),s=.37*r*sin(theta),line=s+.041-.15*h*h+.045*h;
    const os=lip?bell(h/.26)*bell(line/.047):0;
    const lobes=lip?(bell((line-.135)/.117)+.78*bell((line+.13)/.096))*bell(h/.45):0;
    const recess=lip?.11*(1-r*r)-.07*r**5+.085*lobes-.14*os:-.07-.38*k;
    // Oblique caudal face. The transverse os is a *recessed closed surface*,
    // never a black hole; the opposite pole fuses to the vaulted roof.
    const x=-.27+.78*h-.39*s-.49*recess+.13*(lip?0:k);
    const y=seamAxis(1.03)+.03+.625*h+.49*s+.61*recess;
    const z=STOP+.235+.78*s-.625*recess+.16*(lip?0:k);
    const c=tone(dye([151,76,99],[253,180,152],.45+.26*lobes+.14*sin(theta+.7)*r),-90*os-19*(lip?0:k)+4*cos(h*9-s*3));
    return {p:[x,y,z],c,lumen:.72};
  });
}
function returnWall(a:Mesh,b:Mesh,roof:boolean){
  return grid(roof?20:canalBands,14,false,0,(u,v)=>{
    const col=roof?Math.round(u*20):20,row=roof?a.rows-1:Math.round(u*canalBands),i=(row*a.cols+col)*stride,A=a.a,B=b.a,bow=sin(PI*v);
    const z=lerp(A[i+2],B[i+2],v)+(roof?bow*(.21+.08*sin(PI*u)):0);
    const c=tone(dye(fascia,berry,roof?.30+.19*sin(PI*u):.63),8*bow-12*(1-u));
    return {p:[lerp(A[i],B[i],v)+(roof?-.08:.11)*bow,lerp(A[i+1],B[i+1],v),z],c};
  });
}
export type CanalStudy=ReturnType<typeof make>;
function make(){const posterior=wall(-1),anterior=wall(1);return {posterior,anterior,cervix:cervix(),vault:returnWall(posterior,anterior,true),commissure:returnWall(posterior,anterior,false)};}
let cached:WeakRef<CanalStudy>|undefined;
export function canalStudy(){let s=cached?.deref();if(!s){s=make();cached=new WeakRef(s);}return s;}
