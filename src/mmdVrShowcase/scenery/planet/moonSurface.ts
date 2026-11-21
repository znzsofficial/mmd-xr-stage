import {SphereGeometry} from 'three';
import {reedRelief} from './reedBiosphere';

type Direction={x:number;y:number;z:number};
type Profile={relief:'basins'|'rifts'|'salt'|'glaze'|'wetland'|'mica'|'sulfur';radius:number;station?:{up:Direction};jumpHeadings?:readonly Direction[]};
const pits=Array.from({length:30},(_,i)=>{
  const y=1-(i+.5)/15,s=Math.sqrt(1-y*y),a=i*2.39996+.38;
  return {x:s*Math.sin(a),y,z:s*Math.cos(a),width:.007+.036*((i*13%29)/29)**2};
});
const pans=Array.from({length:24},(_,i)=>{
  const y=1-(i+.5)/12,a=i*2.39996+.90+.13*Math.sin(i*7.23),r=Math.sqrt(1-y*y);
  return {x:r*Math.cos(a),y,z:r*Math.sin(a)};
});
function smooth(lo:number,hi:number,x:number){const t=Math.max(0,Math.min(1,(x-lo)/(hi-lo)));return t*t*(3-2*t);}
function saltBeds(x:number,y:number,z:number){
  // The difference between the two nearest seed projections vanishes on
  // the pan boundary. Their curved, raised salt levees join at triple points.
  const u=x+.035*Math.sin(5*z+3*y),v=y+.042*Math.cos(3*z-4*x),w=z+.035*Math.sin(4*y+2*x);
  let a=-2,b=-2;
  for(const p of pans){const d=p.x*u+p.y*v+p.z*w;if(d>a){b=a;a=d;}else if(d>b)b=d;}
  const edge=(a-b)/.079;
  return .235*Math.exp(-edge*edge)-.07+.065*Math.sin(5*x-3*z)*Math.cos(5*y+z);
}
function glassFlows(x:number,y:number,z:number){
  // Bent, overlapping lobes of cooled glass; each has a shallow back and
  // steeper, rolled lip. Only their much smaller fractures are printed.
  const run=7*z-3.4*x+2.8*Math.sin(3*y+1.6*x)+1.2*Math.cos(3.2*x-2*z);
  const fold=Math.sin(run),shoulder=Math.cos(run);
  return .23*smooth(-.80,.64,fold)+.095*shoulder+.09*Math.cos(5*x+2*y)*Math.sin(3*z-y)-.12;
}
function twinHeight(relief:'salt'|'glaze',x:number,y:number,z:number){
  const beyondPad=1-smooth(.880,.970,Math.max(y,Math.abs(x)));
  if(beyondPad===0)return 0;
  return beyondPad*(relief==='salt'?saltBeds(x,y,z):glassFlows(x,y,z));
}
// Tilted parallel cleavage planes vs. rounded sulphur deposits with a
// weathered basin. Both signatures affect the silhouette as well as colour.
export const micaStrata=(x:number,y:number,z:number)=>3.1*y+1.3*x-.65*z+.13*Math.sin(4*z);
export const sulfurLobes=(x:number,y:number,z:number)=>Math.cos(7*x+2*y)*Math.sin(5*z-3*y)+.48*Math.cos(8*y-2*z);
function padTerrain(m:Profile,x:number,y:number,z:number){
  if(!m.jumpHeadings)return 1;
  let d=-1;for(const up of m.jumpHeadings)d=Math.max(d,up.x*x+up.y*y+up.z*z);
  // Width is in metres: on the smallest moon the footprint occupies much
  // more of the hemisphere than the same footprint on Obsidian.
  return smooth(.82,1.34,m.radius*Math.sqrt(Math.max(0,2*(1-d))));
}
// The walking motor and actual meshes sample the same unit-vector relief.
// Taper the terrain towards the north landing so its wind collar sits flush.
export function moonRadius(m:Profile,x:number,y:number,z:number){
  if(m.relief==='wetland')return m.radius+reedRelief(x,y,z);
  if(m.relief==='mica'||m.relief==='sulfur'){
    const height=m.relief==='mica'?.24*(x*x-z*z)+.095*Math.tanh(2.4*Math.sin(Math.PI*micaStrata(x,y,z)))
      :.13*sulfurLobes(x,y,z)-.21*Math.exp(-(((1-(.6*x+.8*y))/.16)**2));
    return m.radius+height*padTerrain(m,x,y,z);
  }
  if(m.relief==='salt'||m.relief==='glaze'){
    // Spherical caps about north and BOTH equatorial jump headings, without
    // a step at their edge. At r=4.6 the undisturbed cap radius is ~1.12 m.
    const h=twinHeight(m.relief,x,y,z)*padTerrain(m,x,y,z),s=m.station?.up;
    if(s){
      // Keep the whole instrument bed on its centre's original elevation.
      // The atlas can sample that centre before the station record exists.
      const bed=smooth(.965,.991,x*s.x+y*s.y+z*s.z);
      if(bed>0)return m.radius+h+(twinHeight(m.relief,s.x,s.y,s.z)-h)*bed;
    }
    return m.radius+h;
  }
  const relief=(1-Math.exp(-Math.max(0,1-y)*22));
  let h=.062*Math.sin(x*9+y*6)*Math.cos(z*8-y*4);
  if(m.relief==='basins'){
    for(const p of pits){const d=(1-x*p.x-y*p.y-z*p.z)/p.width;if(d>2.2)continue;
      h+=Math.sqrt(p.width)*(-1.65*Math.max(0,1-d)**1.5+.72*Math.exp(-((d-1)**2)/.070));}
  }else{
    const seam=Math.sin(4.2*x-3.6*y+1.28*Math.sin(4*z)),ridge=Math.cos(5*z+2.8*y+1.2*Math.sin(5*x));
    // Sub-triangle cracks belong in the albedo; walking needs broad ridges.
    h+=.33*Math.exp(-14*(seam+.23)**2)-.17*Math.exp(-27*seam*seam)+.18*Math.exp(-18*ridge*ridge);
  }
  return m.radius+h*relief;
}
export function moonShell(m:Profile){
  const small=m.relief==='mica'||m.relief==='sulfur';
  const g=new SphereGeometry(1,small?80:112,small?48:72),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=moonRadius(m,x,y,z);
    p.setXYZ(i,x*r,y*r,z*r);
  }
  g.computeVertexNormals();
  {
    // The UV seam and poles have duplicated vertices, but the daylight
    // highlight must be continuous across both sides of the same rock.
    const n=g.attributes.normal,stride=g.parameters.widthSegments+1,last=g.parameters.heightSegments;
    for(let row=0;row<=last;row++){
      const i=row*stride,j=i+stride-1;
      if(row===0||row===last){
        let x=0,y=0,z=0;for(let k=i;k<=j;k++){x+=n.getX(k);y+=n.getY(k);z+=n.getZ(k);}
        const l=Math.hypot(x,y,z);for(let k=i;k<=j;k++)n.setXYZ(k,x/l,y/l,z/l);
      }else{
        const x=n.getX(i)+n.getX(j),y=n.getY(i)+n.getY(j),z=n.getZ(i)+n.getZ(j),l=Math.hypot(x,y,z);
        n.setXYZ(i,x/l,y/l,z/l);n.setXYZ(j,x/l,y/l,z/l);
      }
    }
  }
  g.computeBoundingSphere();return g;
}
