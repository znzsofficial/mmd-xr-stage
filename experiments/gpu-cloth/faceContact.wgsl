struct Term { weighted:vec4f, ids:vec4f }
@group(0) @binding(0) var<storage,read> heads:array<vec4f>;
@group(0) @binding(1) var<storage,read> terms:array<Term>;
@group(0) @binding(2) var<storage,read> palette:array<mat4x4f>;
@group(0) @binding(3) var<storage,read> goals:array<vec4f>;
@group(0) @binding(4) var<storage,read_write> points:array<vec4f>;
@group(0) @binding(5) var<storage,read_write> deltas:array<vec4f>;
struct Inputs { count:u32, contacts:u32, scale:f32, gain:f32, corner:vec4f, dims:vec4u }
@group(0) @binding(6) var<uniform> args:Inputs;
@group(0) @binding(9) var<storage,read> ranges:array<vec2u>;
@group(0) @binding(10) var<storage,read> refs:array<vec2f>;
@group(0) @binding(11) var<storage,read> field:array<vec4f>;
struct Corner { rest:vec4f, bones:vec4f, weights:vec4f, id:vec4f }
@group(0) @binding(12) var<storage,read> corners:array<Corner>;
@group(0) @binding(13) var<storage,read> nodeForBone:array<u32>;
@group(0) @binding(14) var<storage,read_write> residual:array<vec4f>;
@group(0) @binding(15) var<storage,read> nodeHeaders:array<vec4u>;

fn wall(p:vec3f)->vec3f{
  let grid=(p-args.corner.xyz)/args.corner.w;if(any(grid<vec3f(0.))||any(grid>=vec3f(args.dims.xyz-1u))){return vec3f(0.);}
  let ij=vec3u(grid);let t=fract(grid);var result=vec3f(0.);
  for(var z=0u;z<2u;z++){for(var y=0u;y<2u;y++){for(var x=0u;x<2u;x++){
    let v=ij+vec3u(x,y,z);let w=select(vec3f(1.)-t,t,vec3u(x,y,z)>vec3u(0));result+=field[v.x+args.dims.x*(v.y+args.dims.y*v.z)].xyz*w.x*w.y*w.z;}}}
  return result;
}

@compute @workgroup_size(64) fn sampleFace(@builtin(global_invocation_id) gid:vec3u){
  let i=gid.x;if(i>=args.count){return;}let h=heads[i];var p=vec3f(0.);
  for(var k=0u;k<u32(h.y);k++){let t=terms[u32(h.x)+k];p+=(palette[u32(t.ids.x)]*t.weighted).xyz*args.scale;
    if(t.ids.y>=0.){let j=u32(t.ids.y);p+=t.weighted.w*(points[j]-goals[j]).xyz;}}
  let delta=wall(p);
  // A single sample must not fling a light or weakly weighted panel.
  let d=delta*(min(1.,.012/max(1e-7,length(delta)))*args.gain/max(.2,h.z));
  deltas[i]=vec4f(d,select(0.,1.,dot(d,d)>1e-12));
}
@compute @workgroup_size(64) fn gather(@builtin(global_invocation_id) gid:vec3u){
  let i=gid.x;if(i>=arrayLength(&points)||points[i].w==0.){return;}let r=ranges[i];var d=vec3f(0.);var w=0.;
  for(var k=0u;k<r.y;k++){let link=refs[r.x+k];let s=deltas[u32(link.x)];let influence=link.y*link.y;d+=influence*link.y*s.xyz;w+=influence*s.w;}
  if(w>0.){let step=d/w;let p=collide(points[i].xyz+step*min(1.,.002/max(length(step),1e-8)),args.contacts,nodeHeaders[i].zw).xyz;
    let displacement=p-points[i].xyz;if(length(displacement)<=.0021){points[i]=vec4f(p.x,max(.005,p.y),p.z,1.);}}
}

// Once per displayed update, not per eye. This small surface offset never
// feeds the inertial state or edits the authored vertex/skin weights.
@compute @workgroup_size(64) fn finishCorners(@builtin(global_invocation_id) gid:vec3u){
  let i=gid.x;if(i>=arrayLength(&corners)){return;}let c=corners[i];var p=vec3f(0.);
  for(var k=0u;k<4u;k++){if(c.weights[k]>0.){let b=u32(c.bones[k]);var v=(palette[b]*vec4f(c.rest.xyz,1.)).xyz*args.scale;
    let j=nodeForBone[b];if(j!=0u){v+=(points[j-1u]-goals[j-1u]).xyz;}p+=c.weights[k]*v;}}
  let d=wall(p);residual[u32(c.id.x)]=vec4f(d*min(1.,min(.006,c.rest.w)/max(1e-8,length(d))),0.);
}
