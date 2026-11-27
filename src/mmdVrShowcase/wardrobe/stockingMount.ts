import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Group, Mesh, MeshPhongMaterial, Raycaster, Triangle, Vector3, type Material, type Scene, type Texture } from 'three';
import { visibleTexel } from '../play/wandOpacity';
import { shownMaterial, shownObject } from './stockingDraws';
import { stockingFabric } from './stockingFabric';
import type { StockingPatch } from './stockingFit';
import type { StockingTear } from './stockingState';

function fabricPatch(patch: StockingPatch, fabric: ReturnType<typeof stockingFabric>) {
  const { draw, vertices, side }=patch, geometry=new BufferGeometry();
  const position=new BufferAttribute(new Float32Array(vertices.length*3),3).setUsage(DynamicDrawUsage);
  geometry.setAttribute('position',position);
  geometry.setAttribute('normal',new BufferAttribute(new Float32Array(vertices.length*3),3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('uv',new Float32BufferAttribute(patch.sourceUv,2));
  geometry.setAttribute('uv1',new Float32BufferAttribute(patch.fabricUv,2));
  geometry.setIndex(patch.indices);
  const material=new MeshPhongMaterial({color:0x352d3d, specular:0x534552, shininess:29, alphaMap:fabric.map,
    transparent:true, alphaTest:.035, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1});
  const mesh=new Mesh(geometry,material); mesh.name=`wardrobe:stocking:${side}`; mesh.frustumCulled=false;
  // Outside XR input uses the dedicated posed ray below, never a generic
  // scene pointer that could let the fabric steal the backpack/actor press.
  Object.assign(mesh,{pointerEvents:'none'});
  const p=new Vector3(), end=new Vector3(), tri=new Triangle(); let first=true;
  function update(frame:number, changed:boolean) {
    const m=draw.material();
    mesh.visible=shownObject(draw.owner) && shownMaterial(m) && (!draw.source || draw.source.sampleable(vertices,m));
    if (!mesh.visible) { first=true; return; }
    const map: Texture | null=(m.transparent||m.alphaTest) ? ((m as Material & {map?:Texture}).map ?? m.userData.mmdTslSourceDiffuseTexture ?? null) : null;
    if (material.map!==map) { material.map=map; material.needsUpdate=true; }
    material.opacity=m.opacity;
    // Opaque clothes have already written depth. Draw hosiery immediately
    // after the underlying skin, before any overlying blended clothing.
    mesh.renderOrder=m.transparent ? draw.owner.renderOrder+.1 : -1000;
    if (!changed&&!first) return;
    first=false;
    const pose=draw.posed(frame);
    for (let k=0;k<vertices.length;k++) { pose.vertex(vertices[k],p); position.setXYZ(k,p.x,p.y,p.z); }
    for (const {vertex,other,fraction} of patch.rim) {
      p.fromBufferAttribute(position,vertex).lerp(pose.vertex(other,end),fraction); position.setXYZ(vertex,p.x,p.y,p.z);
    }
    geometry.computeVertexNormals();
    const n=geometry.attributes.normal, shell=.00045*patch.length*draw.body.matrixWorld.getMaxScaleOnAxis();
    for (let k=0;k<vertices.length;k++) position.setXYZ(k,position.getX(k)+shell*n.getX(k),position.getY(k)+shell*n.getY(k),position.getZ(k)+shell*n.getZ(k));
    position.needsUpdate=true; geometry.boundingSphere=null;
  }
  function pick(caster:Raycaster) {
    if (!mesh.visible) return null;
    const hits=caster.intersectObject(mesh,false), m=draw.material();
    for (const hit of hits) {
      const uv=hit.uv1; if (!uv || !fabric.covers(uv.x,uv.y)) continue;
      if ((material.map && (m.transparent||m.alphaTest)) && hit.face && hit.faceIndex!=null) {
        const {a,b,c}=hit.face;
        tri.a.fromBufferAttribute(position,a); tri.b.fromBufferAttribute(position,b); tri.c.fromBufferAttribute(position,c);
        if (!visibleTexel(m,geometry,hit.faceIndex*3,tri,hit.point)) continue;
      }
      return { side, u:uv.x-Math.floor(uv.x), v:uv.y, point:hit.point, distance:hit.distance };
    }
    return null;
  }
  return { mesh, update, pick, dispose(){ geometry.dispose(); material.dispose(); } };
}

export function mountStockings(scene:Scene, fits:StockingPatch[], runtimeId:string) {
  const group=new Group(), fabrics={left:stockingFabric('left'),right:stockingFabric('right')};
  group.name=`wardrobe:stockings:${runtimeId}`;
  const parts=fits.map(fit=>fabricPatch(fit,fabrics[fit.side]));
  group.add(...parts.map(p=>p.mesh)); scene.add(group);
  return { group, update(frame:number,changed:boolean,tears:readonly StockingTear[]) {
    fabrics.left.update(tears); fabrics.right.update(tears);
    for (const part of parts) part.update(frame,changed);
  }, pick(caster:Raycaster) {
    let nearest:ReturnType<typeof parts[number]['pick']>=null;
    if (group.visible) for (const p of parts) {
      const hit=p.pick(caster); if (hit && (!nearest || hit.distance<nearest.distance)) nearest=hit;
    }
    return nearest;
  }, dispose(){ group.removeFromParent(); for(const p of parts)p.dispose(); fabrics.left.map.dispose(); fabrics.right.map.dispose(); } };
}
