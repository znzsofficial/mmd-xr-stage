import {BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3} from 'three';
import type {Part} from '../SceneryBatch';
import {span} from '../detailParts';
import atlas from './closeAtlas.json';
import {MOORING_POSTS, MUSIC} from './songhouseLayout';

type V=Part['p'];
type Tile=keyof typeof atlas;
const tau=2*Math.PI, lerp=(a:number,b:number,t:number)=>a+(b-a)*t;

// Indexed, smooth strips. 'v' starts at the top of the painting; inset UVs
// target texel centres inside the duplicated gutters, even at grazing angles.
class DetailSkin {
  positions:number[]=[]; uvs:number[]=[]; indices:number[]=[];
  vertex(tile:Tile,p:V,u:number,v:number){
    const [x,y,w,h]=atlas[tile],i=this.positions.length/3;
    this.positions.push(...p);this.uvs.push((x+.5+u*(w-1))/1024,1-(y+.5+v*(h-1))/1024);return i;
  }
  quad(a:number,b:number,c:number,d:number){this.indices.push(a,b,c,a,c,d);}
  face(tile:Tile,a:V,b:V,c:V,d:V,flip=false){
    const l=flip?1:0,r=1-l;
    this.quad(this.vertex(tile,a,l,0),this.vertex(tile,b,r,0),this.vertex(tile,c,r,1),this.vertex(tile,d,l,1));
  }
  finish(){
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.positions,3));g.setAttribute('uv',new Float32BufferAttribute(this.uvs,2));g.setIndex(this.indices);g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
}

const widths=[[-.720,.064],[-.714,.088],[-.688,.105],[-.590,.110],[-.535,.101],[-.508,.089],[-.456,.088],[-.420,.096],[-.397,.114],[-.315,.120],[.282,.150],[.367,.149],[.421,.136],[.454,.139],[.507,.155],[.593,.157],[.669,.151],[.699,.140],[.720,.128]];
function soundboard(g:DetailSkin,boxes:Part[]){
  const at=(x:number,y:number,z:number):V=>[MUSIC.x+x,y,MUSIC.z+z];
  const width=(x:number)=>{const j=widths.findIndex(([a])=>a>=x);if(j<=0)return widths[j<0?widths.length-1:0][1];const [l,w]=widths[j-1],[r,v]=widths[j];return lerp(w,v,(x-l)/(r-l));};
  // Broad crown with eased shoulders, a narrow amber lacquer lip and a
  // receding lower belly. The feet sit on the table; the body doesn't float.
  const crown=(x:number,z:number)=>1.396+.005*(x+.72)/1.44-.032*(Math.abs(z)/width(x))**2;
  const cross=[-1,-.97,-.86,-.65,-.40,0,.40,.65,.86,.97,1];
  function strip(row:(x:number,w:number)=>number[]){let prev:number[]|null=null;
    for(const [x,w] of widths){const verts=row(x,w);if(prev)for(let j=1;j<verts.length;j++)g.quad(prev[j-1],verts[j-1],verts[j],prev[j]);prev=verts;}}
  strip((x,w)=>cross.map(f=>g.vertex('lacquer',at(x,crown(x,-f*w),-f*w),(x+.72)/1.44,(f+1)/2)));
  for(const side of [-1,1]){
    strip((x,w)=>[[.956,1.313],[1,1.326],[1.005,1.352],[1, crown(x,w)]].map(([k,y],j)=>g.vertex('lacquer',at(x,y,w*k*side),(x+.72)/1.44,.91-j*.025)));
  }
  for(const [x,w] of [widths[0],widths[widths.length-1]])for(let j=0;j<cross.length-1;j++){
    const l=w*cross[j],r=w*cross[j+1];g.face('lacquer',at(x,crown(x,l),l),at(x,crown(x,r),r),at(x,1.313,r*.956),at(x,1.313,l*.956));
  }
  g.face('lacquer',at(-.72,1.313,-.061),at(.72,1.313,-.122),at(.72,1.313,.122),at(-.72,1.313,.061));
  const block=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>boxes.push({p:at(x,y,z),s:[w,h,d],color});
  for(const x of [-.46,.46])block(x,1.299,0,.079,.028,.164,'#51403a');
  // Rounded hardwood bridges follow the crown of the body. Each silk string
  // crosses BOTH contact edges and bends over into the termination at each end.
  function bridge(x:number,w:number,halfDepth:number,lift:number){
    const zs=[-w,-.72*w,0,.72*w,w];
    for(let i=1;i<zs.length;i++){
      const l=zs[i-1],r=zs[i],p=(dx:number,z:number,h:number)=>at(x+dx,crown(x,z)+h,z);
      const profile=[[-1,-.002],[-.73,lift-.004],[-.38,lift],[.42,lift],[.78,lift-.004],[1,-.002]];
      for(let j=1;j<profile.length;j++){const [a,h]=profile[j-1],[b,k]=profile[j];g.face('endgrain',p(a*halfDepth,l,h),p(a*halfDepth,r,h),p(b*halfDepth,r,k),p(b*halfDepth,l,k));}
      if(i===1||i===zs.length-1){const z=i===1?l:r;g.face('endgrain',p(-halfDepth,z,-.002),p(halfDepth,z,-.002),p(.5*halfDepth,z,lift),p(-.5*halfDepth,z,lift));}
    }
  }
  bridge(-.646,.094,.012,.012);bridge(.599,.143,.020,.020);
  for(let i=0;i<7;i++){
    const u=i/6,z0=lerp(-.066,.050,u),z1=lerp(-.108,.078,u),y0=crown(-.646,z0)+.0135,y1=crown(.599,z1)+.0216;
    const a=at(-.646,y0,z0),b=at(.599,y1,z1),thickness=lerp(.0022,.0032,u),tint=i%2?'#cfb99b':'#dac8aa';
    boxes.push(span(at(-.719,1.338,z0*.95),a,thickness,tint),span(a,b,thickness,tint),span(b,at(.628,crown(.628,z1)-.001,z1),thickness,tint));
  }
  // The mitred edge has a top lip, cove and lower bead. All rings stay
  // inside the original collidable top; this isn't a decal on a rectangular slab.
  const corners=[[-1,-1],[-1,1],[1,1],[1,-1]],edgeProfile=[[1.286,.008],[1.280,0],[1.258,0],[1.251,.007],[1.241,.008],[1.235,.015],[1.221,.018],[1.212,.012],[1.20,.014],[1.194,.021]];
  const rim=(j:number,ring:number):V=>{const [a,b]=corners[j%4],[y,inset]=edgeProfile[ring];return at(a*(MUSIC.w/2-inset),y,b*(MUSIC.d/2-inset));};
  g.face('table',rim(0,0),rim(3,0),rim(2,0),rim(1,0));
  for(let i=1;i<edgeProfile.length;i++)for(let j=0;j<4;j++){
    const v0=(1.286-edgeProfile[i-1][0])/.092,v1=(1.286-edgeProfile[i][0])/.092;
    g.quad(g.vertex('tableEdge',rim(j,i-1),0,v0),g.vertex('tableEdge',rim(j+1,i-1),1,v0),g.vertex('tableEdge',rim(j+1,i),1,v1),g.vertex('tableEdge',rim(j,i),0,v1));
  }
  const last=edgeProfile.length-1;g.face('table',rim(0,last),rim(1,last),rim(2,last),rim(3,last));
  for(const s of [-1,1]){
    block(0,1.167,s*.247,1.79,.068,.038,'#6f4637');block(0,1.139,s*.249,1.77,.009,.041,'#9e7757');
    for(const e of [-1,1])boxes.push(span(at(e*.75,1.147,s*.247),at(e*.89,1.045,s*.247),.033,'#795241',.035));
  }
  // A thread-bound study leaf, with actual paper edges and thread stitches.
  const slip=(u:number,y:number,v:number):V=>at(-.584+u*.996+v*.085,y,.221+v*.996-u*.085);
  for(const [y,w,d,t,col] of [[1.294,.375,.144,.016,'#586e60'],[1.309,.367,.138,.014,'#b9a483'],[1.319,.367,.138,.005,'#dfc9a6']] as const)boxes.push({p:slip(0,y,0),s:[w,t,d],ry:.085,color:col});
  const card=(tile:Tile,w:number,d:number,y:number)=>g.face(tile,slip(-w,y,-d),slip(w,y,-d),slip(w,y,d),slip(-w,y,d));
  card('binding',.186,.070,1.303);card('score',.177,.066,1.322);
  for(const z of [-.041,0,.041])boxes.push(span(slip(-.184,1.303,z),slip(-.173,1.323,z),.0022,'#d9bf96'));
}

function stoneQuay(g:DetailSkin){
  // Eased upper arris, dressed coping, larger battered face underneath. Paint
  // follows the tide horizontally; don't stretch it across the whole bank.
  for(let i=0;i<13;i++){
    const x=-8.2+i*1.25,l=x-.608,r=x+.608,tile=(`stone${(i+Math.floor(i/3))%3}`) as Tile,flip=i%3===1;
    const z=10.942+(i%3-1)*.007,top=-.089;
    g.face(tile,[l,top,z],[r,top,z],[r-.011,-.745,z-.018],[l+.009,-.745,z-.018],flip);
    for(const a of [l,r])g.face(tile,[a,top,10.775],[a,top,z],[a,-.745,z-.020],[a,-.745,10.775]);
    const left=l-.005,right=r+.005,front=10.978,back=10.659;
    const profile=[[back,-.004],[front-.013,-.004],[front,-.017],[front,-.074],[front-.013,-.092],[back,-.092]];
    for(let j=1;j<profile.length;j++){const [za,ya]=profile[j-1],[zb,yb]=profile[j];g.face('coping',[left,ya,za],[right,ya,za],[right,yb,zb],[left,yb,zb],flip);}
    for(const a of [left,right])g.face('coping',[a,-.005,back],[a,-.014,front],[a,-.085,front],[a,-.092,back]);
  }
}

// A single tubular surface for the tail, hitch, turns and loaded line. Arc
// length controls the twist pitch. Split UVs exactly at a tile repeat, not at
// each bend in the spline. No three individual strand tubes or per-frame work.
function rope(g:DetailSkin,points:Vector3[],radius:number){
  const curve=new CatmullRomCurve3(points),len=curve.getLength(),cycles=Math.max(1,Math.round(len/.145)),sides=8;
  let axis=new Vector3(0,1,0);
  for(let j=0;j<cycles;j++){
    // A taut span needs one ring per repeat; turns against the pile need
    // several. Testing both half-repeats also catches an inflected section.
    const mid=curve.getTangentAt((j+.5)/cycles),bend=mid.angleTo(curve.getTangentAt(j/cycles))+mid.angleTo(curve.getTangentAt((j+1)/cycles));
    const bands=Math.max(1,Math.min(7,Math.ceil(bend/.31)));let prev:number[]=[];
    for(let k=0;k<=bands;k++){
      const t=(j+k/bands)/cycles,c=curve.getPointAt(t),tan=curve.getTangentAt(t),row:number[]=[];
      // Project the preceding normal into the next section's tangent plane.
      axis.addScaledVector(tan,-axis.dot(tan)).normalize();const other=new Vector3().crossVectors(tan,axis);
      for(let a=0;a<=sides;a++){
        const angle=tau*a/sides,p=c.clone().addScaledVector(axis,radius*Math.cos(angle)).addScaledVector(other,radius*Math.sin(angle));
        row.push(g.vertex('rope',p.toArray(),k/bands,a/sides));
      }
      if(k)for(let a=1;a<=sides;a++)g.quad(prev[a-1],prev[a],row[a],row[a-1]);prev=row;
    }
  }
}

function moor(g:DetailSkin,boxes:Part[]){
  for(const p of MOORING_POSTS){
    const around=(a:number,r:number,y:number):V=>[p.x+r*Math.cos(a),y,p.z+r*Math.sin(a)];
    const rings=[[-.845,.088],[.022,.094],[.551,.094],[.621,.091],[.640,.083]],n=18;
    let prev:number[]=[];
    for(const [y,r] of rings){const row:number[]=[];
      for(let i=0;i<=n;i++){const a=i/n*tau;row.push(g.vertex('post',around(a,r,y),i/n,(.64-y)/1.485));}
      if(prev.length)for(let i=1;i<=n;i++)g.quad(prev[i-1],row[i-1],row[i],prev[i]);prev=row;
    }
    const center=g.vertex('endgrain',[p.x,.640,p.z],.5,.5);
    const cap=Array.from({length:n},(_,i)=>{const a=i/n*tau;return g.vertex('endgrain',around(a,.083,.64),.5+.5*Math.cos(a),.5+.5*Math.sin(a));});
    for(let i=0;i<n;i++)g.indices.push(center,cap[(i+1)%n],cap[i]);
    if(!p.tied)continue;
    const aft=p.z>14,exit=tau*.25,turns=2.85,start=exit-tau*turns;
    const path=[new Vector3(...around(start-1.28,.109,.173)),new Vector3(...around(start-1.24,.113,.247)),new Vector3(...around(start-1.05,.126,.345)),new Vector3(...around(start-.73,.126,.404)),new Vector3(...around(start-.39,.111,.439))];
    for(let i=0;i<=49;i++){
      const t=i/49,a=start+t*tau*turns;path.push(new Vector3(...around(a,.106,.445-.093*t)));
    }
    const eye=new Vector3(aft?.97:1.29,aft?-.045:.015,aft?13.64:12.91);
    const tip=path[path.length-1];path.push(new Vector3(tip.x-.16,.349,tip.z+(aft?-.03:.013)),new Vector3(lerp(tip.x,eye.x,.5),.051,lerp(tip.z,eye.z,.5)),eye);
    rope(g,path,.0152);
    // Lashing disappears over a short wooden peg on the pointed foredeck.
    boxes.push({p:[eye.x,eye.y-.073,eye.z],s:[.071,.17,.073],color:'#81593d'},{p:[eye.x,eye.y+.016,eye.z],s:[.100,.027,.096],color:'#926d47'});
  }
}

export function makeSonghouseClose(boxes:Part[]){const g=new DetailSkin();soundboard(g,boxes);stoneQuay(g);moor(g,boxes);return g.finish();}
