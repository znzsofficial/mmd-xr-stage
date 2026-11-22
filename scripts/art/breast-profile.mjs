/** Sample the final 90° left-facing exterior, not its parameters or raw mesh.
 * Pass the painted DOM canvas or the XR body:breast-observation mesh's
 * material.map.image. Freeze first and use the same actor, fill and angle.
 * All coordinates below are logical pixels of the 400 × 260 figure. */
export function readBreastProfile(canvas){
  const {width:w,height:h}=canvas,ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Expected a painted 2D canvas');
  const y0=151,y1=213,start=Math.round(y0*h/260),end=Math.round(y1*h/260);
  const px=ctx.getImageData(0,start,w,end-start+1).data;
  return Array.from({length:y1-y0+1},(_,i)=>{
    const y=i+y0,offset=(Math.round(y*h/260)-start)*w*4;
    // Scan across the plum field to the first lit edge, not the rose pigment.
    for(let x=0;x<w;x++)if(px[offset+4*x]>96)return {y,x:x*400/w};
    throw Error(`No painted profile at y=${y}`);
  });
}

/** Positive delta = an exterior edge moved towards the left background. */
export function compareBreastProfile(soft,raised){
  return soft.map(({x,y},i)=>({y,extension:x-raised[i].x}));
}
