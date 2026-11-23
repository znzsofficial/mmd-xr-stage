import {Vector3} from 'three';

/** Radial intersection with the actual two SphereGeometry triangles of a
 * meridian cell. Sample only the few cells used by this walk/flight instead
 * of constructing a second full-resolution mesh or scanning all triangles. */
export function facetSampler(cols:number,rows:number,radius:(x:number,y:number,z:number)=>number){
  type Cell={split:Vector3,side:number,n0:Vector3,d0:number,n1:Vector3,d1:number};
  const cells=new Map<number,Cell>(),stride=Math.PI*2/cols,half=Math.cos(stride/2);
  const a=new Vector3(),b=new Vector3(),c=new Vector3(),d=new Vector3(),edge=new Vector3();
  function vertex(col:number,row:number,p:Vector3){
    const theta=Math.PI*row/rows,y=Math.cos(theta),s=Math.sqrt(Math.max(0,1-y*y)),phi=stride*col;
    // SphereGeometry's attributes are Float32; relief is evaluated on the
    // float vertex before the final displaced position is stored as Float32.
    p.set(Math.fround(-s*Math.cos(phi)),Math.fround(y),Math.fround(s*Math.sin(phi)));
    p.multiplyScalar(radius(p.x,p.y,p.z));return p.set(Math.fround(p.x),Math.fround(p.y),Math.fround(p.z));
  }
  return (x:number,y:number,z:number)=>{
    const phi=(Math.atan2(z,-x)+2*Math.PI)%(2*Math.PI),i=Math.min(cols-1,Math.floor(phi/stride));
    // A ring edge is a chord, not a parallel of latitude. This projected
    // polar angle selects the right triangle row even beside a polar seam.
    const j=Math.min(rows-1,Math.floor(Math.atan2(Math.hypot(x,z)*Math.cos(phi-(i+.5)*stride)/half,y)*rows/Math.PI));
    const key=j*cols+i;let t=cells.get(key);
    if(!t){
      vertex(i+1,j,a);vertex(i,j,b);vertex(i,j+1,c);vertex(i+1,j+1,d);
      const split=new Vector3().crossVectors(b,d),side=split.dot(a);
      const n0=new Vector3().subVectors(a,b).cross(edge.subVectors(d,b)),n1=new Vector3().subVectors(c,b).cross(edge.subVectors(d,b));
      t={split,side,n0,d0:n0.dot(b),n1,d1:n1.dot(b)};
      if(cells.size>=384)cells.clear();cells.set(key,t);
    }
    const first=j!==0&&(j===rows-1||(t.split.x*x+t.split.y*y+t.split.z*z)*t.side>=0),n=first?t.n0:t.n1;
    return (first?t.d0:t.d1)/(n.x*x+n.y*y+n.z*z);
  };
}
