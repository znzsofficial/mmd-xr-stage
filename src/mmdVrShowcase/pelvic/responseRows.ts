import {buttons,key,note,type Localize,type Row} from './controlRows';
import {setActorResponse,type PelvicProfile,type PelvicSupport} from './store';

/** Same single row for screen and XR. Swapping or enabling mid-contact waits
 * for the next crossing, rather than auditioning a face without a new touch. */
export function responseRows(assetId:string,runtimeId:string,profile:PelvicProfile,support:PelvicSupport|undefined,l:Localize):Row[]{
  if(!support)return [];
  const names=support.responseMorphs;
  if(!names?.length)return [note(l('角色回应：未找到适配的脸部表情。','Actor response: no compatible face morphs.'))];
  const chosen=profile.responseMorph, set=(v:string|null|undefined)=>setActorResponse(assetId,runtimeId,v);
  if(chosen===null)return [buttons(key(l('启用角色回应','Enable actor response'),()=>set(undefined)))];
  const at=chosen===undefined?-1:names.indexOf(chosen), next=names[at+1];
  const current=chosen??l('自动','Auto');
  return [buttons(key(l(`换回应：${current}`,`Change response: ${current}`),()=>set(next)),key(l('关闭回应','Turn response off'),()=>set(null)))];
}
