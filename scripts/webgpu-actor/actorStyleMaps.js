import { DataTexture } from 'three';

const folder = f => (f.webkitRelativePath || f.name).replaceAll('\\','/').split('/').slice(0,-1).join('/');
const factory = () => new Worker(new URL('./actorStyleMaps.worker.js',import.meta.url),{type:'module'});

// Decoders can share one atlas across several draws. Dispose each owned
// texture once, after the adapter has retired everything that samples it.
export function disposeActorStyleMaps(maps) {
  if (!maps) return;
  const textures = new Set(maps.cloth.values());
  for (const {field,ramp} of maps.face.values()) { textures.add(field); textures.add(ramp); }
  for (const t of textures) t.dispose();
}

function textures(result) {
  const made = new Map();
  function texture(source) {
    if (!made.has(source)) {
      const {data,width,height,...sampling} = source, t = new DataTexture(data,width,height);
      made.set(source,t); Object.assign(t,sampling); t.needsUpdate = true;
    }
    return made.get(source);
  }
  try {
    return {cloth:new Map(result.cloth.map(([i,t])=>[i,texture(t)])),
      face:new Map(result.face.map(([i,{field,ramp}])=>[i,{field:texture(field),ramp:texture(ramp)}]))};
  } catch (e) { for (const t of made.values()) t.dispose(); throw e; }
}

export async function loadActorStyleMaps({file,resolver,companionFiles}, inputs, signal, workerFor = factory) {
  const refs = new Map();
  for (const {ref} of inputs) if (!refs.has(ref)) {
    signal.throwIfAborted(); refs.set(ref,await resolver.resolve(ref));
  }
  signal.throwIfAborted();
  const resolved = [...refs.values()].filter(Boolean);
  const diffuseNames = new Set(resolved.map(f=>f.name.toLowerCase()));
  const roots = new Set(resolved.map(folder)), root = folder(file);
  const single = !root && companionFiles.filter(f=>/\.pm[dx]$/i.test(f.name)).length === 1;
  // A package may have an author-supplied duplicate diffuse in another map
  // subdirectory. The shared readers require its bytes to match before use.
  const files = [...new Set(companionFiles)].filter(f => {
    const dir = folder(f);
    return (single || roots.has(dir) || (root && (dir === root || dir.startsWith(root+'/')))) &&
      (diffuseNames.has(f.name.toLowerCase()) || /_(?:n|p|sdf|cm_m|rd)\.png$/i.test(f.name));
  });
  const indices = new Map(files.map((f,i)=>[f,i]));
  const slots = inputs.filter(v=>indices.has(refs.get(v.ref))).map(v=>({...v,file:indices.get(refs.get(v.ref))}));
  if (!slots.length || !files.some(f=>/_(?:n|sdf)\.png$/i.test(f.name))) return {cloth:new Map(),face:new Map()};
  return new Promise((resolve,reject) => {
    const worker = workerFor();
    function retire() {
      signal.removeEventListener('abort',abort); worker.onmessage = worker.onerror = worker.onmessageerror = null;
      worker.terminate();
    }
    function abort() { retire(); reject(signal.reason); }
    const fail = () => { retire(); reject(Error('Could not read the optional style maps')); };
    signal.addEventListener('abort',abort,{once:true});
    worker.onerror = worker.onmessageerror = e => { e.preventDefault?.(); fail(); };
    worker.onmessage = ({data}) => {
      retire();
      try { signal.throwIfAborted(); if (data.failed) throw Error('Unsupported style maps'); resolve(textures(data)); }
      catch (error) { reject(error); }
    };
    try { worker.postMessage({inputs:slots,files:files.map(file=>({file,path:file.webkitRelativePath||file.name}))}); }
    catch (error) { retire(); reject(error); }
  });
}
