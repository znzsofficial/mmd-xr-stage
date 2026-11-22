import { Matrix4, type Mesh, type Object3D } from 'three';
import type {PelvicFrame} from './contract';

// Compare to the last ordinary frame, not successive slow frames. Relative
// tolerances on a translated actor or slowly drifting pose would accumulate.
const near=(a:number,b:number)=>Math.abs(a-b)<=1e-7;
const same=(a:Matrix4,b:Matrix4)=>a.elements.every((x,i)=>near(x,b.elements[i]));
export function createStandHold(){
  const anchor=new Matrix4(),parent=new Matrix4(),world=new Matrix4();let part:Mesh|null=null,holder:Object3D|null=null,radius=0,length=0,scale=0;
  const visible=(p:Mesh)=>p.visible&&(Array.isArray(p.material)?p.material.some(m=>m.visible&&m.opacity>0&&m.colorWrite):p.material.visible&&p.material.opacity>0&&p.material.colorWrite);
  function shownMesh(piece:Object3D){const mesh=holder===piece&&part?.parent===piece?part:piece.getObjectByName('play:piece:dildo') as Mesh|undefined;
    return mesh?.isMesh&&mesh.parent===piece&&visible(mesh)?mesh:null;}
  return {
    clear(){part=null;holder=null;},
    shown:(piece:Object3D)=>!!shownMesh(piece),
    record(f:PelvicFrame,piece:Object3D){
      const mesh=shownMesh(piece);if(!mesh){part=null;return;}
      part=mesh;holder=piece;mesh.updateWorldMatrix(true,false);parent.copy(piece.matrixWorld);world.copy(mesh.matrixWorld);anchor.copy(f.world);
      radius=f.radiusM;length=f.lengthM;scale=f.scale;
    },
    matches(f:PelvicFrame,piece:Object3D){
      if(!part||part.parent!==piece||!visible(part)||!near(radius,f.radiusM)||!near(length,f.lengthM)||!near(scale,f.scale)||!same(anchor,f.world))return false;
      part.updateWorldMatrix(true,false);return same(parent,piece.matrixWorld)&&same(world,part.matrixWorld);
    },
  };
}
