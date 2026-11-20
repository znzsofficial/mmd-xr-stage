import {BufferGeometry,Color,Float32BufferAttribute,Vector3} from 'three';

export type V=[number,number,number];
export type Ring=[number,number,number,number]; // y, half width, half depth, centre z
type Joint=[V,number,number];
export type Sample=(u:number,v:number)=>V;
export type Finish='paint'|'fabric'|'face'|'hair'|'badge';
// Pixel rectangles in bakeNurse.py, with a margin for filtered sampling.
const finishes:Record<Finish,{rect:[number,number,number,number];rough:number}>={
  paint:{rect:[850,330,10,10],rough:.68},fabric:{rect:[771,3,250,250],rough:.91},
  face:{rect:[1,1,510,510],rough:.71},hair:{rect:[514,2,252,252],rough:.50},badge:{rect:[521,273,245,147],rough:.44},
};
export const tau=Math.PI*2;
export const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const clamp=(t:number)=>Math.min(1,Math.max(0,t));
export function section(rows:Ring[],y:number){
  let i=0;
  while(i<rows.length-2&&y>rows[i+1][0])i++;
  const a=rows[i],b=rows[i+1],t=clamp((y-a[0])/(b[0]-a[0]));
  return [mix(a[1],b[1],t),mix(a[2],b[2],t),mix(a[3],b[3],t)];
}

/** Build one static, indexed draw. Normals come from neighbouring samples of
 * the actual surface, including across UV seams, not from texture luminance. */
export function nurseSurface(){
  const pos:number[]=[],colors:number[]=[],norm:number[]=[],uv:number[]=[],rough:number[]=[],indices:number[]=[];
  const tu=new Vector3(),tv=new Vector3(),point=new Vector3(),other=new Vector3();
  function patch(nx:number,ny:number,at:Sample,finish:Finish,color:string,wrap=true){
    const start=pos.length/3,c=new Color(color),{rect:[x,y,w,h],rough:r}=finishes[finish];
    const stride=nx+1;
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const u=i/nx,v=j/ny;pos.push(...at(u,v));colors.push(c.r,c.g,c.b);rough.push(r);
      uv.push((x+w*u)/1024,1-(y+h*(1-v))/512);
      if(i&&j){const b=start+j*stride+i,a=b-stride-1;indices.push(a,a+1,b,a,b,b-1);}
    }
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const row=start+j*stride;
      point.fromArray(pos,(row+(i===nx?(wrap?1:nx):i+1))*3);
      other.fromArray(pos,(row+(i===0?(wrap?nx-1:0):i-1))*3);tu.subVectors(point,other);
      point.fromArray(pos,(start+Math.min(j+1,ny)*stride+i)*3);
      other.fromArray(pos,(start+Math.max(j-1,0)*stride+i)*3);tv.subVectors(point,other);
      tu.cross(tv).normalize();norm.push(tu.x,tu.y,tu.z);
    }
  }
  function bulb(p:V,r:V,col:string,finish:Finish='paint',segments=16){
    patch(segments,8,(u,v)=>{const a=tau*(u-.5),b=(v-.5)*3.14;return [p[0]+r[0]*Math.sin(a)*Math.cos(b),p[1]+r[1]*Math.sin(b),p[2]+r[2]*Math.cos(a)*Math.cos(b)]},finish,col);
  }
  function tube(js:Joint[],col:string,finish:Finish='paint',sides=14){
    // Loft one ring per joint. Extra interpolated rings along straight limbs
    // cost triangles without changing their silhouette.
    const knots=js.map(([p])=>new Vector3(...p));
    const dirs=knots.map((_,i)=>knots[Math.min(i+1,knots.length-1)].clone().sub(knots[Math.max(0,i-1)]).normalize());
    const ref=Math.abs(dirs[0].x)>.85?new Vector3(0,0,1):new Vector3(1,0,0);
    const axes=dirs.map(d=>{const a=ref.clone().addScaledVector(d,-ref.dot(d)).normalize();return [a,a.clone().cross(d)];});
    patch(sides,js.length-1,(u,v)=>{
      const i=Math.round(v*(js.length-1)),[a,b]=axes[i];
      return point.copy(knots[i]).addScaledVector(a,js[i][1]*Math.sin(tau*u)).addScaledVector(b,js[i][2]*Math.cos(tau*u)).toArray();
    },finish,col);
  }
  function cord(points:V[],r:number,col:string){tube(points.map((p,i)=>[p,r*(i===0||i===points.length-1?.5:1),r]),col,'paint',7);}
  function build(){
    const g=new BufferGeometry();
    for(const [name,data,size] of [['position',pos,3],['normal',norm,3],['color',colors,3],['uv',uv,2],['finishRoughness',rough,1]] as const){
      g.setAttribute(name,new Float32BufferAttribute(data,size));
    }
    g.setIndex(indices);g.computeBoundingSphere();return g;
  }
  return {patch,bulb,tube,cord,build};
}
