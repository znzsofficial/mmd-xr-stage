import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping } from 'three';
import type { StockingSide, StockingTear } from './stockingState';

// Filter the knit, welt and ladder together at distance. Both backends use the
// ordinary material alpha map (green); a missing thread never writes depth.
const width = 256, height = 512, tau = Math.PI * 2;
let knit: Uint8Array | undefined;
function intactFabric() {
  if (knit) return knit;
  knit = new Uint8Array(width * height * 4);
  for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
    const u=(x+.5)/width, v=(y+.5)/height;
    const warp=.5+.5*Math.cos(tau*(u*48+.28*Math.cos(tau*v*100)));
    const weft=.5+.5*Math.cos(tau*(v*112+.3*Math.sin(tau*u*48)));
    let alpha=.38+.11*warp+.065*weft;
    if (v<.075) alpha+=.12*(1-v/.075); // denser toe box
    if (Math.min(u,1-u)<.007 && v<.948) alpha+=.12; // back seam, also wrapping the sole
    if (v>.945) {
      alpha=.76+.06*warp;
      if (v<.952 || v>.989) alpha=.91;
      if ((v>.958 && v<.962) || (v>.98 && v<.984)) alpha=.64;
    }
    const i=4*(y*width+x);
    knit[i]=knit[i+1]=knit[i+2]=Math.round(255*alpha); knit[i+3]=255;
  }
  return knit;
}

function cut(bytes: Uint8Array, tear: StockingTear) {
  // In chart space one U turn is shorter than toe-to-welt travel. Build an
  // elongated opening following the pull, including pulls crossing the seam.
  const {u,v,du,dv}=tear, aspect=.47, dx=du*aspect, dy=dv, length=Math.hypot(dx,dy);
  if (!(length>0) || ![u,v,du,dv].every(Number.isFinite)) return;
  const radius=Math.min(.054,.009+.27*length), padding=radius*1.6;
  const x0=Math.floor((Math.min(u,u+du)-padding/aspect)*width), x1=Math.ceil((Math.max(u,u+du)+padding/aspect)*width);
  const y0=Math.max(0,Math.floor((Math.min(v,v+dv)-padding)*height)), y1=Math.min(height-1,Math.ceil((Math.max(v,v+dv)+padding)*height));
  const phase=tau*(u*3+v*5), nx=-dy/length, ny=dx/length;
  for (let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) {
    const px=((x+.5)/width-u)*aspect, py=(y+.5)/height-v;
    const t=Math.max(0,Math.min(1,(px*dx+py*dy)/(length*length)));
    const neck=Math.sin(t*Math.PI), rim=radius*(.33+.67*neck);
    const bend=.18*radius*neck*Math.sin(4*Math.PI*t+phase);
    const d=Math.hypot(px-dx*t-nx*bend,py-dy*t-ny*bend);
    const fray=.085*Math.sin(tau*(x/13+y/17)+phase)+.05*Math.cos(tau*y/7);
    const edge=d/rim-fray, i=4*(y*width+((x%width)+width)%width);
    if (edge>1.25 || bytes[i+1]===0) continue;
    let opacity=0;
    if (edge>.92) {
      // Several broken weft ends survive around a drawn-out, denser rim;
      // the central opening is fully discarded, including specular light.
      const loops=.5+.5*Math.sin(tau*(y/4+x/16));
      opacity=edge<1.04?Math.round(168*loops):Math.min(244,bytes[i+1]+Math.round(60*(1.25-edge)/.21));
    }
    bytes[i]=bytes[i+1]=bytes[i+2]=opacity;
  }
}

export function stockingFabric(side: StockingSide) {
  const bytes=intactFabric().slice(), map=new DataTexture(bytes,width,height);
  map.name=`Stocking knit · ${side}`; map.channel=1; map.wrapS=RepeatWrapping;
  map.generateMipmaps=true; map.magFilter=LinearFilter; map.minFilter=LinearMipmapLinearFilter; map.needsUpdate=true;
  let last: readonly StockingTear[] | undefined;
  return { map, update(tears: readonly StockingTear[]) {
    if (last===tears) return;
    const appended=last && tears.length>=last.length && last.every((tear,i)=>tears[i]===tear);
    const added=tears.slice(appended?last!.length:0).filter(tear=>tear.side===side);
    const reset=!appended && !!last?.some(tear=>tear.side===side);
    if (reset) bytes.set(intactFabric());
    for (const tear of added) cut(bytes,tear);
    if (reset || added.length) map.needsUpdate=true;
    last=tears;
  }, covers(u:number,v:number) {
    if (!(v>=0 && v<1)) return false;
    const x=Math.floor((u-Math.floor(u))*width), y=Math.min(height-1,Math.floor(v*height));
    return bytes[(y*width+x)*4+1]>12;
  } };
}
