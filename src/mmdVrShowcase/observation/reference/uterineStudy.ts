import type {V} from '../../bodyState/breast/art/geometry';
import {grid} from '../../bodyState/breast/art/mesh';
import {blend,oval,sheet,strand,type Layer,type Study} from './forms';
import {createCurledPortrait,fetalNavel} from './curledPortrait';

const wall:V=[200,130,131],lining:V=[167,103,120],rim:V=[246,195,165];
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
  layers.push(...placenta(),...createCurledPortrait());
  const root=disc(-.06,.05),loop:V=[.306,.124,.286];
  layers.push(strand([[...root,.022],[.405,.51,-.028,.024],[.431,.365,-.033,.025],[.390,.184,.028,.025],
    [...loop,.025],[.208,.110,.339,.024],[.107,.154,.351,.023],[.057,.240,.308,.021],[...fetalNavel,.018]], [232,186,173]));
  return {adnexa,layers:[...halfShell(chamber,51),...halfShell(cervix,21),...halfShell(vaginalCuff,25,true),...layers],
    marks:[{at:chamber(.73,cutAzimuth(1),false),zh:'宫壁',en:'Uterine wall'},{at:root,zh:'胎盘',en:'Placenta'},
      {at:loop,zh:'脐带',en:'Cord'},{at:cervix(.50,cutAzimuth(0),false),zh:'宫颈',en:'Cervix'}]} satisfies Study&{adnexa:Layer[]};
}
