import {Vector3} from 'three';
import {tideGauge} from './tideClock';

export const tideCentre=new Vector3(23,-17,20),tideRadius=9;
export const tideDatum=tideCentre.y+tideRadius;
export const tideStation=new Vector3(3.05,tideRadius-.52,0).normalize();
const deckX=5.50,deckR=1.08;
export const tideDeck={x:tideCentre.x+deckX,y:tideDatum+.10,z:tideCentre.z,w:2*deckR,d:2*deckR};
export const onTideDeck=(x:number,z:number)=>(x-tideDeck.x)**2+(z-tideDeck.z)**2<=deckR**2+1e-10;
export const easeTide=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const tideWaterBounds={minX:.26,maxX:4.7,minZ:-2.45,maxZ:1.18};
export function tideWaterFootprint(x:number,z:number){
  const b=tideWaterBounds;return x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ;
}

// A rectangular chart in metres, not an angular polar mesh: both the walking
// solver and the water can resolve a shell lip without adding a second floor.
export const tideChart={minX:-2.4,maxX:8.32,minZ:-3.22,maxZ:3.22,cols:160,rows:88};
const {minX,maxX,minZ,maxZ,cols,rows}=tideChart;
const dx=(maxX-minX)/cols,dz=(maxZ-minZ)/rows;
const sphereTop=(x:number,z:number)=>Math.sqrt(Math.max(0,81-x*x-z*z))-9;
export const shellNoses=[1.40,1.69,1.98,2.27,2.56] as const;
export const shellCurve=(z:number)=>.16*Math.cos(Math.max(-1,Math.min(1,z/.97))*Math.PI*.5)+.034*z+.028*Math.cos(26*Math.atan2(z,.84));
function sculpt(x:number,z:number){
  const round=sphereTop(x,z);
  const apron=easeTide(minX,-1.02,x)*(1-easeTide(6.87,maxX,x))*(1-easeTide(2.26,3.21,Math.abs(z)));
  if(apron<=0)return round;
  const s=x-shellCurve(z);
  let channel=0;
  for(const nose of shellNoses)channel-=.104*easeTide(nose-.084,nose+.084,s);
  const flutes=Math.cos(26*Math.atan2(z,.68+.06*x));
  channel+=.034*flutes*easeTide(1.18,1.42,x)*(1-easeTide(2.65,2.90,x))*(1-easeTide(.67,1.06,Math.abs(z)));
  channel=mix(channel,.10,easeTide(3.12,4.39,x));
  const bank=.132+.022*Math.sin(x*.81+.37*z);
  let bed=mix(channel,bank,easeTide(.48,1.20,z));
  // Long rock pool beneath the mouth: its western reach lies beside the
  // collar rather than cutting through it. Exposes five shelves at ebb.
  const bayAxis=-1.17-.17*Math.sin(.9*x+.52),lane=Math.abs(z-bayAxis);
  const bay=easeTide(.27,.93,x)*(1-easeTide(3.36,4.44,x))*(1-easeTide(.28,1.13,lane));
  bed=mix(bed,-.91+.043*Math.cos(x*2.1)+.032*Math.sin(4*z),bay);
  bed=mix(bed,bank,easeTide(1.84,2.24,-z));
  const ra=Math.atan2(z,x-deckX),rr=Math.hypot(x-deckX,z),rim=1.32+.049*Math.cos(5*ra)+.026*Math.sin(8*ra+.8);
  // Three eroded nacre laminations below the cut fossil. The safe actor
  // disc is genuinely horizontal. Its front edge stands proud of the rock;
  // the little cut channel pinches out where the dry path meets the disc.
  const side=1-easeTide(.94,1.32,z),edge=rr-rim;
  bed-=side*.17*easeTide(-.09,.07,edge)*(1-easeTide(.085,.37,edge));
  bed+=side*.028*Math.cos(43*edge+.4*Math.sin(4*ra))*easeTide(-.10,.01,edge)*(1-easeTide(.16,.30,edge));
  bed=mix(bed,.10,1-easeTide(-.065,.04,edge));
  bed*=easeTide(1.03,1.31,Math.hypot(x,z));
  return mix(round,bed,apron);
}
// Prep builds route/view records that sample only a few triangles. Fill the
// other bed vertices on demand when (and if) the stage is actually mounted.
let heights:Float64Array|undefined;
function vertex(i:number,j:number){
  const cache=heights??=new Float64Array((cols+1)*(rows+1)).fill(NaN),key=j*(cols+1)+i;
  const value=cache[key];return Number.isNaN(value)?cache[key]=sculpt(minX+i*dx,minZ+j*dz):value;
}
/** Local X/Z from the moon centre; height above the north collar's plane. */
export function tideFloor(x:number,z:number){
  if(x<minX||x>maxX||z<minZ||z>maxZ)return sphereTop(x,z);
  const u=(x-minX)/dx,v=(z-minZ)/dz,i=Math.min(cols-1,Math.floor(u)),j=Math.min(rows-1,Math.floor(v));
  const s=u-i,t=v-j,right=vertex(i+1,j),down=vertex(i,j+1);
  return s+t<=1?vertex(i,j)*(1-s-t)+s*right+t*down:vertex(i+1,j+1)*(s+t-1)+right*(1-t)+down*(1-s);
}
export function tideRelief(nx:number,ny:number,nz:number){
  if(ny<=0)return easeTide(0,.71,-ny)*(.13*Math.sin(nx*6+ny*4)*Math.cos(nz*5-ny)+.09*Math.sin(6*nz-4*ny));
  if(Math.hypot(nx,nz)*9<=.92*ny)return 9/ny-9;
  if(ny<.18||nx*9<minX||Math.abs(nz)*9>maxZ+.45)return 0;
  // Radial intersection of the actual shell triangulation, including the
  // off-axis horizontal stage and the concave tide pool beneath the arch.
  let lo=8,hi=12.3;
  for(let i=0;i<20;i++){const r=(lo+hi)*.5;
    if(r*ny<9+tideFloor(r*nx,r*nz))lo=r;else hi=r;}
  return (lo+hi)*.5-9;
}

// X is longitudinal. Both skins have a scalloped, undercut lip. Their
// interval is rock; the void beneath it remains open out to -X.
export const caveZ=3.32;
export function caveMouth(z:number){return 2.04+.14*Math.cos(2.4*z)+.11*Math.sin(4.1*z)-.29*(z/caveZ)**2;}
export function caveLip(z:number,t:number){return caveMouth(z)+.19*t-.10*Math.sin(Math.PI*t)+.041*Math.sin(4*Math.PI*t)*Math.cos(2.1*z);}
// The apse curves AWAY behind the performer and curls forward at each flank.
// Its uneven imposts continue into the side wall rather than two square joins.
export function caveRear(z:number){return 7.98+.12*Math.cos(1.7*z+.24)-1.18*easeTide(.80,2.78,Math.abs(z))*(1+.12*Math.sin(z*2.9));}
export function caveBed(x:number,z:number){return tideFloor(x,z)-.44;}
export function caveSoffit(x:number,z:number){
  const wave=.095*Math.cos(2.55*x+.71*z)+.055*Math.cos(3.3*z-.8*x);
  const a=Math.abs((z+.055*Math.sin(1.4*x))/(2.48+.10*Math.sin(1.36*x)));
  const crown=3.74+.12*Math.cos(.83*x-.86)+wave;
  // This curve has a smooth crown and a much steeper rock wall near the toe.
  return Math.max(caveBed(x,z),crown-1.64*a*a-2.52*a**8-8*Math.max(0,a-1));
}
export function caveCrest(x:number,z:number){
  const a=Math.abs(z)/caveZ,bed=caveBed(x,z);
  const top=4.47+.23*Math.cos(1.53*x-.6*z)+.105*Math.sin(3.88*z+.83*x)-.97*a*a;
  return Math.max(caveSoffit(x,z)+.13,mix(top,bed+.22,easeTide(.66,1,a)));
}
export const caveBackThickness=.46;
export const apseStrike=(y:number,z:number)=>y-.25*z-.29*Math.cos(1.59*z+.2)-.11*Math.sin(3.4*z-.45);
export const apseWing=(z:number)=>easeTide(.56,1.58,Math.abs(z-.11));
export const apseBeds=[[-.26,.22,.30],[.49,.23,.53],[1.30,.18,.45],[2.28,.31,.57],[3.04,.18,.27]] as const;
export function bedFlare(s:number,mark:number,width:number){
  return easeTide(mark-width,mark-.08*width,s)*(1-easeTide(mark+.08*width,mark+1.62*width,s));
}
export function apseRockX(z:number,y:number,rear=caveRear(z),roof=caveSoffit(rear,z)){
  const h=apseStrike(y,z),wing=apseWing(z);
  let shelf=0;for(const [mark,width,projection] of apseBeds)shelf+=projection*bedFlare(h,mark,width);
  const weather=(.31+.11*Math.sin(2.9*z+.48*y)+shelf)*wing+.12*(1-easeTide(.45,1.75,y))+.09;
  const landing=6.94-.65*easeTide(1.7,2.18,Math.abs(z));
  return rear-Math.min(Math.max(0,rear-landing),weather)*(1-easeTide(roof-.38,roof,y));
}
export const tidePiles=[{x:-.64,z:-1.21,r:.105,h:.52},{x:1.25,z:2.17,r:.108,h:.60}] as const;
// A few standing limestone fins on the outside of the bypass, not a fence
// across it. The profile is in metres at both the worn foot and broken tip.
export const tideFins=[{x:2.53,z:2.06,rx:.19,rz:.115,h:.46},{x:3.48,z:2.14,rx:.26,rz:.12,h:.67},
  {x:3.94,z:2.18,rx:.14,rz:.10,h:.32},{x:5.04,z:2.10,rx:.22,rz:.13,h:.54}] as const;
export const finWidth=(t:number)=>1-.61*t+.065*Math.sin(2*Math.PI*t);
export const finLean=(t:number)=>-.085*t*t;
function rockHit(x:number,y:number,z:number,head:number){
  if(Math.abs(z)>caveZ||x<caveMouth(z)-.08||x>caveRear(z)+caveBackThickness)return false;
  const rear=caveRear(z),top=caveCrest(x,z);
  if(x>=rear-1.22&&head>=caveBed(rear,z)){
    const roof=caveSoffit(rear,z),lo=Math.max(y,caveBed(rear,z)),hi=Math.min(head,roof);
    if(hi>=lo){const steps=Math.max(1,Math.ceil((hi-lo)/.065));
      for(let i=0;i<=steps;i++)if(x>=apseRockX(z,lo+(hi-lo)*i/steps,rear,roof))return true;}
  }
  const low=x>=rear?caveBed(x,z):caveSoffit(x,z);
  if(y>top||head<low)return false;
  if(x>=caveMouth(z)+.19)return true;
  const clamp=(h:number)=>Math.max(0,Math.min(1,(h-low)/(top-low)));
  const from=clamp(y),to=clamp(head);
  return x>=Math.min(caveLip(z,from),caveLip(z,to),caveLip(z,(from+to)*.5));
}
/** World +Y cylinder (h=0 is a horizontal sample). Ground is support, not a
 * wall. A caller with a tilted lunar body can sample along its foot–eye axis. */
export function tideSolid(world:Vector3,r:number,height:number){
  const x=world.x-tideCentre.x,y=world.y-tideDatum,z=world.z-tideCentre.z,head=y+height;
  if(y>5||head< -8.9||x< -1-r||x>8.55+r||Math.abs(z)>caveZ+r)return false;
  for(const p of tidePiles){if((x-p.x)**2+(z-p.z)**2>(r+p.r)**2)continue;
    const h=tideFloor(p.x,p.z);if(head>=h-.28&&y<=h+p.h)return true;}
  const g=tideGauge,d=(x-g.x)**2+(z-g.z)**2;
  if((d<=(r+g.r)**2&&head>=Math.min(-.88,tideFloor(g.x,g.z))&&y<=g.top+.07)||
    (d<=(r+.26)**2&&head>=g.top-.07&&y<=g.top+.07))return true;
  if(z>1.8-r&&z<2.4+r)for(const f of tideFins){const foot=tideFloor(f.x,f.z);
    if(head<foot||y>foot+f.h)continue;
    const t=Math.max(0,(y-foot)/f.h),w=finWidth(t);
    if(((x-f.x-finLean(t))/(r+w*f.rx))**2+((z-f.z)/(r+w*f.rz))**2<=1)return true;}
  if(x<1.4-r)return false;
  if(rockHit(x,y,z,head))return true;
  if(r<=0)return false;
  const k=r*Math.SQRT1_2;
  return rockHit(x-r,y,z,head)||rockHit(x+r,y,z,head)||rockHit(x,y,z-r,head)||rockHit(x,y,z+r,head)
    ||rockHit(x-k,y,z-k,head)||rockHit(x-k,y,z+k,head)||rockHit(x+k,y,z-k,head)||rockHit(x+k,y,z+k,head);
}
