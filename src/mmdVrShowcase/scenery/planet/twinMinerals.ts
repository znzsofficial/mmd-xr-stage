import {surfaceGrain} from './surfaceGrain';

// Each print packs two tangent slopes, a stone tone and a mineral mask in a
// single mip chain. Shade per eye; neither the sun nor a highlight is in the art.
export const mineralVertex=`
  varying vec3 world,n,radial,eye;varying vec2 st;
  void main(){
    vec4 p=modelMatrix*vec4(position,1.);
    world=p.xyz;eye=cameraPosition-world;radial=mat3(modelMatrix)*position;
    n=mat3(modelMatrix)*normal;st=uv;gl_Position=projectionMatrix*viewMatrix*p;
  }`;

export const mineralFragment=`
  ${surfaceGrain}
  varying vec3 world,n,radial,eye;varying vec2 st;
  uniform vec3 sun,probe,probeUp;uniform sampler2D printMap;uniform float mapped;
  float probeShadow(vec3 mid,float r){
    vec3 delta=mid-world;float t=dot(delta,sun);
    return smoothstep(.015,.14,t)*(1.-smoothstep(r*.78,r+.055,length(delta-t*sun)));
  }
  void main(){
    vec3 N=normalize(n),R=normalize(radial),V=normalize(eye);
    vec2 d=vec2(R.z,-R.x);vec3 T=vec3(d.x,0.,d.y);
    // Slopes are measured on the spherical chart, then laid on the curved
    // walking shell. At the pole the chart collapses; fade its perturbation.
    T=T-dot(T,N)*N;T*=inversesqrt(max(dot(T,T),.0015));vec3 B=cross(N,T);
    vec4 ink;
    if(mapped>.5){ink=texture2D(printMap,st);}else{
      // In-flight decode and missing file: keep the relief in sunlight and a
      // coarse mineral signature, without placeholder geometry or a flash.
      float vein=sin(13.*R.z-5.*R.x+2.6*sin(4.*R.y));
      ink=vec4(.5,.5,.52+.18*vein,.50+.18*smoothstep(.66,1.,vein));
    }
    float tone=clamp(ink.b,0.,1.),mask=clamp((ink.a-.5)*2.04,0.,1.);
    vec3 grit=grainAt(radial,R,1.82,length(eye));
    tone=clamp(tone+.43*grit.r+.18*grit.g,0.,1.);
    vec2 slope=ink.rg*2.-1.;vec3 F=normalize(N+(T*slope.x+B*slope.y)*.81);
    // Centimetre-scale cleavage under the coarse mineral print. Sample in
    // metres, attenuating the whole grain before it goes sub-pixel in either eye.
    vec2 vein=vec2(dot(radial,vec3(.88,.32,.18)),dot(radial,vec3(-.24,.9,.42)));
    vec2 freq=fwidth(vein)*92.;float detail=1.-smoothstep(.18,1.1,max(freq.x,freq.y));
    float lamella=sin(vein.x*91.+2.8*sin(vein.y*19.));
    float inclusion=cos(vein.y*113.+1.9*sin(vein.x*37.));
    F=normalize(F+detail*(.063*T*lamella+.045*B*inclusion)+T*grit.g*.15+B*grit.r*.11);
    float day=max(0.,dot(N,sun)),lit=max(0.,dot(F,sun));
    float facing=clamp(dot(F,V),0.,1.),grazing=1.-facing;
    vec3 H=normalize(V+sun);float coat=max(0.,dot(F,H));
    #ifdef HALITE
      float shadow=1.-.81*max(probeShadow(probe+.43*probeUp,.30),probeShadow(probe+.94*probeUp,.23));
       vec3 base=mix(vec3(.23,.29,.30),vec3(.93,.89,.79),tone*tone);
       base*=1.+detail*(.065*lamella*inclusion-.09*smoothstep(.76,.96,lamella)*smoothstep(.64,.92,inclusion));
      // A narrow opaline sheen on cleavage ledges; the surrounding salt is
      // cloudy and matte, even when the eye happens to face the sun.
      float phase=clamp(.29+grazing*.72+slope.x*.25,0.,1.);
      vec3 film=mix(vec3(.82,.43,.23),vec3(.23,.65,.73),smoothstep(.10,.53,phase));
      film=mix(film,vec3(.62,.29,.71),smoothstep(.54,.97,phase));
      vec3 c=base*(vec3(.15,.17,.21)+shadow*vec3(1.,.95,.84)*(.32*day+.68*lit));
       c=mix(c,film*(.28+.78*lit*shadow),clamp(mask*(.49+.36*grazing)+.12*grit.b,0.,1.));
      c+=shadow*smoothstep(.0,.18,day)*vec3(.72,.80,.75)*pow(coat,34.)*(.07+.34*mask);
    #else
      float shadow=1.-.85*max(probeShadow(probe+.44*probeUp,.37),probeShadow(probe+.93*probeUp,.23));
       vec3 base=mix(vec3(.019,.023,.038),vec3(.19,.24,.29),tone*tone);
       base+=detail*vec3(.010,.012,.016)*smoothstep(.78,.97,inclusion+.23*lamella);
      base=mix(base,vec3(.38,.118,.056),mask*.74);
      // A cold sky reflection holds the contour of the dark glass in shade.
      // The broad lobe rolls across fracture scallops rather than sparkling.
      float rim=grazing*grazing;vec3 c=base*(vec3(.24,.28,.36)+shadow*vec3(1.,.94,.87)*lit);
      c+=vec3(.033,.081,.112)*rim*(.44+.56*tone)*(1.-mask*.58);
      c+=shadow*smoothstep(.0,.18,day)*vec3(.51,.61,.69)*pow(coat,27.)*(.15+.39*tone);
    #endif
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

// Survey hardware is tens of metres from the stage's normal directional
// light target. Use the same world-space daylight as the shell and its cast
// shadow, including on the night-side (camera light would break both cues).
export const instrumentVertex=`
  varying vec3 paint,n,eye;
  void main(){
    vec4 p=modelMatrix*vec4(position,1.);paint=color;eye=cameraPosition-p.xyz;
    n=mat3(modelMatrix)*normal;gl_Position=projectionMatrix*viewMatrix*p;
  }`;
export const instrumentFragment=`
  uniform vec3 sun;varying vec3 paint,n,eye;
  void main(){
    vec3 N=normalize(n),V=normalize(eye);float day=max(0.,dot(N,sun));
    float gloss=pow(max(0.,dot(N,normalize(V+sun))),29.);
    vec3 c=paint*(vec3(.20,.23,.28)+vec3(1.,.95,.86)*day);
    c+=gloss*day*(vec3(.07)+paint*.28);
    gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
