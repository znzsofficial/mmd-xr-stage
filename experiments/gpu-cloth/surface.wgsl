struct View { vp:mat4x4f, params:vec4f } // cloth active, scale, first hand
@group(0) @binding(0) var<uniform> view:View;
@group(0) @binding(1) var<storage,read> palette:array<mat4x4f>;
@group(0) @binding(2) var<storage,read> lookup:array<u32>;
@group(0) @binding(3) var<storage,read> cloth:array<vec4f>;
@group(0) @binding(4) var<storage,read> anchors:array<vec4f>;
@group(0) @binding(5) var<storage,read> caps:array<vec4f>;
@group(1) @binding(0) var tex:texture_2d<f32>;
@group(1) @binding(1) var samp:sampler;
@group(1) @binding(2) var<uniform> tint:vec4f;
struct Out {@builtin(position) pos:vec4f,@location(0) uv:vec2f,@location(1) wp:vec3f}
@vertex fn surface(@location(0) pos:vec3f,@location(1) uv:vec2f,@location(2) bones:vec4u,@location(3) w:vec4f)->Out{
  var p=vec3f(0.);for(var k=0u;k<4u;k++){if(w[k]>0.){let b=bones[k];var v=(palette[b]*vec4f(pos,1.)).xyz*view.params.y;
    let j=lookup[b];if(view.params.x>0. && j!=0u){v+=(cloth[j-1u]-anchors[j-1u]).xyz;}p+=v*w[k];}}
  return Out(view.vp*vec4f(p,1.),uv,p);
}
@fragment fn shade(i:Out)->@location(0) vec4f{
  let rgba=textureSample(tex,samp,i.uv)*tint;let n=cross(dpdx(i.wp),dpdy(i.wp));
  let light=.75+.25*abs(dot(normalize(n+vec3f(0.,1e-12,0.)),normalize(vec3f(-.3,.6,1.))));
  if(rgba.a<.16){discard;}return vec4f(rgba.rgb*light,rgba.a);
}
// A small visible marker at the same position and radius as each hand collider.
@vertex fn marker(@builtin(vertex_index) v:u32,@builtin(instance_index) id:u32)->@builtin(position) vec4f{
  let c=caps[(u32(view.params.z)+id)*2u];let k=v/6u;let offsets=array<vec2u,6>(vec2u(0,0),vec2u(0,1),vec2u(1,0),vec2u(1,0),vec2u(0,1),vec2u(1,1));
  let s=vec2f(vec2u(k%12u,k/12u)+offsets[v%6u]);let a=s.x*.523599;let b=s.y*.523599-1.570796;
  return view.vp*vec4f(c.xyz+c.w*vec3f(cos(a)*cos(b),sin(b),sin(a)*cos(b)),1.);
}
@fragment fn gold()->@location(0) vec4f{return vec4f(.94,.66,.36,1.);}
