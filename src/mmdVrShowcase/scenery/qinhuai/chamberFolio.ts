// One continuous silk across three leaves. Local X follows the hinge line;
// local Z is the painted (door-facing) side, including on the returned leaf.
const hinges=[[-7.90,-11.32],[-7.29,-11.47],[-6.69,-11.34],[-6.12,-11.56]];
export const chamberLeaves=hinges.slice(1).map(([b,v],i)=>{
  const [a,u]=hinges[i],w=Math.hypot(b-a,v-u),cos=(b-a)/w,sin=(u-v)/w;
  return {x:(a+b)/2,z:(u+v)/2,w,d:.055,cos,sin,yaw:Math.atan2(sin,cos)};
});
export const screenBody={bottom:.18,top:1.69,artBottom:.34,artTop:1.62};
export function leafXZ(l:typeof chamberLeaves[number],u:number,n:number):[number,number]{return [l.x+u*l.cos+n*l.sin,l.z-u*l.sin+n*l.cos];}

// Open thread-bound double leaf, on a slope toward the near edge of the vanity.
export const folio={offsetX:-.235,offsetZ:.258,height:1.079,w:.58,h:.325,tilt:-.96};
export const paperBow=(u:number)=>.002+.010*Math.sin(Math.PI*Math.abs(u))-.0015*Math.abs(u);
export const spreads=3;
// Four equally padded paintings in one local 1536 × 1024 print; tile 0 is silk.
export function folioUv(tile:number,u:number,v:number):[number,number]{return [((tile%2)*768+8.5+751*u)/1536,1-(Math.floor(tile/2)*512+8.5+495*(1-v))/1024];}
