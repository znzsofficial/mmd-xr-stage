import {Vector3} from 'three';
import {PLANET_RADIUS} from './planetLayout';

// Signed latitude east of the old meridian. The bends skirt the original
// aqua / coral clusters, pass BETWEEN the forks, then reach the south beacon.
// The same survey line sites the paint, copper nails and instrument faces.
const tau=Math.PI*2;
const knots=[
  [0,0],[.18,.128],[.258,.19],[.45,0],[.74,-.14],[1.02,-.245],
  [1.29,-.19],[1.73,-.08],[2.17,.065],[2.49,.12],[2.82,-.07],
  [3.01,-.115],[3.36,-.055],[4.12,.09],[4.93,.01],[5.54,-.09],[tau,0],
] as const;
function slope(i:number){
  const [a,h]=knots[i], [p,x]=i===0?[knots.at(-2)![0]-tau,knots.at(-2)![1]]:knots[i-1];
  const [n,y]=i===knots.length-1?[tau+knots[1][0],knots[1][1]]:knots[i+1];
  const l=(h-x)/(a-p),r=(y-h)/(n-a);return l*r<=0?0:2*l*r/(l+r);
}
const slopes=knots.map((_,i)=>slope(i));
function curve(angle:number){
  const a=((angle%tau)+tau)%tau;let i=0;while(i<knots.length-2&&a>knots[i+1][0])i++;
  const [start,x]=knots[i],[end,y]=knots[i+1],w=end-start,t=(a-start)/w;
  const l=w*slopes[i],r=w*slopes[i+1],c=3*(y-x)-2*l-r,b=2*(x-y)+l+r;
  return {latitude:x+t*(l+t*(c+t*b)),grade:(l+t*(2*c+3*t*b))/w};
}
export function courseUp(a:number){
  const {latitude:b}=curve(a),s=Math.cos(b);
  return new Vector3(Math.sin(b),s*Math.cos(a),-s*Math.sin(a));
}
/** Approximate perpendicular metres from the walking line. Stored once per
 * crust vertex; there is no atan seam in the fragment shader near either pole. */
export function courseDistance(x:number,y:number,z:number){
  const {latitude,grade}=curve(Math.atan2(-z,y));
  return PLANET_RADIUS*(Math.asin(Math.min(1,Math.max(-1,x)))-latitude)/Math.hypot(1,grade/Math.cos(latitude));
}
