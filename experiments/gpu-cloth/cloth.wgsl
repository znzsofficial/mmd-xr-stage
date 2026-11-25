// All positions in metres. The two passes have distinct input/output buffers:
// each Jacobi iteration reads only positions from the preceding dispatch.
struct Frame { dt:f32, seed:u32, contacts:u32, count:u32 }
struct Capsule { a:vec4f, b:vec4f }
struct History { p:vec4f, goal:vec4f }
@group(0) @binding(0) var<uniform> f:Frame;
@group(0) @binding(1) var<storage,read> anchors:array<vec4f>; // w=0 pinned
@group(0) @binding(2) var<storage,read> src:array<vec4f>;
@group(0) @binding(3) var<storage,read_write> dst:array<vec4f>;
@group(0) @binding(4) var<storage,read_write> previous:array<History>;
@group(0) @binding(5) var<storage,read> spans:array<vec4u>;
@group(0) @binding(6) var<storage,read> edges:array<vec4f>;
@group(0) @binding(7) var<storage,read> capsules:array<Capsule>;

@compute @workgroup_size(64) fn predict(@builtin(global_invocation_id) gid:vec3u){
  let i=gid.x;if(i>=f.count){return;}let t=anchors[i];var p=t.xyz;
  var prev=p;
  if(f.seed==0u && t.w>0.){
    let x=src[i].xyz;let vel=(x-previous[i].p.xyz)*.9;
    // Carry the waist with the moving actor during a large posture change.
    // Do not feed the transported distance back into the next inertial step.
    prev=x+.86*(t.xyz-previous[i].goal.xyz);
    p=prev+vel+(vec3f(0.,-9.81,0.)+(t.xyz-prev)*54.)*f.dt*f.dt;
  }
  previous[i]=History(vec4f(prev,t.w),t);dst[i]=vec4f(p,t.w);
}

@compute @workgroup_size(64) fn constrain(@builtin(global_invocation_id) gid:vec3u){
  let i=gid.x;if(i>=f.count){return;}let t=anchors[i];if(t.w==0.){dst[i]=t;return;}
  var p=src[i].xyz;let h=spans[i];var correction=vec3f(0.);var weights=0.;
  for(var k=0u;k<h.y;k++){let edge=edges[h.x+k];let other=src[u32(edge.x)];let d=other.xyz-p;let l=max(.00001,length(d));
    correction+=edge.z*(l-edge.y)*d/(l*(1.+other.w));weights+=edge.z;}
  p+=correction/max(1.,weights)*1.45;
  for(var k=0u;k<f.contacts;k++){let c=capsules[k];let axis=c.b.xyz-c.a.xyz;
    let a=c.a.xyz+axis*clamp(dot(p-c.a.xyz,axis)/max(dot(axis,axis),1e-9),0.,1.);
    let v=p-a;let l=length(v);if(l<c.a.w){p=a+select(vec3f(0.,0.,1.),v/max(l,.000001),l>.000001)*c.a.w;}}
  p.y=max(.005,p.y);dst[i]=vec4f(p,t.w);
}
