import {A,Skin,type V} from '../../wedding/architectureMesh';
import {alley,apron,bridge,bridgeY,gateX,laneZ,quay,railPosts,railSpans,type StreetRect} from './plan';

// All land tops meet at the exact authored height; the open joints expose
// bedding below, never water or sky. The bridge is an arch, not a solid dam.
function setts(g:Skin,r:StreetRect,base:number,palette:readonly string[]){
  const l=r.x-r.w/2,n=r.z-r.d/2,rows=Math.ceil(r.d/.48);
  g.block(r.x,(base-.048)/2,r.z,r.w,-.048-base,r.d,A.brick,'#e2d8c2',1.3,1.1);
  for(let j=0;j<rows;j++){
    const d=r.d/rows,z=n+(j+.5)*d;
    let x=l;
    for(let i=0;x<l+r.w-.002;i++){
      const step=(i===0&&j%2?.56:1.07+.25*Math.sin(i*.96+j*1.73));
      const end=Math.min(l+r.w,x+step),cx=(x+end)/2;
      const dark=Math.min(1,Math.abs(cx-gateX)/1.25);
      const tint=dark<.65?'#acaa9e':palette[(i+3*j)%palette.length];
      g.block(cx,-.0236,z,end-x-.007,.0472,d-.007,A.granite,tint);x=end;
    }
  }
}

function stoneArch(g:Skin){
  const z0=laneZ-bridge.half,z1=laneZ+bridge.half,mid=(bridge.west+bridge.east)/2;
  // Segmental ring carved as 17 wedge stones, through the full thickness.
  // Radial bed joints continue round the intrados seen obliquely from the quay.
  const n=17,halfSpan=3.12,spring=-.88,rise=1.02;
  function arch(a:number,outer:boolean,z:number):V{
    return [mid+(halfSpan+(outer?.19:0))*Math.cos(a),spring+(rise+(outer?.16:0))*Math.sin(a),z];
  }
  for(let j=0;j<n;j++){
    const a=j/n*Math.PI,b=(j+1)/n*Math.PI,stone=['#dad0b9','#e4dec9','#cbc1ac'][j%3];
    for(const z of [z0,z1]){
      const face=[arch(a,true,z),arch(b,true,z),arch(b,false,z),arch(a,false,z)] as [V,V,V,V];
      if(z===z0)face.reverse();g.face(face,A.granite,stone);
      const c=arch(a,true,z),d=arch(b,true,z),top=(q:V):V=>[q[0],bridgeY(q[0])-.039,z];
      const wall=[d,c,top(c),top(d)] as [V,V,V,V];if(z===z0)wall.reverse();g.face(wall,A.brick,'#d3d0bf');
    }
    g.face([arch(a,false,z0),arch(b,false,z0),arch(b,false,z1),arch(a,false,z1)],A.granite,'#999e93');
  }
  for(const [l,r] of [[bridge.west,mid-halfSpan],[mid+halfSpan,bridge.east]]){
    for(const z of [z0,z1]){
      const q:[V,V,V,V]=[[l,-.93,z],[r,-.93,z],[r,bridgeY(r)-.049,z],[l,bridgeY(l)-.049,z]];
      if(z===z0)q.reverse();g.face(q,A.brick,'#c5c7b8');
    }
  }
  // Slightly raised crown provides 4.0 x 3.48m of level portrait floor.
  // Split on slope changes even if a paving joint falls close to an abutment.
  for(const [l,r] of [[bridge.west,bridge.crownWest],[bridge.crownWest,bridge.crownEast],[bridge.crownEast,bridge.east]]){
    const nx=Math.round((r-l)/.54),nz=4;
    for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
      const a=l+(r-l)*i/nx,b=l+(r-l)*(i+1)/nx,n=z0+(z1-z0)*j/nz,s=z0+(z1-z0)*(j+1)/nz;
      const joint=a+.007,A0:V=[joint,bridgeY(joint),s],B0:V=[b,bridgeY(b),s],C0:V=[b,bridgeY(b),n],D0:V=[joint,bridgeY(joint),n];
      const wash=['#e9dfc5','#ddd7c7','#f0e8d3','#dad4bf'][(i+3*j)%4];
      g.face([A0,B0,C0,D0],A.granite,wash);
      g.face([[a,bridgeY(a),s],A0,D0,[a,bridgeY(a),n]],A.plain,'#817e72');
      if(j===0||j===nz-1){const z=j===0?n:s;
        const q:[V,V,V,V]=[[a,bridgeY(a)-.066,z],[b,bridgeY(b)-.066,z],[b,bridgeY(b),z],[a,bridgeY(a),z]];
        if(j===0)q.reverse();g.face(q,A.granite,wash);
      }
    }
  }
}

export function buildStreetGround(g:Skin){
  setts(g,alley,-.68,['#d9cdb7','#d5cfbd','#e1d5be','#d8cbb9']);
  setts(g,quay,-1.18,['#d5c7ae','#ded5c1','#ddd0ba','#cec8b9']);
  setts(g,apron,-.39,['#d6cbb2','#cfc7b5','#deceb6']);
  stoneArch(g);
  for(const {a,b,z} of railSpans){
    for(const [y,w,h,c] of [[.725,.13,.10,'#e5dcc7'],[.255,.093,.11,'#d3cbb9']] as const)
      g.beam([a,bridgeY(a)+y,z],[b,bridgeY(b)+y,z],w,h,A.granite,c);
  }
  for(const p of railPosts){
    const {x,z,bottom:y}=p;
    g.block(x,y+.057,z,.205,.114,.205,A.granite,'#d4cdbc');
    g.block(x,y+.456,z,.158,.72,.158,A.granite,'#ded6c4');
    g.lathe(x,z,[[y+.78,.10],[y+.804,.12],[y+.832,.12],[y+.854,.086],[y+.89,.047],[y+.893,0]],A.granite,'#eee3ca',8);
  }
}
