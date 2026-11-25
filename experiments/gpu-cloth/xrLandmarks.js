// Fixed metre-scale references, independent of the actor, textures and bind groups.
// Both eyes use the same mesh in lab space; only the view-projection changes.
function calibrationMesh(){
  const vertices=[];
  function quad(a,b,c,d,color){for(const p of [a,b,c,a,c,d])vertices.push(...p,...color);}
  function tile(x,z,w,h,y,color){quad([x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h],color);}
  function box(x,y,z,w,h,d,color){
    const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c=[x+w/2,y,z+d/2],e=[x-w/2,y,z+d/2];
    const top=p=>[p[0],y+h,p[2]],side=color.map(v=>v*.7);
    quad(a,b,top(b),top(a),color);quad(b,c,top(c),top(b),side);
    quad(c,e,top(e),top(c),color);quad(e,a,top(a),top(e),side);quad(top(a),top(b),top(c),top(e),color);
  }
  const amber=[.96,.48,.16],teal=[.12,.77,.72],chalk=[.82,.85,.78];
  for(let x=-6;x<6;x++)for(let z=-6;z<6;z++)tile(x,z,1,1,-.012,(x+z)&1?[.16,.23,.25]:[.22,.30,.32]);
  for(const [x,z,h,color] of [[-.7,-.85,1.6,amber],[.8,-1.65,1.28,teal]]){
    box(x,0,z,.30,.07,.30,color);box(x,.07,z,.10,h-.07,.10,color);
    for(let y=.25;y<h-.05;y+=.25)box(x,y,z,.115,.028,.115,chalk);
    box(x,h,z,.20,.08,.20,color);
  }
  // On turning away from the sample the player can still see distance and heading.
  for(const [x,z] of [[-3,-3],[3,-3],[-3,3],[3,3]])box(x,0,z,.16,.68,.16,chalk);
  return new Float32Array(vertices);
}

const code=`struct Out { @builtin(position) position:vec4f, @location(0) color:vec3f }
  @vertex fn vertex(@location(0) p:vec3f, @location(1) rgb:vec3f,
                    @location(2) a:vec4f, @location(3) b:vec4f, @location(4) c:vec4f, @location(5) d:vec4f)->Out {
    return Out(mat4x4f(a,b,c,d)*vec4f(p,1.),rgb);
  }
  @fragment fn fragment(in:Out)->@location(0) vec4f {return vec4f(in.color,1.);}`;

export function makeXRLandmarks(device,format,depthFormat){
  const module=device.createShaderModule({label:'XR lab landmarks',code});
  const pipeline=device.createRenderPipeline({label:'XR lab landmarks',layout:'auto',
    vertex:{module,entryPoint:'vertex',buffers:[{arrayStride:24,attributes:[{shaderLocation:0,format:'float32x3',offset:0},{shaderLocation:1,format:'float32x3',offset:12}]},
      {arrayStride:64,stepMode:'instance',attributes:[0,1,2,3].map(i=>({shaderLocation:i+2,format:'float32x4',offset:i*16}))}]},
    fragment:{module,entryPoint:'fragment',targets:[{format}]},depthStencil:{format:depthFormat,depthCompare:'less',depthWriteEnabled:true}});
  const mesh=calibrationMesh(),geometry=device.createBuffer({label:'XR calibration floor and posts',usage:GPUBufferUsage.VERTEX,size:mesh.byteLength,mappedAtCreation:true});
  try{new Float32Array(geometry.getMappedRange()).set(mesh);geometry.unmap();}catch(error){geometry.destroy();throw error;}
  const cameras=[],matrix=new Float32Array(16);
  return {draw(pass,index,viewProjection){
    const camera=cameras[index]??=device.createBuffer({label:'XR landmark eye '+index,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST,size:64});
    matrix.set(viewProjection);device.queue.writeBuffer(camera,0,matrix);
    pass.setPipeline(pipeline);pass.setVertexBuffer(0,geometry);pass.setVertexBuffer(1,camera);pass.draw(mesh.length/6);
  },dispose(){geometry.destroy();for(const camera of cameras)camera?.destroy();}};
}
