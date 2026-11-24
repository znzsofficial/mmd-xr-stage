import type {V} from '../../bodyState/breast/art/geometry';
import {grid} from '../../bodyState/breast/art/mesh';
import {blend,oval,strand,type Layer,type Study} from './forms';

const skin:V=[248,199,168],warm:V=[220,151,139],wall:V=[200,130,131],lining:V=[167,103,120],rim:V=[246,195,165];
const placenta:V=[-.45,.45,-.044],navel:V=[.16,.26,.40];
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
export function chamber(t:number,a:number,inner:boolean):V{
  const bulge=Math.max(0,Math.sin(Math.PI*t))**.60*(.45+.34*t),r=.069*(1-t)**3+bulge;
  const y=-.22+1.23*t,shrink=inner?.913:1;
  return [r*shrink*Math.sin(a),inner?.39+(y-.39)*.936:y,.18+.085*t+r*.79*shrink*Math.cos(a)];
}
function section(angle:number):Layer[]{
  // Remove the observer-facing half, as with the ordinary atlas dissection.
  // The fetus, disc, cord and lower tract stay fixed in organ coordinates.
  const az=(u:number)=>angle+(u+.5)*Math.PI;
  const surface=(inside:boolean):Layer=>[grid(37,41,(u,t)=>chamber(t,az(u),inside),(u,t)=>{
    const grain=.15*(1+Math.sin(41*t+.65*Math.sin(13*u)))*(.5+.5*Math.sin(18*u+4*t));return blend(inside?lining:wall,rim,grain);}),inside?-1:1];
  const layers=[surface(false),surface(true)];
  for(const edge of [0,1])layers.push([grid(39,9,(u,t)=>blend(chamber(t,az(edge),false),chamber(t,az(edge),true),u),
    (u,t)=>blend(wall,rim,.38+.34*Math.sin(Math.PI*u)+.13*Math.cos(t*88+u*4))),edge===0?-1:1]);
  layers.push(oval([0,-.21,.18],[.108,.091,.080],wall));return layers;
}
export function createUterineStudy(){
  const layers:Layer[]=[],adnexa:Layer[]=[];
  for(const s of [-1,1]){
    adnexa.push(strand([[.49*s,.69,.22,.033],[.61*s,.66,.18,.025],[.68*s,.59,.125,.022],[.72*s,.50,.04,.025],[.72*s,.45,.016,.034],[.68*s,.41,.04,.018]],wall));
    adnexa.push(oval([s*.665,.40,.018],[.065,.091,.057],[227,176,152],([x,y,z])=>[x+.23*s*y,y,z]));
    layers.push(strand([[.063*s,-.20,.18,.044],[.043*s,-.27,.187,.043],[.035*s,-.35,.208,.038],[.038*s,-.45,.259,.034],[.052*s,-.51,.291,.019]],wall,.72));
  }
  layers.push(oval(placenta,[.080,.16,.147],[209,138,138],([x,y,z])=>[x-.18*y-.29*z,y,z]),...curledFigure());
  // Branching chorionic vessels radiate from the actual cord attachment.
  const root:V=[-.382,.45,.007];
  for(let j=0;j<8;j++){
    const a=j*.78+.14,dy=.144*Math.cos(a),dz=.119*Math.sin(a);
    layers.push(strand([[...root,.009],[-.384-.09*dy,.45+.31*dy,.007+.30*dz,.007],
      [-.394-.14*dy-.20*dz,.45+.69*dy,-.014+.71*dz,.005],[-.412-.17*dy-.27*dz,.45+.91*dy,-.027+.91*dz,.001]], [231,166,151]));
  }
  layers.push(strand([[...root,.019],[-.36,.41,.11,.023],[-.37,.26,.25,.025],[-.24,.19,.33,.024],
    [-.15,.24,.406,.023],[-.09,.30,.435,.021],[.022,.30,.43,.021],[...navel,.016]], [219,167,168]));
  return (degrees:number):Study&{adnexa:Layer[]}=>({adnexa,layers:[...section(-degrees*Math.PI/180),...layers],marks:[{at:placenta,zh:'胎盘',en:'Placenta'},{at:head,zh:'胎体',en:'Fetus'},{at:[-.24,.19,.33],zh:'脐带',en:'Cord'}]});
}
