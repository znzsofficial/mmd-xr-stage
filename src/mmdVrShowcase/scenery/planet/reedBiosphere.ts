import {Vector3} from 'three';

/** World metres on the Reedwater moon. Water is a separate spherical shell;
 * feet follow the actual lake bed, so the visitor can wade across a lagoon. */
export const reedSeaLevel=-.15;
export const reedCentre=new Vector3(-14,6,19),reedRadius=6.6;
const unit=(x:number,y:number,z:number)=>new Vector3(x,y,z).normalize();
export const reedLake=unit(.19,.85,-.50),reedGauge=unit(-.16,.878,-.45);
const pools=[{up:reedLake,width:.078},{up:unit(.62,.25,-.74),width:.147},{up:unit(-.49,-.17,.86),width:.22},
  {up:unit(-.87,-.43,-.2),width:.125},{up:unit(.38,-.91,-.14),width:.13}];
export function reedRelief(x:number,y:number,z:number){
  const shoal=.12*Math.sin(6*x+4*z)*Math.cos(3*y-5*z)+.11*Math.sin(4*z-7*y+x);
  let basin=0;
  for(const {up,width} of pools){const d=(1-x*up.x-y*up.y-z*up.z)/width;basin=Math.max(basin,Math.exp(-d*d*1.09));}
  const meander=Math.sin(2.4*x-3.5*z+1.18*y+.69*Math.cos(4.5*y+x));
  basin=Math.max(basin,.89*Math.exp(-11.4*meander*meander));
  const ground=.26+shoal+.13*Math.cos(4.6*x+3*y-5*z)-(.79+shoal*.55)*basin;
  const t=Math.min(1,Math.max(0,(.989-y)/.075));return ground*t*t*(3-2*t);
}
export const reedPoint=(n:Vector3,h=0)=>n.clone().multiplyScalar(reedRadius+reedRelief(n.x,n.y,n.z)+h).add(reedCentre);

type Point=[number,number,number];
const shoreEye=unit(-.15,.70,-.69),groveEye=unit(-.65,.67,.36);
export const reedShots=[{key:'reedGlobe',eye:reedCentre.clone().add(new Vector3(-9.5,13.6,-11.5)).toArray() as Point,aim:reedCentre.toArray() as Point},
  {key:'reedShore',eye:reedPoint(shoreEye,1.42).toArray() as Point,aim:reedPoint(reedLake,.21).lerp(reedPoint(reedGauge,.52),.52).toArray() as Point,up:shoreEye.toArray() as Point},
  {key:'reedGrove',eye:reedPoint(groveEye,1.36).toArray() as Point,aim:reedPoint(unit(-.55,.8,-.12),.85).toArray() as Point,up:groveEye.toArray() as Point}] as const;

// Surveyed groves leave an open approach from the north collar to the water gauge.
export const groveSites=[[-.55,.8,-.12,1.57],[-.69,.53,-.46,1.96],[-.32,.64,-.70,1.25],
  [.48,.85,-.13,1.62],[.70,.68,.22,1.48],[.78,.23,-.43,1.37],[-.64,-.50,.56,1.87],
  [.36,-.47,.8,1.53],[-.55,-.80,-.30,1.48],[-.8,.31,.52,1.53],[.84,-.34,-.4,1.65]]
  .map(([x,y,z,height])=>{const up=unit(x,y,z);return {up,base:reedPoint(up),height};})
  .filter(s=>reedRelief(s.up.x,s.up.y,s.up.z)>reedSeaLevel+.035);
export function reedTrunkBlocks(p:Vector3,r:number,h:number){
  return groveSites.some(({up,base,height})=>{const x=p.x-base.x,y=p.y-base.y,z=p.z-base.z,a=x*up.x+y*up.y+z*up.z;
    return a<height*.81&&a+h>-.07&&x*x+y*y+z*z-a*a<(r+.105)**2;});
}
