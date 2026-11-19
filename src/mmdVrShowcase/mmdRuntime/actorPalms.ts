import type { MmdModel } from '@yohawing/three-mmd-loader/parser';
import { Euler, Matrix4, Vector3, type Bone, type SkinnedMesh } from 'three';

const prefix='stage:actor-palm:';
export const isActorPalm=(name?:string)=>name===prefix+'left'||name===prefix+'right';
type Body=ReturnType<MmdModel['rigidBodies']>[number];
const names=(bone:Bone)=>[bone.name,bone.userData.mmdBoneName,bone.userData.mmdEnglishBoneName].filter((v):v is string=>typeof v==='string').map(v=>v.normalize('NFKC').toLowerCase().replace(/[ _.\-]/g,''));
function rest(b:Bone){const p=b.userData.mmdRestPosition;return Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)?new Vector3().fromArray(p):null;}
const tuple=(v:Vector3):[number,number,number]=>[v.x,v.y,v.z];

/** Per-instance, at load, before the first physics binding. Model-space PMX
 * rest positions (not Three's mirrored world coordinates). The native backend
 * already feeds animated bone matrices for bone-following PMX bodies. */
export function installActorPalms(mesh:SkinnedMesh){
  const raw=mesh.userData.mmdPhysics as {rigidBodies:Body[]}|undefined;
  if(!raw||!Array.isArray(raw.rigidBodies))return 0;
  const bodies=raw.rigidBodies,bones=mesh.skeleton.bones,labels=bones.map(names);
  const skirts=bodies.map(b=>b.mode!=='static'&&b.mode!=='unknown'&&/スカート|skirt|裙/i.test([b.name,b.englishName,...(labels[b.boneIndex]??[])].join(' ')));
  if(!skirts.some(Boolean))return 0;
  const used=new Set(bodies.map(b=>b.group)),free=Array.from({length:16},(_,i)=>i).filter(i=>!used.has(i));
  if(free.length<3)return 0; // also leave groups for the player's two XR collider families
  const group=free[0],bit=1<<group,mask=bodies.reduce((m,b,i)=>skirts[i]?m|(1<<b.group):m,0),extra:Body[]=[];
  for(const side of ['left','right'] as const){
    const jp=side==='left'?'左':'右',find=(aliases:string[],parent?:Bone)=>bones.findIndex((b,i)=>(!parent||b.parent===parent)&&labels[i].some(v=>aliases.includes(v)));
    const wi=find([jp+'手首',side+'wrist',side+'hand']);if(wi<0)continue;
    const wrist=bones[wi],fi=find([jp+'人指1',jp+'人差指1',side+'index1',side+'indexfinger1'],wrist),li=find([jp+'小指1',side+'little1',side+'pinky1',side+'littlefinger1'],wrist);
    if(fi<0||li<0)continue;
    const authored=bodies.some(b=>{let bone=bones[b.boneIndex];while(bone){if(bone===wrist)return true;bone=bone.parent as Bone;}return false;});
    if(authored)continue;
    const w=rest(wrist),a=rest(bones[fi]),b=rest(bones[li]);if(!w||!a||!b)continue;
    const along=a.clone().add(b).multiplyScalar(.5).sub(w),length=along.length();if(length<1e-5)continue;
    const centre=w.clone().addScaledVector(along,.53);along.normalize();const across=a.clone().sub(b);across.addScaledVector(along,-across.dot(along));
    const width=across.length();if(width<length*.2||width>length*2)continue;
    across.normalize();const e=new Euler().setFromRotationMatrix(new Matrix4().makeBasis(across,along,across.clone().cross(along)),'XYZ');
    extra.push({name:prefix+side,englishName:'',boneIndex:wi,mode:'static',group,mask,shape:'box',position:tuple(centre),rotation:[e.x,e.y,e.z],size:[width*.61,length*.48,width*.21],mass:0,linearDamping:0,angularDamping:0,friction:.6,restitution:0});
  }
  if(extra.length)mesh.userData.mmdPhysics={...raw,rigidBodies:[...bodies.map((b,i)=>({...b,mask:skirts[i]?b.mask|bit:b.mask&~bit})),...extra]};
  return extra.length;
}
