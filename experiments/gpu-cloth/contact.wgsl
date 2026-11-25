struct Capsule { a:vec4f, b:vec4f }
struct Bounds { lo:vec4f, hi:vec4f }
@group(0) @binding(7) var<storage,read> capsules:array<Capsule>;
@group(0) @binding(8) var<uniform> bounds:array<Bounds,80>;
override cull:bool=true;
fn outside(p:vec3f,b:Bounds)->bool{return any(p<b.lo.xyz)||any(p>b.hi.xyz);}
fn pushOut(p:vec3f,c:Capsule)->vec3f{
  let axis=c.b.xyz-c.a.xyz;let a=c.a.xyz+axis*clamp(dot(p-c.a.xyz,axis)/max(dot(axis,axis),1e-9),0.,1.);
  let v=p-a;let l=length(v);if(l<c.a.w){return a+select(vec3f(0.,0.,1.),v/max(l,.000001),l>.000001)*c.a.w;}return p;
}
fn collide(start:vec3f,count:u32,allowed:vec2u)->vec4f{
  var p=start;var tests=0u;for(var k=0u;k<count;){
    if(cull && (k&3u)==0u && outside(p,bounds[64u+k/4u])){k+=4u;continue;}
    if((allowed[k>>5u] & (1u<<(k&31u)))!=0u && (!cull || !outside(p,bounds[k]))){p=pushOut(p,capsules[k]);tests++;}k++;
  }return vec4f(p,f32(tests));
}
