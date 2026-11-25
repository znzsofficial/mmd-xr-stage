// Only fixed vocabulary, counts and public attachment dimensions cross this boundary.
// Never keep a frame, a texture, a tracked transform, a GPU label or an exception message.
const errorTypes=new Set(['NotAllowedError','SecurityError','NotSupportedError','InvalidStateError','OperationError','AbortError','TypeError','RangeError','GPUValidationError','GPUOutOfMemoryError','GPUInternalError','GPUPipelineError']);
export function xrError(stage,e){
  const type=[e?.name,e?.constructor?.name].find(name=>errorTypes.has(name))??'Error';
  const error={stage,type};if(stage==='subimage'&&(e?.eyeIndex===0||e?.eyeIndex===1))error.eyeIndex=e.eyeIndex;return error;
}
export const eyeName=e=>e==='left'||e==='right'?e:'none';
const formats=new Set(['rgba8unorm','bgra8unorm','rgba16float','depth24plus']);
const integer=n=>Number.isSafeInteger(n)&&n>=0?n:null;

export function xrReceipts(now=()=>performance.now()){
  const attempts=[];let sequence=0;
  function begin(){
    const started=now(),data={id:++sequence,phase:'requesting',milestones:{request:0},displayEvidence:'not-measured',actorState:'not-started',rate72:'unavailable',
      frames:{callbacks:0,hidden:0,noPose:0,noViews:0,posed:0,subimages:0,submitted:0,validationPassed:0,stereoSubmitted:0,landmarkOnly:0,withActor:0},
      visibility:null,refreshHz:null,lastPoseEyes:[],lastViews:[],actorError:null,error:null,endReason:null,endObserved:false,screenResumed:false};
    const counts=()=>({hand:0,grip:0,missing:0});data.inputFrames={left:counts(),right:counts(),bothValid:0};
    attempts.push(data);if(attempts.length>12)attempts.shift();
    const first=key=>{if(!(key in data.milestones))data.milestones[key]=Math.max(0,Math.round(now()-started));};
    return {data,first,inputs(kinds){let both=true;for(let i=0;i<2;i++){const k=kinds[i];data.inputFrames[i?'right':'left'][k==='hand'||k==='grip'?k:'missing']++;both&&=k==='hand'||k==='grip';}if(both)data.inputFrames.bothValid++;},views(poses,targets){
      first('subimages');data.frames.subimages+=targets.length;
      data.lastViews.length=targets.length;
      for(let i=0;i<targets.length;i++){
        const t=targets[i],v=data.lastViews[i]??={};
        v.eye=eyeName(poses[i].eye);v.x=integer(t.viewport.x);v.y=integer(t.viewport.y);v.width=integer(t.viewport.width);v.height=integer(t.viewport.height);
        v.format=formats.has(t.format)?t.format:null;v.depthFormat=formats.has(t.depthFormat)?t.depthFormat:null;
        v.arrayLayer=integer(t.arrayLayer);v.depthSource=t.depthSource==='layer'||t.depthSource==='local'?t.depthSource:null;
      }
    },submitted(actor){
      const f=data.frames;f.submitted++;if(data.lastViews.length===2&&data.lastViews.some(v=>v.eye==='left')&&data.lastViews.some(v=>v.eye==='right'))f.stereoSubmitted++;
      f[actor?'withActor':'landmarkOnly']++;first('submit');first(actor?'actorSubmit':'landmarkSubmit');
    }};
  }
  return {attempts,begin};
}
