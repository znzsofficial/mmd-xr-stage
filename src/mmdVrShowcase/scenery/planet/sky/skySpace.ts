// A background pass is independent of the stage's far clip. A bounded
// observer still gives the two eyes and the inter-moon flight different rays,
// without letting free flight pass through a distant planet or dust shell.
export const skySpace = `
const float dustDistance=235., emissionDistance=720.;
vec3 skyEye(vec3 p){return p*inversesqrt(1.+dot(p,p)/3600.);}
vec2 shellUV(vec3 n){return vec2(atan(n.z,-n.x)*.1591549431,asin(clamp(n.y,-1.,1.))*.3183098862+.5);}
vec3 shellDir(vec3 eye,vec3 d,float r){float k=dot(eye,d);return normalize(eye+d*(sqrt(max(0.,k*k+r*r-dot(eye,eye)))-k));}
`;

// At ±π, neighbouring pixels may have longitudes near 0 and 1. Supply the
// short wrapped derivative so just that meridian doesn't choose the last mip.
export const sampleLongitude=`
vec4 sampleLongitude(sampler2D atlas,vec2 uv){vec2 dx=dFdx(uv),dy=dFdy(uv);
  dx.x-=floor(dx.x+.5);dy.x-=floor(dy.x+.5);return textureGrad(atlas,uv,dx,dy);}
`;
