import { DataTexture } from 'three';

const folder = f => (f.webkitRelativePath || f.name).replaceAll('\\','/').split('/').slice(0,-1).join('/');
const factory = () => new Worker(new URL('./actorStyleMaps.worker.js',import.meta.url),{type:'module'});
const emptyMaps = () => ({cloth:new Map(),face:new Map(),hair:new Map()});

// Decoders can share one atlas across several draws. Dispose each owned
// texture once, after the adapter has retired everything that samples it.
export function disposeActorStyleMaps(maps) {
  if (!maps) return;
  const textures = new Set(maps.cloth.values());
  for (const t of maps.hair?.values() ?? []) textures.add(t);
  for (const {field,ramp} of maps.face.values()) { textures.add(field); textures.add(ramp); }
  for (const t of textures) t.dispose();
}

function textures(result) {
  const made = new Map();
  function texture(source) {
    if (!made.has(source)) {
      const {data,width,height,format,...sampling} = source, t = new DataTexture(data,width,height,format);
      made.set(source,t); Object.assign(t,sampling); t.needsUpdate = true;
    }
    return made.get(source);
  }
  try {
    return {cloth:new Map(result.cloth.map(([i,t])=>[i,texture(t)])),
      hair:new Map(result.hair.map(([i,t])=>[i,texture(t)])),
      face:new Map(result.face.map(([i,{field,ramp}])=>[i,{field:texture(field),ramp:texture(ramp)}]))};
  } catch (e) { for (const t of made.values()) t.dispose(); throw e; }
}

export async function loadActorStyleMaps({file,resolver,companionFiles}, inputs, signal, workerFor = factory) {
  signal.throwIfAborted();
  const root = folder(file);
  // Loose files in the page backpack carry no package identity. A single PMX
  // there does not establish the owner of an independently imported face set.
  if (!root) return emptyMaps();
  const refs = new Map();
  for (const {ref} of inputs) if (!refs.has(ref)) {
    signal.throwIfAborted(); refs.set(ref,await resolver.resolve(ref));
  }
  signal.throwIfAborted();
  const resolved = [...refs.values()].filter(Boolean);
  const diffuseNames = new Set(resolved.map(f=>f.name.toLowerCase()));
  const hairOnly = inputs.every(v=>v.role==='hair');
  const accessory = hairOnly ? /\.strand-mask\.png$/i : /_(?:n|p|sdf|cm_m|rd)\.png$/i;
  const models = companionFiles.filter(f=>/\.pm[dx]$/i.test(f.name));
  const nested = [...new Set(models.map(folder))].filter(dir=>dir.startsWith(root+'/'));
  const within = (dir, parent) => dir === parent || dir.startsWith(parent+'/');
  // A package may have an author-supplied duplicate diffuse in another map
  // subdirectory. The shared readers require its bytes to match before use.
  const files = [...new Set(companionFiles)].filter(f => {
    const dir = folder(f);
    // Basename fallback can display a diffuse from another import. That does
    // not make its directory (or another model's subtree) this actor's pack.
    return within(dir,root) && !nested.some(p=>within(dir,p)) &&
      (diffuseNames.has(f.name.toLowerCase()) || accessory.test(f.name));
  });
  const indices = new Map(files.map((f,i)=>[f,i]));
  const slots = inputs.filter(v=>indices.has(refs.get(v.ref))).map(v=>({...v,file:indices.get(refs.get(v.ref))}));
  if (!slots.length || !files.some(f=>hairOnly ? accessory.test(f.name) : /_(?:n|sdf)\.png$/i.test(f.name))) return emptyMaps();
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
