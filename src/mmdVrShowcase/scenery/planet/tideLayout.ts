import {Vector3} from 'three';
import {tideGauge} from './tideClock';
import {breakwaterHit} from './tideBreakwater';

export const tideCentre=new Vector3(23,-17,20),tideRadius=9;
export const tideDatum=tideCentre.y+tideRadius;
// The uninstrumented station is the arrival shot's sight target. Look across
// the water to the dry chamber, rather than down at the first submerged step.
export const tideStation=new Vector3(5.85,tideRadius+.10,-.18).normalize();
const deckX=5.50,deckR=1.08;
export const tideDeck={x:tideCentre.x+deckX,y:tideDatum+.10,z:tideCentre.z,w:2*deckR,d:2*deckR};
export const onTideDeck=(x:number,z:number)=>(x-tideDeck.x)**2+(z-tideDeck.z)**2<=deckR**2+1e-10;
export const easeTide=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const tideWaterBounds={minX:.26,maxX:5.95,minZ:-2.45,maxZ:1.18};
export function tideWaterFootprint(x:number,z:number){
  const b=tideWaterBounds;return x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ;
}

// A rectangular chart in metres, not an angular polar mesh: both the walking
// solver and the water can resolve a shell lip without adding a second floor.
export const tideChart={minX:-2.4,maxX:7.35,minZ:-5.05,maxZ:5.05,cols:128,rows:100};
const {minX,maxX,minZ,maxZ,cols,rows}=tideChart;
const dx=(maxX-minX)/cols,dz=(maxZ-minZ)/rows;
const sphereTop=(x:number,z:number)=>Math.sqrt(Math.max(0,81-x*x-z*z))-9;
export const shellNoses=[1.35,1.63,1.98,2.28,2.54] as const;
export const shellCurve=(z:number)=>.15-.20*(z+.16)**2+.075*z;
function sculpt(x:number,z:number){
  const round=sphereTop(x,z);
  const apron=easeTide(minX,-1.02,x)*(1-easeTide(6.68,maxX,x))*(1-easeTide(2.26,3.49,Math.abs(z)));
  if(apron<=0)return round;
  const s=x-shellCurve(z);
  let channel=0;
  for(const nose of shellNoses)channel-=.106*easeTide(nose-.073,nose+.072,s);
  const bank=.175+.025*Math.sin(x*.81+.37*z);
  let bed=mix(channel,bank,easeTide(.65,1.18,z+.06*Math.sin(.88*x)));
  // Long rock pool beneath the mouth: its western reach lies beside the
  // collar rather than cutting through it. Exposes five shelves at ebb.
  const bayAxis=-1.17-.17*Math.sin(.9*x+.52),lane=Math.abs(z-bayAxis);
  const bay=easeTide(.27,.93,x)*(1-easeTide(.38,1.13,lane));
  bed=mix(bed,-.91+.043*Math.cos(x*2.1)+.032*Math.sin(4*z),bay);
  bed=mix(bed,bank,easeTide(1.84,2.24,-z));
  // A water-polished bed continuing into the rear of the cave. Only its
  // seaward edge is cut; there is no circular pedestal around the actor.
  // Beside the performer, the channel cuts farther inland than the steps.
  // This leaves visible blue water beyond the foreground treads even at ebb.
  // The first bearing clears the entire actor plate and its surrounding
  // triangles. Shaping by bearing preserves a single radial foot at the bank.
  const bearing=-z/Math.max(.80,x),tongue=easeTide(.229,.315,bearing)*(1-easeTide(.37,.53,bearing));
  const run=x-.12*z-.09*z*z-.32*bay-1.03*tongue;
  // Two inclined ledges cross the mouth of the dry bed. Keep radial slopes
  // below the local up vector so there is only one possible walking foot.
  const climb=mix(.52*easeTide(3.08,3.69,run)+.48*easeTide(3.77,4.27,run),easeTide(3.01,4.64,run),tongue);
  bed=mix(bed,.10,climb);
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

// Sea cuts from -X. The positive-Z headland reaches towards the landing;
// the opposite bank has two successively recessed scarps. Their positions
// are metres, shared by the two render LODs, the contact and sight queries.
export const caveZ=5.05;
const shoulder=(z:number)=>easeTide(-.27,1.53,z)*(1-.28*easeTide(3.4,4.8,z));
export function caveMouth(z:number){return 3.35-1.50*shoulder(z)-.11*z+.47*easeTide(.34,1.10,-z)+.81*easeTide(1.40,2.42,-z);}
// X offsets at the bedding contacts. A massive slab extends over a recessed
// softer bed, with a broken toe rather than a smooth rolled perimeter.
export const lipCourses=[[0,0],[.12,-.20],[.28,-.13],[.39,.11],[.49,-.41],[.63,-.88],[.86,-.73],[1,-.33]] as const;
export function caveLip(z:number,t:number){
  const reach=.31+.91*shoulder(z),slant=.13-.07*z;
  for(let i=1;i<lipCourses.length;i++){const [b,v]=lipCourses[i];if(t<=b){const [a,u]=lipCourses[i-1];return caveMouth(z)+slant*t+reach*mix(u,v,(t-a)/(b-a));}}
  return caveMouth(z)+slant+reach*lipCourses[lipCourses.length-1][1];
}
// The apse curves AWAY behind the performer and curls forward at each flank.
// Its uneven imposts continue into the side wall rather than two square joins.
export function caveRear(z:number){return 7.97-.86*easeTide(.65,2.62,Math.abs(z))+.16*Math.sin(.94*z+.4);}
export function caveBed(x:number,z:number){return tideFloor(x,z)-.44;}
export function caveSoffit(x:number,z:number){
  const q=z+.10*Math.sin(.69*x),crown=3.45+.10*Math.sin(.71*x-.31*z)-.07*(x-4);
  const arch=crown-.13*(q+.35)**2-2.87*easeTide(1.59,3.19,q)-2.03*easeTide(1.56,2.85,-q)-1.62*easeTide(2.6,3.65,-q);
  return Math.max(caveBed(x,z),arch);
}
export function caveCrest(x:number,z:number){
  const bed=caveBed(x,z),q=z+.17*Math.sin(.78*x)+.10*(x-4);
  // The outer cliff is not an offset of the vault. Its cap runs sideways
  // for several metres, then breaks in two terraces on each flank.
  let top=3.85+.16*q-.065*(x-3)+.34*easeTide(.14,1.41,q);
  top-=.70*easeTide(3.11,3.63,q)+.83*easeTide(4.00,4.37,q);
  top-=.62*easeTide(.92,1.69,-q)+.91*easeTide(2.08,2.54,-q)+.67*easeTide(3.24,3.64,-q);
  return mix(Math.max(caveSoffit(x,z)+.36,top),bed+.12,easeTide(4.38,caveZ,Math.abs(z)));
}
export const caveBackThickness=.46;
export const apseStrike=(y:number,z:number)=>y-.16*z-.17*Math.cos(1.59*z+.2);
export const apseWing=(z:number)=>easeTide(.56,1.58,Math.abs(z-.11));
export const apseBeds=[[.25,.36,.66],[2.19,.33,.60]] as const;
export function bedFlare(s:number,mark:number,width:number){
  return easeTide(mark-width,mark-.08*width,s)*(1-easeTide(mark+.08*width,mark+1.62*width,s));
}
export function apseRockX(z:number,y:number,rear=caveRear(z),roof=caveSoffit(rear,z)){
  const h=apseStrike(y,z),wing=apseWing(z);
  let shelf=0;for(const [mark,width,projection] of apseBeds)shelf+=projection*bedFlare(h,mark,width);
  const weather=.08+.30*wing+.10*Math.sin(.90*z+.35*y)*wing+shelf*(.79+.47*wing);
  const landing=6.74-.77*easeTide(1.4,2.24,Math.abs(z));
  return rear-Math.min(Math.max(0,rear-landing),weather)*(1-easeTide(roof-.38,roof,y));
}
// Beyond the pool a second sea-cut opening breaks through the back wall.
// A tilted lens, pinched shut at either end. The sill and lintel continue
// through the whole depth of the rock, including its visible outside face.
export const seaWindow={z:-1.29,r:1.30};
export function windowHalf(z:number){const u=(z-seaWindow.z)/seaWindow.r;
  return .34*Math.max(0,Math.min(1,(u+1)*3.4,(1-u)*1.85))*(1-.59*easeTide(-.24,.10,u)+.26*easeTide(.38,.64,u));}
export function windowLevel(z:number){const q=z-seaWindow.z;return 1.58-.21*q+.24*easeTide(-.41,-.16,q)-.13*easeTide(.41,.76,q);}
export function windowCut(z:number,upper:boolean,bed:number,roof:number){
  return Math.min(roof,Math.max(bed,windowLevel(z)+(upper?1:-1)*windowHalf(z)));
}
export const tidePiles=[{x:-.64,z:-1.21,r:.105,h:.52},{x:1.25,z:2.17,r:.108,h:.60}] as const;
function rockHit(x:number,y:number,z:number,head:number){
  if(Math.abs(z)>caveZ)return false;
  const mouth=caveMouth(z);if(x<mouth-1.40)return false;
  const rear=caveRear(z);if(x>rear+caveBackThickness)return false;
  if(x>=rear-1.42){
    const bed=caveBed(rear,z),roof=caveSoffit(rear,z);
    const lower=windowCut(z,false,bed,roof),upper=windowCut(z,true,bed,roof);
    if(x>=rear)return head>=caveBed(x,z)&&y<=caveCrest(x,z)&&(head>=upper||y<=lower);
    const touches=(start:number,end:number)=>{
      const lo=Math.max(y,start),hi=Math.min(head,end);if(hi<lo)return false;
      const steps=Math.max(1,Math.ceil((hi-lo)/.10));
      for(let i=0;i<=steps;i++)if(x>=apseRockX(z,lo+(hi-lo)*i/steps,rear,roof))return true;
      return false;
    };
    if(touches(bed,lower)||touches(upper,roof))return true;
  }
  const low=caveSoffit(Math.max(x,mouth),z);if(head<low)return false;
  const lip=caveLip(z,1),top=caveCrest(Math.max(x,lip),z);if(y>top)return false;
  if(x>=Math.max(lip,mouth+.17))return true;
  const ceil=caveCrest(lip,z),floor=caveSoffit(mouth,z);
  const t=(h:number)=>Math.max(0,Math.min(1,(h-floor)/(ceil-floor)));
  const a=t(y),b=t(head);if(x>=Math.min(caveLip(z,a),caveLip(z,b)))return true;
  for(const [k] of lipCourses)if(k>a&&k<b&&x>=caveLip(z,k))return true;
  return false;
}
/** World +Y cylinder (h=0 is a horizontal sample). Ground is support, not a
 * wall. A caller with a tilted lunar body can sample along its foot–eye axis. */
export function tideSolid(world:Vector3,r:number,height:number){
  const x=world.x-tideCentre.x,y=world.y-tideDatum,z=world.z-tideCentre.z,head=y+height;
  if(y>5.6||head< -8.9||x< -1-r||x>8.65+r||Math.abs(z)>caveZ+r)return false;
  for(const p of tidePiles){if((x-p.x)**2+(z-p.z)**2>(r+p.r)**2)continue;
    const h=tideFloor(p.x,p.z);if(head>=h-.28&&y<=h+p.h)return true;}
  const g=tideGauge,d=(x-g.x)**2+(z-g.z)**2;
  if((d<=(r+g.r)**2&&head>=Math.min(-.88,tideFloor(g.x,g.z))&&y<=g.top+.07)||
    (d<=(r+.26)**2&&head>=g.top-.07&&y<=g.top+.07))return true;
  if((z< -2.12+r||z>1.90-r)&&breakwaterHit(x,y,z,head,r))return true;
  if(x<.25-r)return false;
  if(rockHit(x,y,z,head))return true;
  if(r<=0)return false;
  const k=r*Math.SQRT1_2;
  return rockHit(x-r,y,z,head)||rockHit(x+r,y,z,head)||rockHit(x,y,z-r,head)||rockHit(x,y,z+r,head)
    ||rockHit(x-k,y,z-k,head)||rockHit(x-k,y,z+k,head)||rockHit(x+k,y,z-k,head)||rockHit(x+k,y,z+k,head);
}
