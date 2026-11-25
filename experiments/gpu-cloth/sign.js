// One static sign beside the sample; redraw its texture only on a mode change.
export async function makeSign(device,format){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d'),tex=device.createTexture({size:[512,128],format:'rgba8unorm',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.RENDER_ATTACHMENT});
  const code=`@group(0) @binding(0) var<uniform> vp:mat4x4f; @group(0) @binding(1) var signTex:texture_2d<f32>; @group(0) @binding(2) var sm:sampler;
    struct V { @builtin(position) p:vec4f,@location(0) uv:vec2f }
    @vertex fn v(@builtin(vertex_index) n:u32)->V{let a=array<vec2f,6>(vec2f(0,0),vec2f(0,1),vec2f(1,0),vec2f(1,0),vec2f(0,1),vec2f(1,1))[n];return V(vp*vec4f(-.73+.38*a.x,1.41-.095*a.y,.02,1.),a);}
    @fragment fn f(i:V)->@location(0) vec4f{return textureSample(signTex,sm,i.uv);}`;
  let pipe;try{const module=device.createShaderModule({code});pipe=await device.createRenderPipelineAsync({layout:'auto',vertex:{module,entryPoint:'v'},fragment:{module,entryPoint:'f',targets:[{format}]},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});}catch(e){tex.destroy();throw e;}
  const view=tex.createView(),sampler=device.createSampler({minFilter:'linear',magFilter:'linear'}),sets=new Map();let text;
  return {draw(pass,eye,state){if(text!==state){text=state;ctx.fillStyle='#291d29';ctx.fillRect(0,0,512,128);ctx.fillStyle='#e4c28b';ctx.font='bold 40px sans-serif';ctx.fillText(state,18,53);ctx.fillStyle='#fff1df';ctx.font='28px sans-serif';ctx.fillText('左 X 切求解　右 A 换姿势',18,106);device.queue.copyExternalImageToTexture({source:canvas},{texture:tex},[512,128]);}
    if(!sets.has(eye))sets.set(eye,device.createBindGroup({layout:pipe.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:eye}},{binding:1,resource:view},{binding:2,resource:sampler}]}));pass.setPipeline(pipe);pass.setBindGroup(0,sets.get(eye));pass.draw(6);},dispose:()=>tex.destroy()};
}
