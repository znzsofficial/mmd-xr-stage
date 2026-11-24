import type {V} from '../../bodyState/breast/art/geometry';
import {grid,VERTEX_STRIDE} from '../../bodyState/breast/art/mesh';
import {blend,oval,sheet,strand,type Layer,type Study} from './forms';

const skin:V=[248,199,168],warm:V=[220,151,139],wall:V=[200,130,131],lining:V=[167,103,120],rim:V=[246,195,165];
const placeFigure=([x,y,z]:V):V=>[x*.80-.095,y*.80+.08,z*.80+.073];
const navel=placeFigure([.151,.255,.332]);
const head:V=[-.17,.66,.25];
// The chin folds toward the hands. The head's own yaw separates the nose,
// forehead and ear in both the anterior and sagittal views.
function skull([x,y,z]:V):V{
  const tilt=.29,turn=-.52,Y=y*Math.cos(tilt)-z*Math.sin(tilt),Z=y*Math.sin(tilt)+z*Math.cos(tilt);
  return [x*Math.cos(turn)+Z*Math.sin(turn),Y,Z*Math.cos(turn)-x*Math.sin(turn)];
}
function face(x:number,y:number,z:number):V{const p=skull([x,y,z]);return [p[0]+head[0],p[1]+head[1],p[2]+head[2]];}
function curledFigure():Layer[]{
  const limbs:Layer[]=[oval([.10,.30,.20],[.188,.30,.142],skin,([x,y,z])=>[x-.43*y,y,z+.06*(y/.30)**2]),
    oval(head,[.214,.222,.198],skin,([x,y,z])=>skull([x*(.94+.18*y/.222),y,z+.026*Math.exp(-(((y+.113)/.053)**2))*Math.max(0,z/.198)])),
    oval(face(0,-.036,.187),[.037,.040,.039],skin,skull),oval(face(0,-.117,.154),[.061,.045,.033],skin,skull)];
  limbs.push(strand([[-.039,-.093,.182],[-.010,-.090,.192],[.002,-.092,.194],[.014,-.090,.192],[.040,-.094,.180]].map(([x,y,z],i)=>[...face(x,y,z),i===0||i===4?.001:.004]),[167,102,101]));
  for(const s of [-1,1]){
    limbs.push(oval(face(.193*s,-.016,-.002),[.034,.048,.027],warm,skull));
    limbs.push(strand([[-.128,-.006,.157],[-.098,-.021,.177],[-.064,-.023,.190],[-.037,-.016,.196]].map(([x,y,z],i)=>[...face(x*s,y,z),i===1||i===2?.006:.002]),[125,79,78]));
    const dz=.07*s;
    // Thigh returns toward the belly, calf folds underneath. Offset the far
    // knee, heel and wrist, so the pose reads through the whole half turn.
    limbs.push(strand([[.19,.12,.19+dz,.072],[.30,.14,.28+dz,.089],[.32+.04*s,.28,.33+dz,.069],
      [.24+.04*s,.23,.40+dz,.047],[.11+.04*s,.12,.41+dz,.033],[.07+.04*s,.11,.42+dz,.017]],skin));
    limbs.push(oval([.085+.04*s,.12,.42+dz],[.077,.032,.041],skin,([x,y,z])=>[x,y+.28*x,z]));
    limbs.push(strand([[-.01+s*.09,.47,.22+dz*.45,.055],[.037+s*.13,.36,.29+dz*.55,.052],
      [.01+s*.13,.35,.36+dz*.60,.042],[-.042+s*.081,.45,.39+dz*.62,.030],[-.071+s*.073,.48,.39+dz*.64,.014]],skin));
    limbs.push(oval([-.064+s*.074,.48,.39+dz*.64],[.037,.047,.027],skin));
  }
  return limbs;
}
// Illustration units. The lumen narrows to the internal os; the fundal wall
// also has true axial thickness, not a stroke at the silhouette.
function chamber(t:number,a:number,inner:boolean):V{
  const bulge=Math.sin(Math.PI*t)**.58*(.56+.30*t),r=(inner?.029:.13)*(1-t)**2+bulge*(inner?.84:1);
  const y=-.135+1.155*t-(inner?.088*t**1.4:0);
  return [r*Math.sin(a),y,.16+.095*t+r*.81*Math.cos(a)];
}
type Shell=(t:number,a:number,inner:boolean)=>V;
function cervix(t:number,a:number,inner:boolean):V{
  const h=Math.sin(Math.PI*t),r=(inner?.021:.054)*(1-t)+(inner?.029:.13)*t+h*(inner?.007:.046)+(!inner?.058*Math.sin(Math.PI*Math.min(1,t*4))**.75:0);
  return [r*Math.sin(a),-.356+.221*t,.215-.055*t+r*(inner?.55+.26*t:.91-.10*t)*Math.cos(a)];
}
function vaginalCuff(t:number,a:number,inner:boolean):V{
  // Upper cuff surrounds the descending cervix; its distal lumen is apposed.
  const flare=t*t,fold=inner?.016*Math.sin(28*t+.8*Math.sin(2*a))*(1-flare):0,r=inner?.07+.074*flare:.119+.057*flare;
  return [r*Math.sin(a),-.557+.291*t+.022*t*Math.cos(a),.343-.14*t+(r*(inner?.12+.80*flare:.62+.37*flare)+fold)*Math.cos(a)];
}
// Same physical oblique window from every view, including a continuous orbit.
// The far adnexa and the uncut shell will hide parts at a grazing angle.
const cutAzimuth=(u:number)=>1.03+u*3.05;
function halfShell(form:Shell,rows:number,canal=false):Layer[]{
  const az=cutAzimuth,insideColor=canal?[204,133,141] as V:lining;
  const layer=(inside:boolean):Layer=>sheet(rows,37,(u,t)=>form(t,az(u),inside),(u,t)=>{
    const a=az(u),wash=.09+.035*Math.sin(t*19+3*Math.cos(a))+.06*Math.cos(7*a+.6*Math.sin(9*t));
    return blend(inside?insideColor:wall,rim,wash+(canal&&inside?.18*(.5+.5*Math.sin(28*t+.8*Math.sin(2*a))):0));},inside?-1:1);
  const exposed=(u:number,t:number)=>{
    const grain=(.5+.5*Math.cos(60*t+7*u+.8*Math.sin(14*t)))**3;
    return blend(wall,rim,u>.83?.82:.20+.20*Math.sin(Math.PI*u)+.19*grain);
  };
  const layers=[layer(false),layer(true)];
  for(const edge of [0,1])layers.push(sheet(rows,13,(u,t)=>blend(form(t,az(edge),false),form(t,az(edge),true),u),exposed,edge===0?-1:1));
  for(const t of [0,1])layers.push(sheet(9,37,(u,r)=>blend(form(t,az(u),false),form(t,az(u),true),r),(u,r)=>exposed(r,t+.05*u),t===0?-1:1));
  return layers;
}
// An eccentric posterolateral placental bed conforms to the inner wall.
// Its fetal face bulges inward; every vessel and the cord insertion follows
// that face, including when the organ is seen in profile.
function disc(x:number,y:number):V{
  const t=.685+.177*y+.021*x,a=2.16+.51*x+.075*y,p=chamber(t,a,true),rho=Math.min(1,Math.hypot(x,y));
  const relief=.108*(1-rho**2)**.72;
  return [p[0]-relief*Math.sin(a),p[1],p[2]-relief*Math.cos(a)];
}
function placenta():Layer[]{
  const pink:V=[207,132,142],vessel:V=[242,182,164],layers:Layer[]=[
    [grid(21,53,(u,r)=>disc(r*Math.cos(u*2*Math.PI),r*Math.sin(u*2*Math.PI)),(u,r)=>blend(pink,[230,163,155],.23+.13*Math.cos(8*u*Math.PI+2*r))),1]];
  const branch=(q:number[][])=>strand(q.map(([x,y,r])=>{const p=disc(x,y);return [p[0]-.006,p[1],p[2]+.006,r];}),vessel,.8);
  for(let i=0;i<7;i++){
    const a=(i+.17)*Math.PI*2/7,xy=(d:number,bend:number,r:number)=>[d*Math.cos(a+bend)-.06*(1-d),d*Math.sin(a+bend)+.05*(1-d),r];
    layers.push(branch([xy(0,0,.012),xy(.31,.10,.010),xy(.64,-.06,.0065),xy(.93,-.18,.0015)]),
      branch([xy(.35,.09,.006),xy(.56,.24,.005),xy(.80,.35,.0015)]));
  }return layers;
}
export function createUterineStudy(){
  const layers:Layer[]=[],adnexa:Layer[]=[];
  for(const s of [-1,1]){
    const ostium=chamber(.76,s>0?1.53:cutAzimuth(.99),false);
    adnexa.push(strand([[...ostium,.033],[.71*s,.71,.12,.025],[.77*s,.63,.125,.022],[.80*s,.53,.04,.025],[.80*s,.47,.016,.034],[.77*s,.44,.04,.018]],wall));
    adnexa.push(oval([s*.745,.42,.018],[.066,.091,.057],[227,176,152],([x,y,z])=>[x+.23*s*y,y,z]));
  }
  const fetus=curledFigure();
  for(const [mesh] of fetus)for(let k=0;k<mesh.data.length;k+=VERTEX_STRIDE)mesh.data.set(placeFigure([mesh.data[k],mesh.data[k+1],mesh.data[k+2]]),k);
  layers.push(...placenta(),...fetus);
  const root=disc(-.06,.05),loop:V=[.196,.050,.21];
  layers.push(strand([[...root,.022],[.405,.51,-.028,.024],[.431,.365,-.033,.025],[.390,.184,.028,.025],
    [...loop,.025],[.095,.079,.328,.024],[.032,.178,.375,.023],[...navel,.018]], [232,186,173]));
  return {adnexa,layers:[...halfShell(chamber,51),...halfShell(cervix,21),...halfShell(vaginalCuff,25,true),...layers],
    marks:[{at:chamber(.73,cutAzimuth(1),false),zh:'宫壁',en:'Uterine wall'},{at:root,zh:'胎盘',en:'Placenta'},
      {at:loop,zh:'脐带',en:'Cord'},{at:cervix(.50,cutAzimuth(0),false),zh:'宫颈',en:'Cervix'}]} satisfies Study&{adnexa:Layer[]};
}
