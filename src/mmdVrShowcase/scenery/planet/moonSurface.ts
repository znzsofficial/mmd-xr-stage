import {SphereGeometry} from 'three';

type Profile={relief:'basins'|'rifts';radius:number};
const pits=Array.from({length:30},(_,i)=>{
  const y=1-(i+.5)/15,s=Math.sqrt(1-y*y),a=i*2.39996+.38;
  return {x:s*Math.sin(a),y,z:s*Math.cos(a),width:.007+.036*((i*13%29)/29)**2};
});
// The walking motor and actual meshes sample the same unit-vector relief.
// Taper the terrain towards the north landing so its wind collar sits flush.
export function moonRadius(m:Profile,x:number,y:number,z:number){
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
  const g=new SphereGeometry(1,112,72),p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=moonRadius(m,x,y,z);
    p.setXYZ(i,x*r,y*r,z*r);
  }
  g.computeVertexNormals();g.computeBoundingSphere();return g;
}
