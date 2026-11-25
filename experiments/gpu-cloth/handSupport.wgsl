// Author skin barycentres, in the same palette and particle space as surface().
struct SkinTerm { weighted:vec4f, ids:vec4f }
struct Prior { p:vec4f, goal:vec4f }
struct Grip { start:vec4f, end:vec4f } // start.w: continuous, end.w: radius
struct HandStep { hands:array<Grip,2>, scale:f32 }
@group(0) @binding(0) var<uniform> frame:HandStep;
@group(0) @binding(1) var<storage,read> heads:array<vec4f>;
@group(0) @binding(2) var<storage,read> terms:array<SkinTerm>;
@group(0) @binding(3) var<storage,read> palette:array<mat4x4f>;
@group(0) @binding(4) var<storage,read> goals:array<vec4f>;
@group(0) @binding(5) var<storage,read_write> points:array<vec4f>;
@group(0) @binding(6) var<storage,read_write> prior:array<Prior>;
// A separate inequality for each hand, including at the same garment sample.
struct Response { hand:array<vec4f,2> } // xyz: correction, w: supported on crown
@group(0) @binding(9) var<storage,read_write> pushes:array<Response>;
@group(0) @binding(10) var<storage,read> ranges:array<vec2u>;
@group(0) @binding(11) var<storage,read> refs:array<vec2f>;
@group(0) @binding(12) var<storage,read> nodeHeaders:array<vec4u>;

// Swept point against the upper hemisphere in relative motion. A contact is
// compressive only: a sample never follows a retreating grip down or sideways.
// Catch a crossing even if the end point is already above the entire garment.
fn support(p0:vec3f,p1:vec3f,g:Grip,held:bool)->vec4f{
  let r=g.end.w;if(g.start.w==0. || r==0.){return vec4f(0.);}
  let a=p0-g.start.xyz;let b=p1-g.end.xyz;let rr=r*r;let radial=dot(b.xz,b.xz);
  let depth=sqrt(max(0.,rr-radial))-b.y;let onCrown=radial<rr && depth>=-.001;
  let cap=.045+length(g.end.xyz-g.start.xyz);
  if(onCrown && held && a.y>=-.008 && dot(a.xz,a.xz)<rr*1.05){return vec4f(0.,clamp(depth,0.,cap),0.,1.);}
  // On reacquisition an already embedded sample is not a new approach.
  // Conservative reject against the entire relative segment, not just its end.
  if(any(min(a,b)>vec3f(r)) || any(max(a,b)<vec3f(-r))){return vec4f(0.);}
  let v=b-a;let vv=dot(v,v);let av=dot(a,v);let dist=dot(a,a)-rr;
  if(vv<1e-12 || av>=0. || dist < -1e-6){return vec4f(0.);}
  let disc=av*av-vv*dist;if(disc<0.){return vec4f(0.);}
  let t=max(0.,dist)/max(1e-12,-av+sqrt(disc));if(t>1.){return vec4f(0.);}
  let normal=normalize(a+t*v);
  if(onCrown && normal.y>=0. && -v.y>=length(v.xz)*.5){return vec4f(0.,clamp(depth,0.,cap),0.,1.);}
  // A sideways sweep can enter and leave the ball in a single tracked step.
  // Project onto the tangent at first impact. No latch or pull on later frames.
  return vec4f(normal*clamp(r-dot(b,normal),0.,cap),0.);
}

@compute @workgroup_size(64) fn handSamples(@builtin(global_invocation_id) id:vec3u){
  let i=id.x;if(i>=arrayLength(&heads)){return;}let h=heads[i];var p=vec3f(0.);var travel=vec3f(0.);
  for(var k=0u;k<u32(h.y);k++){
    let t=terms[u32(h.x)+k];p+=(palette[u32(t.ids.x)]*t.weighted).xyz*frame.scale;
    if(t.ids.y>=0.){let j=u32(t.ids.y);p+=(points[j]-goals[j]).xyz*t.weighted.w;
      travel+=(points[j]-prior[j].p).xyz*t.weighted.w;}
  }
  for(var side=0u;side<2u;side++){let d=support(p-travel,p,frame.hands[side],pushes[i].hand[side].w>0.);
    pushes[i].hand[side]=vec4f(d.xyz/max(.25,h.z),d.w);}
}

@compute @workgroup_size(64) fn liftNodes(@builtin(global_invocation_id) id:vec3u){
  let i=id.x;if(i>=arrayLength(&points)||points[i].w==0.){return;}
  let span=ranges[i];var best=array<vec3f,2>(vec3f(0.),vec3f(0.));var strength=vec2f(0.);
  for(var k=0u;k<span.y;k++){let link=refs[span.x+k];let response=pushes[u32(link.x)];
    for(var s=0u;s<2u;s++){let d=link.y*response.hand[s].xyz;let sq=dot(d,d);
      if(sq>strength[s]){best[s]=d;strength[s]=sq;}}}
  if(all(strength==vec2f(0.))){return;}
  // Remove only the common component: coincident grips don't double the load,
  // while disjoint grips can still support two entirely different panels.
  let overlap=max(0.,dot(best[0],best[1]));let strong=select(1u,0u,strength.x>=strength.y);let weak=1u-strong;
  let push=best[strong]+best[weak]*(1.-min(1.,overlap/max(strength[weak],1e-16)));
  // A sparse and a tessellated version of a panel should not get different
  // load just because more nearby samples found the same supporting sphere.
  let p=collide(points[i].xyz+push,arrayLength(&capsules),nodeHeaders[i].zw).xyz;
  points[i]=vec4f(p.x,max(.005,p.y),p.z,1.);
  // A constraint impulse is not next step's free upward launch velocity.
  let velocity=points[i].xyz-prior[i].p.xyz;
  prior[i].p+=vec4f(push*(dot(velocity,push)/max(dot(push,push),1e-14)),0.);
}
