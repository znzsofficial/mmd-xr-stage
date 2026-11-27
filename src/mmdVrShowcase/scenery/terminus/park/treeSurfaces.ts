import {BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Vector3} from 'three';
import {growTree, sprayFaces, sprayPoints, sprayUV} from './treeHabit';

/** Ring-to-ring sweep. The flare, bent trunk and each fork retain continuous
 * shading and metre-scaled bark along their length. */
export function barkGeometry({limbs}:ReturnType<typeof growTree>){
  const p:number[]=[], normals:number[]=[], uv:number[]=[], faces:number[]=[];
  const axis=new Vector3(), across=new Vector3(), around=new Vector3(), n=new Vector3();
  for(const [l,{rings,sides}] of limbs.entries()){
    const start=p.length/3, u0=l*.371, v0=l*.217;
    let length=0;
    for(const [j,ring] of rings.entries()){
      const next=rings[Math.min(rings.length-1,j+1)].p, prev=rings[Math.max(0,j-1)].p;
      axis.subVectors(next,prev).normalize();
      if(j===0)across.set(Math.abs(axis.x)>.85?0:1,0,Math.abs(axis.x)>.85?1:0);
      around.crossVectors(axis,across).normalize(); across.crossVectors(around,axis).normalize();
      if(j)length+=ring.p.distanceTo(rings[j-1].p);
      for(let i=0;i<=sides;i++){
        const a=i/sides*Math.PI*2;
        n.copy(across).multiplyScalar(Math.cos(a)).addScaledVector(around,Math.sin(a));
        const r=ring.r*(1+.045*Math.cos(a*3+.28*j)+.031*Math.sin(a*5+l));
        p.push(ring.p.x+n.x*r,ring.p.y+n.y*r,ring.p.z+n.z*r); normals.push(n.x,n.y,n.z);
        uv.push(u0+i/sides*Math.max(.14,2*Math.PI*rings[0].r/.72),v0+length/.82);
        if(j>0 && i>0){const k=start+j*(sides+1)+i, last=k-sides-1; faces.push(last-1,last,k-1,k-1,last,k);}
      }
    }
    // Open-ended tubes are conspicuous when looking up into a pruned leader.
    const cap=start+(rings.length-1)*(sides+1);
    for(let i=1;i<sides-1;i++)faces.push(cap,cap+i,cap+i+1);
  }
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(p,3)); g.setAttribute('normal',new Float32BufferAttribute(normals,3));
  g.setAttribute('uv',new Float32BufferAttribute(uv,2)); g.setIndex(faces); g.computeBoundingSphere(); return g;
}

export function sprayGeometry(tile:number){
  const uv=sprayUV.map((n,i)=>i%2 ? (n+1-Math.floor(tile/2))*.5 : (n+tile%2)*.5);
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(sprayPoints,3).setUsage(DynamicDrawUsage));
  g.setAttribute('uv',new Float32BufferAttribute(uv,2)); g.setIndex(sprayFaces); g.computeVertexNormals(); g.computeBoundingSphere();
  // The few moving tip verts stay within this bound for every instance.
  g.boundingSphere!.radius+=.055;
  return g;
}
