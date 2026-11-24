import {TAU,type V} from '../../bodyState/breast/art/geometry';
import {grid,VERTEX_STRIDE} from '../../bodyState/breast/art/mesh';
import {blend,oval,strand,type Layer} from './forms';

// Illustration coordinates, +Z towards the face. Features and pigment ride
// the head surface; a grazing view must occlude the far cheek and eyelid.
const peach:V=[255,215,185],rose:V=[239,164,151],cream:V=[255,229,202];
const umber:V=[104,60,65],brow:V=[163,100,93],lip:V=[182,102,106];
const hair:V=[178,121,99],honey:V=[234,181,140],shadow:V=[137,88,82];
const {sin,cos,sqrt,exp,max}=Math;
const bell=(v:number,w:number)=>exp(-((v/w)**2));
const sat=(v:number)=>Math.min(1,max(0,v));
const yaw=-.09,turn=-.53,pitch=.28,roll=.17,scale=.93;
const cy=cos(yaw),sy=sin(yaw),ct=cos(.21),st=sin(.21);
const center:V=[-.078,.575,.103];
function placed([x,y,z]:V):V{const tx=x*ct-y*st;return [-.034+scale*(cy*tx+sy*z),.063+scale*(x*st+y*ct),.116+scale*(-sy*tx+cy*z)];}
function head([x,y,z]:V):V{
  const yy=y*cos(pitch)-z*sin(pitch),zz=y*sin(pitch)+z*cos(pitch),xx=x*cos(turn)+zz*sin(turn);
  return [center[0]+xx*cos(roll)-yy*sin(roll),center[1]+xx*sin(roll)+yy*cos(roll),center[2]-x*sin(turn)+zz*cos(turn)];
}
const rx=.229,ry=.218,rz=.201;
function width(y:number){return rx*(.83+.17*sat((y+.84)/1.02)+.07*bell(y+.32,.24));}
function relief(x:number,y:number){return .018*bell(Math.abs(x)-.117,.053)*bell(y+.074,.045)+
  .034*bell(x,.029)*bell(y+.040,.030)+.009*bell(x,.017)*bell(y,.055)+.009*bell(x,.041)*bell(y+.110,.017);}
function scalp(a:number,b:number):V{
  const v=sin(b),r=cos(b),x=width(v)*sin(a)*r,y=ry*v,z=rz*r*cos(a);
  return [x,y,z+relief(x,y)*max(0,cos(a))];
}
function features(x:number,y:number,lift=0):V{
  const v=y/ry,n=x/width(v),h=sqrt(max(.001,1-v*v-n*n));
  return head([x,y,rz*h+relief(x,y)*h/sqrt(max(.001,1-v*v))+lift]);
}
type Stroke=readonly [number,number,number];
function line(points:Stroke[],ink:V,lift=.0025){return strand(points.map(([x,y,r])=>[...features(x,y,lift),r]),ink,.82);}
function faceModel():Layer[]{
  const layers:Layer[]=[[grid(43,63,(u,t)=>head(scalp((u-.5)*TAU,(t-.5)*Math.PI)),(u,t)=>{
    const a=(u-.5)*TAU,[x,y]=scalp(a,(t-.5)*Math.PI),flush=bell(Math.abs(x)-.128,.062)*bell(y+.068,.037)*max(0,cos(a));
    return blend(peach,rose,.60*flush+.12*bell(y+.16,.06));}),1]];
  for(const s of [-1,1]){
    const mirror=(p:Stroke[]):Stroke[]=>p.map(([x,y,r])=>[s*x,y,r]);
    layers.push(line(mirror([[.030,-.039,.0018],[.055,-.048,.004],[.087,-.048,.0063],[.117,-.043,.007],[.140,-.032,.0054],[.154,-.020,.0008]]),umber),
      line(mirror([[.040,.005,.001],[.068,.016,.0034],[.101,.018,.003],[.124,.013,.0006]]),brow),
      line(mirror([[.123,-.040,.0038],[.139,-.042,.0028],[.151,-.037,.0006]]),umber));
    layers.push(oval(head([s*.207,-.018,-.003]),[.031,.043,.025],peach),
      oval(head([s*.228,-.019,.006]),[.011,.023,.014],rose));
  }
  layers.push(line([[-.025,-.100,.001],[-.014,-.105,.003],[.002,-.108,.0037],[.018,-.104,.0025],[.024,-.098,.0007]],lip),
    line([[-.009,-.114,.0008],[.004,-.115,.002],[.013,-.112,.0006]],cream));
  // A fine base at the nape, with overlapping locks rooted in the same
  // crown. Their tapered ends and highlights turn with the head in profile.
  const edge=(a:number)=>-.39+1.03*max(0,cos(a))**.68+.05*sin(2*a+.4);
  layers.push([grid(28,77,(u,t)=>{const a=(u-.5)*TAU,b=edge(a)*(1-t)+Math.PI*.5*t,p=scalp(a,b),th=.002+.007*sin(Math.PI*t);
    return head([p[0]*(1+th/rx),p[1]+.004+th*sin(b),p[2]+th*cos(b)*cos(a)]);},(u,t)=>{
    const a=(u-.5)*TAU,part=a-.72*t+.18*sin(3*t),light=bell(t-(.43+.08*cos(2*a)),.066)*(.15+.46*max(0,cos(a+.3)));
    return blend(blend(hair,shadow,.21*(1-cos(8*part))*(1-t)),honey,light+.08*t);}),1]);
  for(const [end,at,w,sweep] of [[-1.47,-.14,.35,-.68],[-1.02,.15,.38,-.64],[-.53,.18,.46,-.70],[-.26,.39,.33,-.59],[.56,.49,.44,.56],[1.11,.23,.39,.61],[1.47,-.12,.28,.37]]){
    const layer=grid(26,16,(u,t)=>{const k=t*t*(3-2*t),mid=end-sweep*(1-k)+.14*sin(Math.PI*t),half=w*(.76+.25*sin(Math.PI*t))*(1-t**2)**.83;
      const a=mid+(2*u-1)*half,b=1.24+(at-1.24)*t+.12*(u-.5)*sin(Math.PI*t),p=scalp(a,b);
      const th=.008+.010*sin(Math.PI*u)*sin(Math.PI*t);return head([p[0]*(1+th/rx),p[1]+th*sin(b),p[2]+th*cos(a)*cos(b)]);
    },(u,t)=>blend(blend(hair,shadow,.55*bell(u-.035,.15)+.20*t),honey,.68*bell(u-.59,.31)*bell(t-.43-.06*u,.12)+.12*bell(u-.69,.13)));
    // t goes from crown to fringe, opposite to the underlying scalp's v.
    layers.push([layer,-1]);
  }
  return layers;
}

// One continuous bent silhouette from nape to hip. Each row describes height,
// centre x/z and transverse/depth radii. The cord shares the belly surface.
const bodyRows=[[-.003,.081,-.035,.013,.021],[.032,.093,-.038,.110,.100],
  [.095,.111,-.037,.156,.152],[.169,.107,-.035,.153,.164],[.229,.079,-.018,.153,.154],
  [.303,.051,-.030,.147,.122],[.371,.018,-.022,.152,.109],[.408,-.018,.005,.112,.094],[.445,-.044,.036,.069,.072]];
function row(t:number){const n=t*(bodyRows.length-1),i=Math.min(bodyRows.length-2,Math.floor(n)),u=n-i,
  a=bodyRows[Math.max(0,i-1)],b=bodyRows[i],c=bodyRows[i+1],d=bodyRows[Math.min(bodyRows.length-1,i+2)];
  return b.map((v,k)=>v+.5*u*(c[k]-a[k]+u*(2*a[k]-5*v+4*c[k]-d[k]+u*(3*(v-c[k])+d[k]-a[k]))));}
function torsoPoint(a:number,t:number):V{const [y,x,z,w,r]=row(t);return [x+w*sin(a),y,z+r*cos(a)];}
export const fetalNavel=placed(torsoPoint(.30,.49));
type Stations=[number,number,number,number][];
export function createCurledPortrait():Layer[]{
  const layers:Layer[]=[[grid(33,43,(u,t)=>torsoPoint(u*TAU,t),(u,t)=>blend(peach,rose,.19*(1-t)+.11*(1-cos(u*TAU))*.5)),1],...faceModel()];
  const nearArm:Stations=[[.094,.368,-.019,.051],[.133,.333,.016,.054],[.144,.286,.084,.046],
    [.158,.294,.145,.045],[.145,.349,.192,.041],[.110,.389,.219,.032],[.087,.414,.230,.027]];
  const farArm:Stations=[[-.105,.367,-.014,.048],[-.143,.322,.037,.051],[-.153,.287,.111,.045],
    [-.145,.295,.159,.042],[-.106,.331,.199,.037],[-.068,.344,.231,.025]];
  layers.push(strand(nearArm,peach),strand(farArm,peach));
  function fist(x:number,y:number,z:number,s:number){
    layers.push(oval([x,y,z],[.037,.043,.031],peach,([a,b,c])=>[a+.28*s*b,b,c]),oval([x-.023*s,y+.007,z+.015],[.019,.026,.015],peach));
    for(let i=0;i<3;i++)layers.push(oval([x+s*(.015-i*.011),y+.023-i*.009,z+.013],[.014,.017,.018],peach));
  }
  fist(.083,.421,.232,1);fist(-.062,.345,.236,-1);
  const leg=(s:number,high:number)=>{const x=.085+s*.083,d=.018*s;
    const path:Stations=[[x,.112,-.062,.074],[x+s*.013,.142,.031,.078],[x+.028,.214+high,.100+d,.069],
      [x+.045,.264+high,.170+d,.057],[x+.018,.224+high,.211+d,.048],
      [x-.028,.162+high,.219+d,.046],[x-.071,.117+high,.208+d,.033],[x-.090,.108+high,.202+d,.025]];
    layers.push(strand(path,peach),oval([x-.115,.111+high,.209+d],[.051,.025,.034],peach,([a,b,c])=>[a,b-.25*a,c+.29*a]));};
  leg(-1,.036);leg(1,-.017);
  // Affine position and rotation-only normal, once per model, not per turn.
  for(const [m] of layers){const a=m.data;for(let i=0;i<a.length;i+=VERTEX_STRIDE){
    const x=a[i],y=a[i+1],z=a[i+2],tx=ct*x-st*y;
    a[i]=-.034+scale*(cy*tx+sy*z);a[i+1]=.063+scale*(st*x+ct*y);a[i+2]=.116+scale*(cy*z-sy*tx);
    const nx=a[i+3],ny=a[i+4],nz=a[i+5],tn=ct*nx-st*ny;
    a[i+3]=cy*tn+sy*nz;a[i+4]=st*nx+ct*ny;a[i+5]=cy*nz-sy*tn;}}
  return layers;
}
