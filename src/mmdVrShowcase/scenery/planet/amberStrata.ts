/** Flattish resin flow terraces and weathered cortex, all in metres. Leave a
 * spherical cap at the two equatorial footprints and the north survey stop. */
export function amberRelief(x:number,y:number,z:number){
  const k=Math.max(0,Math.min(1,(.88-Math.max(Math.abs(x),y))/.25));
  if(k===0)return 0;
  const flow=2.9*y+1.32*x-.83*z+.28*Math.sin(4*z-2*x)+.12*Math.cos(6*y+x);
  const rim=.105*Math.tanh(1.8*Math.sin(5*flow));
  return k*k*(3-2*k)*(rim+.084*Math.cos(3*y+4*z)-.13*Math.exp(-((flow-.36)**2)/.08));
}
