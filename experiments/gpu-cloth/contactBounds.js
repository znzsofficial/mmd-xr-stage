// One row per capsule and one per consecutive block of four. Keep authored
// order: an early projection can move a node INTO a later collider. The shader
// retests the current point after every projection rather than caching hit masks.
export const MAX_CAPS=64, BOX_FLOATS=(MAX_CAPS+MAX_CAPS/4)*8;
export function writeBounds(caps,boxes){
  for(let i=0;i<caps.length/8;i++){
    const o=i*8,g=(MAX_CAPS+(i>>2))*8,r=caps[o+3];
    for(let j=0;j<3;j++){
      const a=caps[o+j],b=caps[o+4+j],pad=2e-6*(1+Math.max(Math.abs(a),Math.abs(b),r));
      const lo=boxes[o+j]=Math.min(a,b)-r-pad,hi=boxes[o+4+j]=Math.max(a,b)+r+pad;
      boxes[g+j]=(i%4)?Math.min(boxes[g+j],lo):lo;boxes[g+4+j]=(i%4)?Math.max(boxes[g+4+j],hi):hi;
    }
  }
}
