// Runs inside the built screen viewer. Within each comparison the clock,
// camera, lighting and source vertices stay still. Reverse whole triangles
// (never their winding) to expose overlapping fragments competing for depth.
module.exports = function parkDepthTake() {
  const {renderer, scene, camera} = window.parkQA;
  const gl = renderer.getContext(), shot = camera.clone();
  const bytes = gl.drawingBufferWidth * gl.drawingBufferHeight * 4;
  const baseline = new Uint8Array(bytes), alternate = new Uint8Array(bytes);
  const meshes = ['park:shopfronts','park:paving'].map(name => {
    const attr = scene.getObjectByName(name)?.geometry.index;
    if (!attr) throw Error('Missing indexed park surface: ' + name);
    const original = attr.array.slice(), reversed = new original.constructor(original.length);
    for (let i=0; i<original.length; i+=3) reversed.set(original.subarray(i,i+3),original.length-i-3);
    return {name, attr, original, reversed};
  });
  const render = pixels => {
    renderer.render(scene,shot);
    gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  };
  function differences() {
    let count=0;
    for (let i=0; i<bytes; i+=4) {
      if (Math.abs(baseline[i]-alternate[i])>=5 || Math.abs(baseline[i+1]-alternate[i+1])>=5 ||
          Math.abs(baseline[i+2]-alternate[i+2])>=5) count++;
    }
    return count;
  }
  const views = [
    ['shops',[16.65,1.57,32.6],[10.2,2.1,37.55]],
    ['fountain',[-.9,1.6,17],[4,1,24]],
    ['crossing',[15.7,1.55,31],[20.1,0,35.6]],
    ['seated',[9.9,1.17,28.6],[2.4,2.1,36.6]],
  ];
  const result={size:[gl.drawingBufferWidth,gl.drawingBufferHeight],depthBits:gl.getParameter(gl.DEPTH_BITS),views:{}};
  try {
    for (const [name,eye,aim] of views) {
      const take = result.views[name] = {};
      for (const offset of [-.045,0,.045]) {
        shot.position.set(eye[0]+offset,eye[1],eye[2]);shot.lookAt(aim[0]+offset,aim[1],aim[2]);shot.updateMatrixWorld();
        render(baseline);
        for (const {name,attr,original,reversed} of meshes) {
          attr.array.set(reversed);attr.needsUpdate=true;render(alternate);
          (take[name]??=[]).push(differences());
          attr.array.set(original);attr.needsUpdate=true;
        }
        render(alternate);
        if (differences()!==0) throw Error('Park control frame did not restore: '+name);
      }
    }
  } finally {
    for (const {attr,original} of meshes) {attr.array.set(original);attr.needsUpdate=true;}
    renderer.render(scene,camera);
  }
  return result;
};
