import { TAU, type Side, type V } from './geometry';
import { clamp, grid, smooth, type Mesh } from './mesh';

// The arm is a separate continuous volume: the negative space from axilla
// to waist remains visible in front, and the arm occludes the flank in profile.
const trunk=[[-1.26,.70,.44],[-.89,.62,.39],[-.56,.64,.415],[-.20,.728,.47],[.17,.775,.525],[.47,.852,.525],
  [.60,.89,.50],[.71,.79,.43],[.78,.64,.36],[.85,.405,.28],[.96,.261,.225],[1.14,.244,.215],[1.39,.273,.24]];
const armForm=[[-1.28,2.59,.115,.14,-.285],[-.89,2.29,.128,.16,-.23],[-.49,1.98,.159,.183,-.193],[-.16,1.73,.177,.206,-.163],
  [.19,1.426,.205,.234,-.131],[.41,1.19,.215,.245,-.112],[.55,1.044,.225,.233,-.090],[.65,.932,.217,.195,-.073],
  [.723,.811,.163,.142,-.070],[.773,.701,.082,.076,-.082],[.785,.588,.002,.002,-.096]];
function profile(table:number[][],y:number,k:number){
  let i=1;while(i<table.length-1&&table[i][0]<y)i++;
  const a=table[i-1],b=table[i],l=table[Math.max(0,i-2)],r=table[Math.min(table.length-1,i+1)],span=b[0]-a[0];
  const t=clamp((y-a[0])/span),s=t*t*(3-2*t);
  return a[k]*(1-s)+b[k]*s+t*(1-t)*((1-t)*(b[k]-l[k])*span/(b[0]-l[0])-t*(r[k]-a[k])*span/(r[0]-a[0]));
}
export const torsoWidth=(y:number)=>profile(trunk,y,1);
const torsoDepth=(y:number)=>profile(trunk,y,2);
export function chest(a:number,y:number):V {
  const w=torsoWidth(y),x=w*Math.sin(a),c=Math.cos(a),ax=Math.abs(x),front=clamp(c*6);
  const clav=.718+.062*Math.sin(ax*4.8)-.092*(ax-.53)**2;
  const relief=front*(.037*Math.exp(-(((y-clav)/.061)**2))*smooth(ax/.15)-
    .046*Math.exp(-(((y-.744)/.095)**2)-(x/.133)**2)-.015*Math.exp(-((x/.089)**2)-((y-.28)/.49)**2));
  const collar=front*(.029*Math.exp(-(((y-.83)/.16)**2)-((ax-.22)/.11)**2));
  return [x,y,torsoDepth(y)*c+relief+collar-.063*smooth((y-.69)/.37)];
}

let torso:Mesh|undefined;
function body(){return torso??=grid(54,73,(t,r)=>chest(t*TAU,-1.26+2.65*r),(t,r)=>{
  // Soft contact shade along the inferior folds. The torso's pigment and
  // geometry are independent of glandular state on either side.
  const a=t*TAU,y=-1.26+2.65*r,x=Math.abs(torsoWidth(y)*Math.sin(a)),front=clamp(Math.cos(a)*5);
  const fold=-.555+.36*(x-.47)**2;
  const occl=front*(.056*Math.exp(-(((y-fold)/.126)**2)-((x-.48)/.37)**4)+
    .034*Math.exp(-((x/.13)**2)-((y+.23)/.27)**2));
  const v=3*smooth((r-.45)*2)-5*smooth((.26-r)*3);
  return [248+v-occl*61,211+v-occl*247,192+v-occl*164];
});}

const arms=(side:Side)=>grid(45,33,(t,r)=>{
  const y=-1.28+2.059*r,a=t*TAU;
  return [side*(profile(armForm,y,1)+profile(armForm,y,2)*Math.sin(a)),y,profile(armForm,y,4)+profile(armForm,y,3)*Math.cos(a)];
},(t,r)=>{const inner=clamp(-Math.sin(t*TAU)*2.6)*smooth((.94-r)/.24);return [249-inner*7,210-inner*21,190-inner*12];});

function choker(){const mesh=grid(11,81,(t,r)=>{
  const a=t*TAU,y=.952+.090*r-.010*Math.cos(a);const [x,_,z]=chest(a,y),relief=.008+.010*Math.sin(r*Math.PI);
  return [x+relief*Math.sin(a),y,z+relief*Math.cos(a)];
},(t,r)=>{const braid=r<.12||r>.88||r>.27&&r<.33,crease=Math.sin(Math.PI*r)**3;
  return braid?[210,152,126]:[75+19*crease,44+10*crease,69+16*crease]});mesh.material='silk';return mesh;}

function jewel(y:number,rx:number,ry:number,rz:number,z:number,kind:'metal'|'stone'){
  const mesh=grid(13,25,(t,r)=>{const a=t*TAU,b=(r-.5)*Math.PI,cr=Math.cos(b),drop=1-.29*Math.sin(b);
    return [rx*Math.sin(a)*cr*drop,y+ry*Math.sin(b),z+rz*Math.cos(a)*cr];},()=>kind==='stone'?[193,76,102]:[235,181,119]);mesh.material=kind;return mesh;
}

/** Two tapered, cross-sectioned locks at each outer shoulder. Their loose
 * curves frame the crop without falling over the central tissue. */
function lock(side:Side,which:number){
  const mesh=grid(39,17,(t,r)=>{
    const a=t*TAU,u=1-r,lo=(which?.39:.37)+side*.059,y=lo+(1.46-lo)*r;
    const swing=which?.08:-.16;
    const x=.57+.54*u+.10*Math.sin(Math.PI*u)+swing*smooth((u-.64)/.36)+side*.034*Math.sin(u*4.0);
    const z=.14+.21*Math.sin(u*2.3)-.10*r+(which?-.063:0);
    const radius=(which?.043:.092)*smooth(r/.43)**.73*(1+.12*Math.sin(r*8));
    return [side*(x+radius*Math.sin(a)),y,z+radius*(.31*Math.cos(a)+.30*Math.sin(a)*Math.sin(r*4.4))];
  },(t,r)=>{const a=t*TAU,u=1-r,light=Math.max(0,Math.cos(a+.49+.24*Math.sin(u*4)))**12,bounce=.4+.6*Math.sin(r*3.3),ridge=smooth((Math.cos(3*a+r*2)-.932)/.064);
    return [79+70*light*bounce+13*ridge,44+39*light*bounce+8*ridge,64+33*light*bounce+7*ridge];});mesh.material='hair';return mesh;
}

let costume:Array<[Mesh,number]>|undefined;
export function figure():Array<[Mesh,number]>{return costume??=[[body(),1],[arms(-1),-1],[arms(1),1],[choker(),1],
  [jewel(.934,.033,.035,.019,.237,'metal'),1],[jewel(.88,.046,.064,.018,.280,'metal'),1],
  [jewel(.88,.033,.048,.015,.294,'stone'),1],[lock(-1,0),-1],[lock(-1,1),-1],[lock(1,0),1],[lock(1,1),1]];}

export function wallPoint(side:Side,t:number,u:number):V{
  const y=-.58+1.23*t,a=.52+.84*u+.08*Math.cos(t*4.2),[x,_,z]=chest(side*a,y);
  return [x+side*.009*Math.sin(a),y,z+.009*Math.cos(a)];
}
let walls:Mesh[]|undefined;
export function wallMeshes(){return walls??=([-1,1] as Side[]).map(side=>{
  const m=grid(24,19,(u,t)=>wallPoint(side,t,u),(u,t)=>[u*127,(1-t)*195,1]);m.material='section';return m;
});}
