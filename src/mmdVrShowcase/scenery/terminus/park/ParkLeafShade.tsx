import {useEffect, useLayoutEffect, useMemo, useRef} from 'react';
import {BufferGeometry, Float32BufferAttribute, Matrix4, Vector3, type InstancedMesh, type Mesh, type Object3D} from 'three';
import {noPick, paintedSurface} from '../../sceneryPaint';
import {useBakedSurface} from '../../useBakedSurface';
import {SHORE_SUN} from '../shoreLayout';
import {habitOf, shadowPrint, type ParkTree} from './treeHabit';
import shadeUrl from './zelkova-shade.webp';

function shadePrint(trees:readonly ParkTree[],atlas:HTMLImageElement){
  const rects=trees.map((t,i)=>{
    const s=t.scale??1;
    return {x:t.x+s*shadowPrint.left,z:t.z+s*shadowPrint.top,w:s*shadowPrint.width,d:s*shadowPrint.depth,tile:habitOf(t,i)};
  });
  // Leave a clear border: out-of-range UVs on large triangles clamp to air.
  const x=Math.min(...rects.map(r=>r.x))-.10, z=Math.min(...rects.map(r=>r.z))-.10;
  const w=Math.max(...rects.map(r=>r.x+r.w))+.10-x, d=Math.max(...rects.map(r=>r.z+r.d))+.10-z;
  const pixels=Math.min(42,1024/Math.max(w,d)), width=Math.ceil(w*pixels), height=Math.ceil(d*pixels);
  const half=atlas.width/2;
  const texture=paintedSurface(width,height,ctx=>{
    ctx.setTransform(width/w,0,0,height/d,-x*width/w,-z*height/d);
    for(const r of rects)ctx.drawImage(atlas,(r.tile%2)*half,Math.floor(r.tile/2)*half,half,half,r.x,r.z,r.w,r.d);
  });
  return {texture,rects,x,z,w,d};
}

// One depth-tested overlay on the sun-facing receiver triangles. A slat and
// the paving below it have different projected UVs; holes stay holes. No
// square shadow cards hanging over the edge of the embankment, nor a second
// copy of the park's PBR colour maps. Build once on shadowless room entry.
function projectReceivers(park:Object3D,grove:Object3D,print:ReturnType<typeof shadePrint>,g:BufferGeometry){
  park.updateWorldMatrix(true,true);
  const local=new Matrix4().copy(grove.matrixWorld).invert(), matrix=new Matrix4(), inst=new Matrix4();
  const p:number[]=[], uv:number[]=[], faces:number[]=[];
  const a=new Vector3(), b=new Vector3(), c=new Vector3(), ab=new Vector3(), ac=new Vector3();
  const sun=new Vector3(...SHORE_SUN), sx=sun.x/sun.y, sz=sun.z/sun.y;
  function add(mesh:Mesh){
    const pos=mesh.geometry.getAttribute('position'), idx=mesh.geometry.index;
    const mapped=new Int32Array(pos.count).fill(-1);
    function vertex(i:number,v:Vector3){
      if(mapped[i]!==-1)return mapped[i];
      const k=p.length/3; p.push(v.x,v.y,v.z);
      uv.push((v.x-v.y*sx-print.x)/print.w,1-(v.z-v.y*sz-print.z)/print.d);
      mapped[i]=k; return k;
    }
    for(let n=0;n<(idx?.count??pos.count);n+=3){
      const i=idx?.getX(n)??n, j=idx?.getX(n+1)??n+1, k=idx?.getX(n+2)??n+2;
      a.fromBufferAttribute(pos,i).applyMatrix4(matrix); b.fromBufferAttribute(pos,j).applyMatrix4(matrix); c.fromBufferAttribute(pos,k).applyMatrix4(matrix);
      if(Math.min(a.y,b.y,c.y)>1.4 || ab.subVectors(b,a).cross(ac.subVectors(c,a)).dot(sun)<=0)continue;
      const x0=Math.min(a.x-a.y*sx,b.x-b.y*sx,c.x-c.y*sx), x1=Math.max(a.x-a.y*sx,b.x-b.y*sx,c.x-c.y*sx);
      const z0=Math.min(a.z-a.y*sz,b.z-b.y*sz,c.z-c.y*sz), z1=Math.max(a.z-a.y*sz,b.z-b.y*sz,c.z-c.y*sz);
      if(print.rects.some(r=>x0<r.x+r.w && x1>r.x && z0<r.z+r.d && z1>r.z))faces.push(vertex(i,a),vertex(j,b),vertex(k,c));
    }
  }
  function visit(o:Object3D,marked:boolean){
    if(o===grove || !o.visible)return;
    marked ||= !!o.userData.parkLeafShadeReceiver;
    const mesh=o as InstancedMesh;
    if(marked && mesh.isMesh){
      for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++){
        matrix.multiplyMatrices(local,o.matrixWorld);
        if(mesh.isInstancedMesh){mesh.getMatrixAt(i,inst);matrix.multiply(inst);}
        add(mesh);
      }
    }
    for(const child of o.children)visit(child,marked);
  }
  visit(park,false);
  g.setAttribute('position',new Float32BufferAttribute(p,3)); g.setAttribute('uv',new Float32BufferAttribute(uv,2));
  g.setIndex(faces); g.computeBoundingSphere();
}

export function ParkLeafShade({trees}:{trees:readonly ParkTree[]}){
  const atlas=useBakedSurface(shadeUrl), ref=useRef<Mesh>(null);
  const print=useMemo(()=>atlas && atlas.image instanceof HTMLImageElement?shadePrint(trees,atlas.image):null,[atlas,trees]);
  useEffect(()=>()=>print?.texture.dispose(),[print]);
  useLayoutEffect(()=>{
    const mesh=ref.current, grove=mesh?.parent, park=grove?.parent;
    if(!mesh || !print || !grove || !park)return;
    projectReceivers(park,grove,print,mesh.geometry);
    return ()=>mesh.geometry.dispose();
  },[print]);
  if(!print)return null;
  return <mesh ref={ref} name="terminus:park-tree-shadows" raycast={noPick} userData={{playerCollision:false}}>
    <bufferGeometry/>
    <meshBasicMaterial map={print.texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/>
  </mesh>;
}
