import { BufferGeometry, CylinderGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, TorusGeometry, Vector3, type Object3D } from 'three';
import { createSealShell, makeCarriage, makeStandFoot, makeTracks } from './rigArt';
import { pelvicSeal, type PelvicContact, type PelvicFrame } from './geometry';

const closed:PelvicContact={inside:false,depthM:0,atCervix:false,outletInside:false,outletVisible:false,outletLocal:new Vector3(),shaftLocal:[]};
const parentInverse=new Matrix4();
/** All geometry/solver transforms use world metres. Even a transformed
 * host is not permitted to scale a real prop twice. */
export function placeWorld(node:Object3D,world:Matrix4){
  node.matrix.copy(world);
  if(node.parent){node.parent.updateWorldMatrix(true,false);node.matrix.premultiply(parentInverse.copy(node.parent.matrixWorld).invert());}
  node.matrix.decompose(node.position,node.quaternion,node.scale);node.matrixWorldNeedsUpdate=true;node.updateWorldMatrix(false,false);
}

export function createPortDrawing(host:Object3D,assetId:string){
  const group=new Group();group.name=`pelvic:adapter:${assetId}`;group.visible=false;host.add(group);
  const shellMaterial=new MeshStandardMaterial({vertexColors:true,roughness:.55});
  const seed={radiusM:.02},seal=pelvicSeal(seed,closed,true)!,shell=createSealShell(seal.outer.length);
  const molded=new Mesh(shell.geom,shellMaterial);molded.name='pelvic:seal';group.add(molded);
  const mark=new Mesh(new TorusGeometry(1,.055,8,40),new MeshStandardMaterial({color:'#6dc6bd',roughness:.64,wireframe:false}));
  mark.visible=false;mark.name='pelvic:calibration-guide';group.add(mark);
  let lastRadius=-1,wasOpen=false;
  return {group,draw(f:PelvicFrame,showShell:boolean,preview:boolean,contact:PelvicContact=closed){
    placeWorld(group,f.world);group.visible=showShell||preview;mark.visible=preview&&!showShell;molded.visible=showShell;
    if(mark.visible)mark.scale.set(f.radiusM*1.62,f.radiusM*1.72,f.radiusM);
    if(!showShell&&!contact.inside)return 0;
    // The undeformed mesh is identical on every subsequent closed frame.
    const opening=pelvicSeal(f,contact,true,seal)!;
    if(showShell&&(wasOpen||opening.openness>0||Math.abs(lastRadius-f.radiusM)>1e-7)){shell.fit(opening,f.radiusM);lastRadius=f.radiusM;}
    if(showShell)wasOpen=opening.openness>0;return opening.openness;
  },dispose(){group.removeFromParent();shell.geom.dispose();shellMaterial.dispose();mark.geometry.dispose();mark.material.dispose();}};
}

export function createStandDrawing(host:Object3D){
  const body=new Group(),track=new Mesh(new BufferGeometry(),new MeshStandardMaterial({vertexColors:true,metalness:.30,roughness:.38})),
    carrier=new Mesh(makeCarriage(),track.material),foot=new Mesh(makeStandFoot(),track.material),
    mast=new Mesh(new CylinderGeometry(1,1,1,12),new MeshStandardMaterial({color:'#75858a',metalness:.5,roughness:.33}));
  body.name='pelvic:stand';track.name='pelvic:rails';carrier.name='pelvic:carriage';body.visible=false;host.add(body);body.add(track,carrier,foot,mast);
  const up=new Vector3(0,1,0),post=new Vector3(),at=new Vector3(),ground=new Vector3();let length=-1,ruler=-1;
  return {body,draw(f:PelvicFrame,pieceWorld:Matrix4,floorY:number){
    body.visible=true;
    if(Math.abs(length-f.lengthM)>1e-6||Math.abs(ruler-f.scale)>1e-6){const built=makeTracks(f);track.geometry.dispose();track.geometry=built.geometry;post.copy(built.post);length=f.lengthM;ruler=f.scale;}
    placeWorld(track,f.world);placeWorld(carrier,pieceWorld);
    at.copy(post).applyMatrix4(f.world);ground.set(at.x,Math.min(floorY,at.y-.025),at.z);
    body.worldToLocal(at);body.worldToLocal(ground);foot.position.copy(ground);mast.position.lerpVectors(ground,at,.5);
    at.sub(ground);mast.scale.set(.010,at.length(),.010);mast.quaternion.setFromUnitVectors(up,at.normalize());
  },dispose(){body.removeFromParent();for(const m of [track,carrier,foot,mast])m.geometry.dispose();track.material.dispose();mast.material.dispose();}};
}
