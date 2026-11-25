import {makeXRLandmarks} from './xrLandmarks.js';

// https://immersive-web.github.io/webxr-webgpu-binding/#xrgpusubimage-getviewdescriptor
// The projection layer is an array, even when a compositor uses a packed image
// internally. Only this frame's subimage may identify the slice; eye order cannot.
const depthFormat='depth24plus'; // Requested by the lab's projection layer and actor pipeline.
export function makeXRTargets(device,binding,layer){
  const format=binding.getPreferredColorFormat(),landmarks=makeXRLandmarks(device,format,depthFormat);
  const localDepth=[];let disposed=false;
  function depthForEye(index,width,height){
    let entry=localDepth[index];
    if(!entry||entry.texture.width!==width||entry.texture.height!==height){
      const texture=device.createTexture({label:'XR local eye depth '+index,size:[width,height],format:depthFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT});
      let view;try{view=texture.createView();}catch(error){texture.destroy();throw error;}
      entry?.texture.destroy();entry=localDepth[index]={texture,view};
    }
    return entry.view;
  }
  function targetForEye(view,index,used){
      const sub=binding.getViewSubImage(layer,view),desc=sub.getViewDescriptor(),{colorTexture:tex,depthStencilTexture:z,viewport}=sub;
      const arrayLayer=desc.baseArrayLayer;
      if(desc.dimension!=='2d'||desc.arrayLayerCount!==1||!Number.isInteger(arrayLayer)||arrayLayer<0||arrayLayer>=tex.depthOrArrayLayers||
        (desc.baseMipLevel??0)!==0||(desc.mipLevelCount??1)!==1)throw Error('XR 子图没有有效的单眼纹理切片');
      if(used.some(v=>v.arrayLayer===arrayLayer&&(v.tex===tex||(z&&z===v.z))))throw Error('XR 子图为两眼返回了同一纹理切片');
      used.push({tex,z,arrayLayer});
      if(tex.format!==format||!(tex.usage&GPUTextureUsage.RENDER_ATTACHMENT))throw Error('XR 颜色附件格式或用途与投影层不符');
      const {x,y,width,height}=viewport;
      if(!(width>0&&height>0&&x>=0&&y>=0&&x+width<=tex.width&&y+height<=tex.height))throw Error('XR 子图视口超出单眼颜色附件');
      // No space-warp feature requested. Supplied depth must describe the same
      // region as color. A layer created without depth legally returns null.
      if(z&&(sub.motionVectorTexture||z.format!==depthFormat||z.width!==tex.width||z.height!==tex.height||arrayLayer>=z.depthOrArrayLayers||!(z.usage&GPUTextureUsage.RENDER_ATTACHMENT)))
        throw Error('XR 深度附件与单眼颜色附件不兼容');
      // XR texture descriptors have no alternate viewFormats. Select only the
      // specified subresource, inheriting each texture's own format and usage.
      const slice={dimension:'2d',baseArrayLayer:arrayLayer,arrayLayerCount:1,mipLevelCount:1};
      const color=tex.createView(slice),depth=z?z.createView(slice):depthForEye(index,tex.width,tex.height);
      return {color,depth,viewport,format,arrayLayer,depthFormat,depthSource:z?'layer':'local',beginPass(encoder,matrix){
        const pass=encoder.beginRenderPass({label:'XR lab eye '+index,
          colorAttachments:[{view:color,loadOp:'clear',storeOp:'store',clearValue:[.09,.16,.21,1]}],
          depthStencilAttachment:{view:depth,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:z?'store':'discard'}});
        pass.setViewport(x,y,width,height,0,1);pass.setScissorRect(x,y,width,height);
        landmarks.draw(pass,index,matrix);return pass;
      }};
  }
  return {views(xrViews){
    if(disposed)throw Error('XR 投影层已释放');
    const used=[];
    return Array.from(xrViews,(view,index)=>{
      try{return targetForEye(view,index,used);}catch(cause){
        const error=new Error(cause?.message??'XR 单眼附件不可用',{cause});
        error.name=cause?.name??'Error';error.eyeIndex=index;throw error;
      }
    });
  },dispose(){if(disposed)return;disposed=true;landmarks.dispose();for(const entry of localDepth)entry?.texture.destroy();}};
}
