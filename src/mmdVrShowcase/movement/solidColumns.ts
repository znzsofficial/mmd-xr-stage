import {Box3,Matrix4,Vector3,type BufferGeometry,type Mesh,type InstancedMesh,type Object3D,type Scene} from 'three';

// Local broad phase: cache contiguous triangle blocks per geometry, including
// shared instance shapes. Only transform triangles near the current metre of
// travel. The renderer, pointer rays and Bullet don't participate in queries.
type Block={bounds:Box3;start:number;end:number};
const blocks=new WeakMap<BufferGeometry,Block[]>();
function geometryBlocks(g:BufferGeometry){
  let list=blocks.get(g);if(list)return list;
  list=[];const p=g.attributes.position,idx=g.index,v=new Vector3();
  const end=Math.min(idx?.count??p.count,g.drawRange.start+g.drawRange.count);
  for(let start=g.drawRange.start;start+2<end;start+=144){
    const stop=Math.min(start+144,end),bounds=new Box3();
    for(let i=start;i<stop;i++)bounds.expandByPoint(v.fromBufferAttribute(p,idx?idx.getX(i):i));
    list.push({bounds,start,end:stop});
  }
  blocks.set(g,list);return list;
}

export type Column={floor:number;ceiling:number;blocked:boolean};
export const BODY_RADIUS=.16, STEP=.19;
type Triangle={v:Float64Array;x0:number;x1:number;z0:number;z1:number;y0:number;y1:number};
type Instance={g:BufferGeometry;world:Matrix4;bounds:Box3;identity:boolean};
const identityMatrix=new Matrix4();
// Clip a triangle against the four sides of the player's column in XZ. A
// hollow GLB room stays hollow; the bounding box of its shell is not a wall.
const pa=new Float64Array(27),pb=new Float64Array(27);
function clip(src:Float64Array,n:number,dst:Float64Array,axis:number,edge:number,sign:number){
  let out=0;
  for(let i=0,j=(n-1)*3;i<n*3;j=i,i+=3){const a=(src[j+axis]-edge)*sign,b=(src[i+axis]-edge)*sign;
    if((a<0)!==(b<0)){const t=a/(a-b);for(let k=0;k<3;k++)dst[out++]=src[j+k]+t*(src[i+k]-src[j+k]);}
    if(b>=0){dst[out++]=src[i];dst[out++]=src[i+1];dst[out++]=src[i+2];}
  }return out/3;
}
function overlaps(b:Box3,x0:number,x1:number,z0:number,z1:number){return b.max.x>=x0&&b.min.x<=x1&&b.max.z>=z0&&b.min.z<=z1;}

export function createSolidColumns(){
  let tileX=Infinity,tileZ=Infinity;
  // Stable feet (including paused tracking) need no repeat triangle queries.
  let lastX=NaN,lastZ=NaN,lastFoot=NaN,lastBase=NaN;
  const last:Column={floor:0,ceiling:Infinity,blocked:false};
  const instances:Instance[]=[],triangles:Triangle[]=[],box=new Box3(),v=new Vector3();
  let activeTriangles=0;
  let dirty=true;
  const watched:Object3D[]=[];
  function changed(){dirty=true;tileX=tileZ=Infinity;lastX=NaN;}
  function release(){for(const o of watched){o.removeEventListener('childadded',changed);o.removeEventListener('childremoved',changed);}watched.length=0;instances.length=triangles.length=activeTriangles=0;changed();}
  function indexRoot(root:Object3D){
    root.updateWorldMatrix(true,true);
    root.traverseVisible(o=>{
      const mesh=o as Mesh,im=o as InstancedMesh;
      if(!mesh.isMesh||o.children.length){watched.push(o);o.addEventListener('childadded',changed);o.addEventListener('childremoved',changed);}
      if(!mesh.isMesh||(!root.userData.stagePropSolid&&mesh.userData.playerCollision===false))return;
      // Only the room & imported prop roots are registered: no sky, UI,
      // playback toys or character colliders. Ignore purely visual effects.
      const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(mats.every(m=>!m.visible||(!root.userData.stagePropSolid&&(!m.depthWrite||m.alphaTest>0||m.type==='ShaderMaterial'))))return;
      const g=mesh.geometry,p=g?.attributes.position;if(!p)return;
      if(!g.boundingBox)g.computeBoundingBox();
      for(let k=0;k<(im.isInstancedMesh?im.count:1);k++){
        const world=new Matrix4();if(im.isInstancedMesh){im.getMatrixAt(k,world);world.premultiply(mesh.matrixWorld);}else world.copy(mesh.matrixWorld);
        instances.push({g,world,bounds:g.boundingBox!.clone().applyMatrix4(world),identity:world.equals(identityMatrix)});
      }
    });
  }
  function collect(x0:number,x1:number,z0:number,z1:number){
    activeTriangles=0;
    for(const {g,world,bounds,identity} of instances){
      if(!overlaps(bounds,x0,x1,z0,z1))continue;
      const idx=g.index,p=g.attributes.position;
      for(const block of geometryBlocks(g)){
        if(!overlaps(identity?block.bounds:box.copy(block.bounds).applyMatrix4(world),x0,x1,z0,z1))continue;
        for(let i=block.start;i+2<block.end;i+=3){box.makeEmpty();
          for(let j=0;j<3;j++){v.fromBufferAttribute(p,idx?idx.getX(i+j):i+j);if(!identity)v.applyMatrix4(world);box.expandByPoint(v);v.toArray(pa,3*j);}
          if(!overlaps(box,x0,x1,z0,z1))continue;
          // Refill the current neighbourhood in place instead of allocating
          // a triangle and vertex array for every metre travelled.
          const k=activeTriangles++,t=triangles[k]??(triangles[k]={v:new Float64Array(9),x0:0,x1:0,z0:0,z1:0,y0:0,y1:0});
          for(let j=0;j<9;j++)t.v[j]=pa[j];
          t.x0=box.min.x;t.x1=box.max.x;t.z0=box.min.z;t.z1=box.max.z;t.y0=box.min.y;t.y1=box.max.y;
        }
      }
    }
    // Walking away from an unusually dense imported mesh releases its peak.
    triangles.length=Math.min(triangles.length,activeTriangles+2048);
  }
  return {
    invalidate:release,
    sample(roots:readonly Object3D[],x:number,z:number,foot:number,out:Column){
      const r=BODY_RADIUS;
      if(dirty){release();for(const root of roots)if(root.visible)indexRoot(root);dirty=false;}
      if(x===lastX&&z===lastZ&&foot===lastFoot&&out.floor===lastBase){Object.assign(out,last);return;}
      lastX=x;lastZ=z;lastFoot=foot;lastBase=out.floor;
      // Centre the cache on the query, rather than thrashing across a grid
      // cell boundary while sliding against a wall on that boundary.
      if(Math.abs(x-tileX)>.85||Math.abs(z-tileZ)>.85){tileX=x;tileZ=z;
        collect(x-.85-r,x+.85+r,z-.85-r,z+.85+r);
      }
      for(let i=0;i<activeTriangles;i++){const t=triangles[i];
        if(t.x1<x-r||t.x0>x+r||t.z1<z-r||t.z0>z+r||t.y1<out.floor-.002||t.y0>out.ceiling)continue;
        pa.set(t.v);let n=clip(pa,3,pb,0,x-r,1);n=clip(pb,n,pa,0,x+r,-1);n=clip(pa,n,pb,2,z-r,1);n=clip(pb,n,pa,2,z+r,-1);if(!n)continue;
        let lo=Infinity,hi=-Infinity;for(let i=1;i<3*n;i+=3){lo=Math.min(lo,pa[i]);hi=Math.max(hi,pa[i]);}
        if(hi<=foot+STEP){out.floor=Math.max(hi,out.floor);}
        else if(lo>=foot-.002){out.ceiling=Math.min(lo,out.ceiling);}
        else {out.blocked=true;break;}
      }
      Object.assign(last,out);
    },
  };
}

/** Only current-room roots are exposed. Array identity is the cache generation;
 * update it on placement/visibility/scale changes, and on room replacement. */
export function playerSolidRoots(scene:Scene){return scene.children.filter(o=>o.name==='player:room-solids'||o.userData.stagePropSolid===true);}
