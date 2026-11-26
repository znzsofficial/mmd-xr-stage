import { loadClothDetails } from './endfieldCloth.js';
import { loadFaceDetails } from './endfieldFace.js';

// Inflate and validate optional data on a disposable worker, not on the XR
// thread. Reuse the same map readers as the reference renderer. Only their
// typed arrays and sampling parameters are sent back, never a Three object.
self.onmessage = async ({data:{inputs,files}}) => {
  try {
    const members = files.map(({file,path}) => {
      if (file.webkitRelativePath !== path) Object.defineProperty(file,'webkitRelativePath',{value:path});
      return file;
    });
    const refs = new Map(), materials = Array(Math.max(...inputs.map(v=>v.i))+1).fill(null), cloth = [], face = [];
    for (const {i,role,ref,file,width,height,wrapS,wrapT,flipY} of inputs) {
      refs.set(ref,members[file]);
      materials[i] = { userData:{mmdMaterial:{texturePath:ref}}, map:{image:{width,height},wrapS,wrapT,flipY} };
      (role === 'face' ? face : cloth).push(i);
    }
    const model = {mesh:{material:materials}}, resolver = {resolve:ref => refs.get(ref)};
    const clothMaps = await loadClothDetails(model,cloth,resolver,members);
    const faceMaps = await loadFaceDetails(model,face,resolver,members);
    const images = new Map(), buffers = [];
    function image(texture) {
      if (!images.has(texture)) {
        const {image:{data,width,height},wrapS,wrapT,flipY,magFilter,minFilter,generateMipmaps} = texture;
        images.set(texture,{data,width,height,wrapS,wrapT,flipY,magFilter,minFilter,generateMipmaps});
        buffers.push(data.buffer);
      }
      return images.get(texture);
    }
    self.postMessage({cloth:[...clothMaps].map(([i,t])=>[i,image(t)]),
      face:[...faceMaps].map(([i,{field,ramp}])=>[i,{field:image(field),ramp:image(ramp)}])},buffers);
  } catch { self.postMessage({failed:true}); }
};
