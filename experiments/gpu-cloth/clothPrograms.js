const devices = new WeakMap();

export async function checkedShader(device, code, label) {
  const module = device.createShaderModule({code, label});
  const {messages} = await module.getCompilationInfo();
  const errors = messages.filter(message => message.type === 'error');
  if (errors.length) {
    throw Error(`${label}: ${errors.map(m => `${m.lineNum}: ${m.message}`).join('; ')}`);
  }
  return module;
}

function deviceCache(device) {
  let cache = devices.get(device);
  if (!cache) {
    cache = {programs: new Map(), loss: null};
    devices.set(device, cache);
    device.lost?.then(info => {
      cache.loss = new Error(info?.message || 'Cloth GPU device lost');
      cache.programs.clear();
    });
  }
  return cache;
}

function compileOnce(cache, entries, key, compile) {
  if (cache.loss) return Promise.reject(cache.loss);
  let pending = entries.get(key);
  if (!pending) {
    pending = Promise.resolve(compile()).then(result => {
      if (cache.loss) throw cache.loss;
      return result;
    });
    entries.set(key, pending);
    pending.catch(() => entries.delete(key));
  }
  return pending;
}

// Only auto layout with default WGSL constants. The lab creates its own debug
// variants from the returned module; their layouts and constants differ.
export function clothProgram(device, source, label) {
  const cache = deviceCache(device);
  return compileOnce(cache, cache.programs, source, async () => {
    const module = await checkedShader(device, source, label);
    const pipelines = new Map();
    function pipeline(entryPoint) {
      return compileOnce(cache, pipelines, entryPoint, () => device.createComputePipelineAsync({
        layout: 'auto', compute: {module, entryPoint},
      }));
    }
    return {module, pipeline};
  });
}
