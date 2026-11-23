/** A DOM observation window has a CSS size independent of its backing store.
 * The detached XR canvas, on the other hand, is displayed as a texture. Use
 * that texture's pixels on both eyes, independent of head jitter/distance. */
export function exteriorViewport(canvas:HTMLCanvasElement,w:number,h:number,changed:()=>void){
  if(!canvas.isConnected||typeof window==='undefined')return;
  const initialWidth=canvas.width,initialHeight=canvas.height;
  let scale=canvas.width/w,live=true;
  function measure(){
    if(!live)return;
    const rect=canvas.getBoundingClientRect();if(!(rect.width>0&&rect.height>0))return;
    const density=Math.max(rect.width/w,rect.height/h)*(window.devicePixelRatio||1);
    // Only reraster on a tier transition. Never shrink the element's intrinsic
    // size below its authored dimensions: width:auto/max-height layouts would
    // otherwise feed their smaller bitmap size back into the ResizeObserver.
    const next=Math.max(.5,Math.min(3,Math.ceil((density-1/w)*4)/4)); // allow a rounded backing pixel
    if(next===scale)return;
    scale=next;const width=Math.max(initialWidth,Math.round(w*next)),height=Math.max(initialHeight,Math.round(h*next));
    if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
    changed();
  }
  measure();
  const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);
  try{observer?.observe(canvas,{box:'device-pixel-content-box'});}catch{observer?.observe(canvas);}
  window.addEventListener('resize',measure);
  return {get scale(){return scale;},dispose(){live=false;observer?.disconnect();window.removeEventListener('resize',measure);
    if(canvas.width!==initialWidth)canvas.width=initialWidth;if(canvas.height!==initialHeight)canvas.height=initialHeight;}};
}
