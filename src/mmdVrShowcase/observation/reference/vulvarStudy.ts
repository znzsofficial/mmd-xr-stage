import {TAU,type V} from '../../bodyState/breast/art/geometry';
import {grid} from '../../bodyState/breast/art/mesh';
import {blend,oval,strand,type Layer,type Study} from './forms';

// Fixed external specimen, in illustration coordinates. Each side has its own
// length, cushion and free margin; the two medial surfaces meet at rest.
const skin:V=[246,198,175],flush:V=[217,151,151],mucosa:V=[247,156,153];
const bell=(x:number,w:number)=>Math.exp(-(x*x)/(w*w));
function pad(side:number,inner:boolean):Layer{
  function form(u:number,t:number):V{
    const a=u*TAU,h=Math.max(0,Math.sin(Math.PI*t)),s=Math.sin(a),c=Math.cos(a);
    if(inner){
      const edge=h**.82,roll=Math.sin(12*t+.8*side)+.48*Math.sin(23*t-.6*side);
      const w=edge*(.051+.031*h+.025*bell(t-.34,.18)),mid=edge*(.067+.021*t)+.009*side*Math.sin(8*t);
      return [side*(mid+s*w),-.42+1.22*t+side*.016*h,
        .157+.059*t+edge*(.140+.066*c+.063*(1+c)*(.40+.60*bell(t-.55,.36)))+.030*roll*edge*(.5+.5*c)];
    }
    const edge=h**.53,bulk=.93+.16*side*(t-.43)+.08*Math.sin(5*t+.6*side),w=edge*(.154+.077*bell(t-.54,.35))*bulk;
    const mid=edge*(.19+.096*bell(t-.56,.30))+.012*side*h;
    return [side*(mid+w*s),-.50+1.47*t+side*.025*h,
      .10+.11*t+edge*(.054+.181*c*bulk+.035*bell(t-.69,.24))-.024*s*h+.014*h*c*Math.sin(6*t+.8*side)];
  }
  const mesh=grid(inner?52:61,inner?47:65,form,(u,t)=>{
    const a=u*TAU,s=Math.sin(a),c=Math.cos(a),h=Math.sin(t*Math.PI);
    if(inner){const lip=bell(a-.13,.69)+bell(a-TAU-.13,.69);
      return blend(blend(mucosa,[216,124,132],.18+.26*(1-c)*.5+.14*(1-s)*h),[255,189,170],lip*(.33+.23*h));}
    // Diffuse subdermal venous wash follows the lateral flank rather than
    // sitting on it as linework. Medial transition remains warm, not purple.
    const course=.82+.19*Math.sin(6.4*t+.7*side)+.11*Math.sin(13.1*t),fork=course+1.85*(t-.48);
    const blood=Math.max(bell(a-course,.108)*bell(t-.53-.07*side,.22),.72*bell(a-fork,.092)*bell(t-.69,.12));
    return blend(blend(skin,flush,h*(.24+.39*(1-s)*.5)),[164,125,150],blood*.43);
  });
  if(inner)mesh.material='silk'; // narrow, normal-lit sheen on mucosa; lateral skin stays matte
  return [mesh,side];
}
export function createVulvarStudy():Study{
  const layers:Layer[]=[
    // A continuous perineal bed behind the paired folds, with more depth at
    // the superior root; there is no open lumen behind their central seam.
    oval([0,.23,.098],[.426,.747,.160],skin,([x,y,z])=>[x*(.98+.21*y),y,z+.11*y]),
    pad(-1,false),pad(1,false),pad(-1,true),pad(1,true),
  ];
  // The preputial fold forks into the inner lamellae. Its rounded apex sits
  // under the superior cushion, rather than floating above the commissure.
  layers.push(strand([[-.081,.44,.377,.009],[-.087,.59,.412,.031],[-.059,.679,.395,.043],
    [0,.713,.378,.046],[.061,.661,.397,.043],[.095,.565,.393,.027],[.077,.465,.361,.006]], [238,168,148],.85));
  return {layers,marks:[]};
}
