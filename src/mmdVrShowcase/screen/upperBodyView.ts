import {Vector3,type Object3D,type SkinnedMesh} from 'three';
import type {BackpackLive} from '../backpack/store';

export type CloseUpFocus = 'body' | 'face';
export type ScreenCloseUp = {active:CloseUpFocus|null; toggle(focus:CloseUpFocus,assetId:string,runtimeId:string):void};

/** A composition only, never contact evidence. Fit the current pose (seated,
 * turned or scaled) instead of putting the lens at a fixed standing height. */
export function upperBodyView(root:Object3D,live:BackpackLive,aspect:number,focus:CloseUpFocus='body'){
  let source:SkinnedMesh|undefined;
  root.traverse(obj=>{const m=obj as SkinnedMesh;if(!source&&m.isSkinnedMesh&&m.skeleton?.bones.length&&!m.userData.mmdOutline&&!m.userData.mmdMaterialRenderProxy)source=m;});
  function joint(re:RegExp){return source?.skeleton.bones.find(b=>[b.userData.mmdBoneName,b.userData.mmdEnglishBoneName,b.name].some(s=>typeof s==='string'&&re.test(s.normalize('NFKC').replace(/[. _-]/g,''))))?.getWorldPosition(new Vector3());}
  const l=joint(/^(?:左胸|左乳|leftbreast|leftbust|breastl|bustl)$/i),r=joint(/^(?:右胸|右乳|rightbreast|rightbust|breastr|bustr)$/i);
  const ls=joint(/^(?:左腕|leftarm|leftupperarm)$/i),rs=joint(/^(?:右腕|rightarm|rightupperarm)$/i);
  const neck=joint(/^(?:首|neck)$/i),hips=joint(/^(?:下半身|hips|pelvis)$/i);
  const [x,y,z]=live.position,h=Math.max(.05,live.bounds?.size[1]??1.6);
  const target=l&&r?l.clone().lerp(r,.5):neck&&hips?hips.clone().lerp(neck,.73):new Vector3(x,(live.bounds?.center[1]??y+h/2)+h*.21,z);
  const front=new Vector3(0,0,1).transformDirection(root.matrixWorld);
  if(ls&&rs&&hips&&neck){const posed=ls.clone().sub(rs).cross(neck.clone().sub(hips));if(posed.lengthSq()>1e-9)front.copy(posed.normalize());}
  const width=ls&&rs&&ls.distanceTo(rs)>.01?ls.distanceTo(rs):l&&r?2.3*l.distanceTo(r):h*.30;
  if(focus==='face'){
    const left=joint(/^(左目|左眼|lefteye|eyel)$/i),right=joint(/^(右目|右眼|righteye|eyer)$/i),head=joint(/^(頭|头|head)$/i);
    if(left&&right){target.copy(left).lerp(right,.5);target.y-=width*.07;}
    else if(head){target.copy(head);target.y+=width*.15;}
    else target.y+=width*.56;
  }
  const halfFrame=Math.max(.045,width*.60/Math.min(1,Math.max(.2,aspect)));
  const eye=target.clone().addScaledVector(front,halfFrame/Math.tan(Math.PI*20/180)+width*.52);
  return {eye,target};
}
