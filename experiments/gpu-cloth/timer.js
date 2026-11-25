// Sparse asynchronous diagnostics: two timestamps only, never cloth vertices.
// Reject results from a retired mode/pose/window. No queue wait in the RAF.
export function computeTimer(device){
  if(!device.features.has('timestamp-query'))return null;
  const queries=device.createQuerySet({type:'timestamp',count:2}),resolve=device.createBuffer({size:16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}),
    read=device.createBuffer({size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  let frame=0,pending=false,dead=false;
  return {begin(){return !pending&&++frame%12===0?{querySet:queries,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}:undefined;},
    encode(e){e.resolveQuerySet(queries,0,2,resolve,0);e.copyBufferToBuffer(resolve,0,read,0,16);pending=true;},
    collect(done){read.mapAsync(GPUMapMode.READ).then(()=>{if(dead)return;const [a,b]=new BigUint64Array(read.getMappedRange());read.unmap();if(b>a)done(Number(b-a)/1e6);}).catch(()=>{}).finally(()=>pending=false);},
    dispose(){dead=true;queries.destroy();resolve.destroy();read.destroy();}};
}
