import {encodeSwatch} from '../swatch.js';

// An original PMX, not procedural contact points inserted into the solver.
// Eight columns leave a ~20 cm span between hem bones. The +/-45 degree sites
// face the interiors of indexed panels rather than a column of skirt nodes.
export function bimanualSparsePmx() {
  const bone=[{name:'waist',p:[0,10,0],parent:-1}], vertices=[], groups=[[],[],[]], joint=[];
  const body=[{name:'waist',b:0,p:bone[0].p,r:.35,h:0,dyn:false}], count=8;
  for(let row=0;row<3;row++)for(let k=0;k<count;k++){
    const angle=(k+.5)*Math.PI*2/count,r=[1.7,2.5,3.4][row],y=[10,8.3,6.7][row];
    const p=[r*Math.sin(angle),y,-r*Math.cos(angle)], b=bone.length;
    bone.push({name:`skirt ${row} ${k}`,p,parent:row?b-count:0});
    body.push({name:`skirt ${row} ${k}`,p,b,r:.12,h:0,dyn:true});
    vertices.push({p,b,normal:[Math.sin(angle)*.87,.49,-Math.cos(angle)*.87]});
  }
  for(let row=0;row<3;row++)for(let k=0;k<count;k++){
    const i=row*count+k,next=row*count+(k+1)%count;
    joint.push([i+1,row?i-count+1:0,vertices[i].p],[i+1,next+1,vertices[i].p]);
    if(row<2)groups[1].push(i,i+count,next,next,i+count,next+count);
  }
  return encodeSwatch({bone,body,joint,vertices,groups},'indexed-panel-swatch.pmx');
}
