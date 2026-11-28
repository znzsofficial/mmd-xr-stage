import { MathUtils } from 'three';
import { blocks, board, lowerFrontZ, upperFrontZ, UPPER } from './arcadeLayout';
import { SHORE_SUN } from '../shoreDaylight';

// Bake the colour of the static floor/wall finishes at their vertices. The
// ray goes through the actual door and slab cutouts, on either floor. The
// far court and skyline keep their authored pigments.
const [sx,sy,sz]=SHORE_SUN;
const casters=blocks.filter(b=>b.y+b.h/2>.10).map(b=>({
  left:b.x-b.w/2,right:b.x+b.w/2,bottom:b.y-b.h/2,top:b.y+b.h/2,back:b.z-b.d/2,front:b.z+b.d/2,
}));
function blocked(x:number,y:number,z:number){
  // The shore sun points +X, +Y, -Z. Reject intervals behind the finish.
  return casters.some(b=>Math.max(.002,(b.left-x)/sx,(b.bottom-y)/sy,(b.front-z)/sz)
    <=Math.min((b.right-x)/sx,(b.top-y)/sy,(b.back-z)/sz));
}
export function hallShade(x:number,y:number,z:number,shadows:boolean){
  const upper=y>UPPER-.15,front=upper?upperFrontZ:lowerFrontZ;
  if(x< -7.03||x>14||z< -4.52||z>front+.03||y<-.01)return 1;
  const ground=1-MathUtils.smoothstep(Math.abs(y-(upper?UPPER:0)),.03,.8);
  let contact=0;
  if(x<=7){
    const wall=Math.min(7-Math.abs(x),front-z,z+4.5);
    const sign=Math.hypot(Math.max(0,Math.abs(x)-board.w/2),Math.max(0,Math.abs(z-board.z)-board.d/2));
    const pillar=Math.hypot(Math.max(0,Math.abs(Math.abs(x)-2.24)-.52),Math.max(0,Math.abs(z-1.94)-.54));
    contact=Math.max(.19*Math.exp(-3*Math.abs(wall)),.20*Math.exp(-5*sign*sign),upper?0:.25*Math.exp(-6*pillar*pillar));
  }else if(!upper){
    const under=MathUtils.smoothstep(z,-4.5,-3.5)*(1-MathUtils.smoothstep(z,5.15,6.65));
    contact=under*(.16+.15*Math.exp(-3*Math.min(Math.abs(x-7.15),Math.abs(x-10.98))));
  }
  const sunShade=(!shadows&&blocked(x,y,z)) ? .78 : 1;
  return (1-(.48+.52*ground)*contact)*sunShade;
}
