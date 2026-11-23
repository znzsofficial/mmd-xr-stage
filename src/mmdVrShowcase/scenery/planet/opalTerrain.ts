import {Color,Float32BufferAttribute,Quaternion,SphereGeometry,Vector3} from 'three';
import {PLANET_RADIUS as R} from './planetLayout';
import {courseDistance} from './opalCourse';

const smooth=(a:number,b:number,v:number)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t);};
// Cosine distance has no seam or pole. Broad cinder domes flank the meridian;
// a shallow impact basin crosses it on the far side. Units are metres.
const hills=[[-.54,.68,-.50,2.05,.056],[.46,.73,-.50,1.76,.038],[-.59,-.41,-.69,1.72,.081],[.76,-.49,.41,2.07,.065],[-.51,.36,.78,1.45,.041],[.11,-.98,-.17,.78,.068]]
  .map(([x,y,z,h,w])=>{const n=Math.hypot(x,y,z);return [x/n,y/n,z/n,h,w] as const;});
export function crustRadius(x:number,y:number,z:number){
  let h=.03+.15*Math.sin(7*x+3*z)*Math.cos(5*y-3*x)+.075*Math.sin(11*z-4*x+3*y);
  for(const [a,b,c,peak,width] of hills){const d=Math.max(0,1-(x*a+y*b+z*c)),flank=Math.exp(-d/width);h+=peak*(.81*flank+.25*smooth(.39,.67,flank));}
  const crater=1-(.0799*x-.5695*y-.8182*z);
  h+=.56*Math.exp(-((crater-.051)**2)/.00065)-.71*Math.exp(-crater/.037);
  const fade=smooth(.029,.103,1-y);
  return R+h*fade+(1-fade)*(R/Math.max(.89,y)-R-.055);
}
export function terrainAltitude(p:{x:number;y:number;z:number}){const y=p.y+R,n=Math.hypot(p.x,y,p.z);return n<1e-6?-R:n-crustRadius(p.x/n,y/n,p.z/n);}

export const crustSegments=[168,104] as const;
export function makeCrust(painted=true){
  const g=new SphereGeometry(1,...crustSegments),pos=g.attributes.position,colors=new Float32Array(painted?pos.count*3:0);
  const course=new Float32Array(painted?pos.count:0);
  const shale=new Color('#48595c'),smoke=new Color('#738887'),slate=new Color('#526969'),color=new Color();
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),r=crustRadius(x,y,z),h=r-R;
    pos.setXYZ(i,x*r,y*r,z*r);if(!painted)continue;
    const ribbon=.47*Math.sin(x*5+y*4-z*2)+.31*Math.cos(z*6.5+x*2-.6)+.14*Math.sin(11*y+7*x);
    const contour=h+.26*ribbon;
    color.copy(shale).lerp(smoke,smooth(-.46,1.7,contour)).lerp(slate,.39*(1-smooth(.04,.53,Math.abs(Math.sin(4.1*contour+1.5*ribbon)))));
    color.toArray(colors,3*i);course[i]=courseDistance(x,y,z);
  }
  if(painted){g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setAttribute('opalOffset',new Float32BufferAttribute(course,1));g.computeVertexNormals();g.computeBoundingSphere();}return g;
}

function instrument(name:string,x:number,y:number,z:number,r:number,height:number,style:'fork'|'dome'|'beacon'|'geode'){
  const up=new Vector3(x,y,z).normalize(),floor=crustRadius(up.x,up.y,up.z),base=up.clone().multiplyScalar(floor);base.y-=R;
  return {name,up,base,floor,r,height,style,rotation:new Quaternion().setFromUnitVectors(new Vector3(0,1,0),up)};
}
export const stations=[
  instrument('west-prism',-.13,.90,-.42,.49,2.05,'fork'),instrument('east-prism',.12,.90,-.42,.43,1.62,'fork'),
  instrument('copper-transit',.40,.36,-.84,.97,2.17,'dome'),instrument('tide-beacon',-.24,-.96,-.15,.64,2.54,'beacon'),
  instrument('night-transit',-.41,-.16,.90,.78,1.92,'dome'),
  instrument('landing-observatory',-.34,.90,-.29,1.03,2.25,'dome'),
  instrument('aqua-quartz',.31,.91,-.23,.57,1.47,'geode'),instrument('coral-quartz',-.36,.49,-.80,.74,1.94,'geode'),
  instrument('sunset-quartz',.25,-.72,-.64,.79,1.74,'geode'),instrument('west-quartz',-.88,-.38,.23,.61,1.53,'geode'),
];
/** Cylinder in the station's local tangent frame, shared with its Rapier
 * silhouette. The touchable structures stay outside the actor landing. */
export function stationBlocks(p:{x:number;y:number;z:number},radius:number,height:number){return stations.some(s=>{
  const x=p.x-s.base.x,y=p.y-s.base.y,z=p.z-s.base.z,u=x*s.up.x+y*s.up.y+z*s.up.z;
  return u<s.height&&u+height>-.15&&x*x+y*y+z*z-u*u<(s.r+radius)**2;
});}

type Point=[number,number,number];
function stationPortrait(name:string,dx:number,dz:number){
  const s=stations.find(v=>v.name===name)!,look=s.base.clone().addScaledVector(s.up,s.height*.52);
  const eye=s.base.clone().add(new Vector3(dx,0,dz).applyQuaternion(s.rotation));
  const up=eye.clone().add(new Vector3(0,R,0)).normalize();eye.copy(up).multiplyScalar(crustRadius(up.x,up.y,up.z)+1.56);eye.y-=R;
  return {eye:eye.toArray() as Point,aim:look.toArray() as Point,up:up.toArray() as Point};
}
export const transitPortrait=stationPortrait('copper-transit',2.65,3.9),southPortrait=stationPortrait('tide-beacon',2.4,3.7);
