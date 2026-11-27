import {Box3,Vector3,type Mesh,type Object3D} from 'three';

const framingJoint=/^(?:頭|头|head|首|neck|下半身|hips?|pelvis|[左右](?:腕|手首|足首|膝|ひざ|つま先|足先ex|目)|(?:left|right)(?:upperarm|arm|hand|wrist|foot|ankle|knee|toe|toebase|eye))$/i;

// The opening axis can point nearly straight up or through the actor's back.
// Frame both figures from the side of the partner, using the held pose rather
// than the actor's standing backpack bounds. Only runs on the camera button.
export function partnerView(partner:Object3D,actor:Object3D|undefined,aspect:number,fov:number){
  const side=new Vector3(1,0,0).transformDirection(partner.matrixWorld);
  const outward=new Vector3(0,0,1).transformDirection(partner.matrixWorld);
  const points:Vector3[]=[];
  partner.traverseVisible(node=>{
    const g=(node as Mesh).geometry;if(!g)return;
    if(!g.boundingBox)g.computeBoundingBox();
    const {min,max}=g.boundingBox!;
    for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z])points.push(new Vector3(x,y,z).applyMatrix4(node.matrixWorld));
  });
  const scale=partner.matrixWorld.getMaxScaleOnAxis();
  // Capture the actual drawn pose's major joints without pulling skin buffers
  // or fitting to remote IK targets, skirt helpers or dangling hair bones.
  actor?.traverse(node=>{
    if(node.type!=='Bone')return;
    const names=[node.name,node.userData.mmdBoneName,node.userData.mmdEnglishBoneName];
    if(names.some(s=>typeof s==='string'&&framingJoint.test(s.normalize('NFKC').split(':').pop()!.replace(/[ _.-]/g,''))))points.push(node.getWorldPosition(new Vector3()));
  });
  const target=new Box3().setFromPoints(points).getCenter(new Vector3());
  // In lateral poses a pure side view looks along both spines. Move obliquely
  // above the upper flank so the viewer can distinguish the two support arms.
  const torso=partner.getObjectByName('pelvic:partner-torso');
  const rolled=torso?Math.abs(new Vector3(1,0,0).transformDirection(torso.matrixWorld).y):0;
  const dir=side.multiplyScalar(1-.45*rolled).addScaledVector(outward,.22+.52*rolled);dir.y=.34+.36*rolled;dir.normalize();
  const right=new Vector3(0,1,0).cross(dir).normalize(),up=dir.clone().cross(right);
  const tanY=Math.tan(fov*Math.PI/360),tanX=tanY*Math.max(.15,aspect),pad=.19*scale;
  let distance=.5;
  for(const point of points){
    point.sub(target);
    distance=Math.max(distance,point.dot(dir)+Math.max((Math.abs(point.dot(right))+pad)/tanX,(Math.abs(point.dot(up))+pad)/tanY));
  }
  return {target,eye:target.clone().addScaledVector(dir,distance)};
}
