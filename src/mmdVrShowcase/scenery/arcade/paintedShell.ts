import {BufferGeometry,Color,Float32BufferAttribute} from 'three';
import {blocks,board,cabinets,ROOF,UPPER,skylight,lowerFrontZ,upperFrontZ,cladding} from './arcadeLayout';
import layout from './printRects.json';
import {diffusers,displays,gallerySign,lastRiser} from './westGallery';

type V=[number,number,number];type Face={o:V;u:V;v:V};type Rect=readonly number[];
// Origin at bottom left when viewed from outside. Floor UV axes are +X/-Z.
const zFace=(x:number,y:number,z:number,w:number,h:number,side=1):Face=>({o:[x-side*w/2,y-h/2,z],u:[side*w,0,0],v:[0,h,0]});
const xFace=(x:number,y:number,z:number,w:number,h:number,side=1):Face=>({o:[x,y-h/2,z+side*w/2],u:[0,0,-side*w],v:[0,h,0]});
const deck=(x:number,y:number,z:number,w:number,d:number,up=true):Face=>({o:[x-w/2,y,z+(up?1:-1)*d/2],u:[w,0,0],v:[0,0,(up?-1:1)*d]});
const point=(f:Face,u:number,v:number):V=>f.o.map((a,j)=>a+u*f.u[j]+v*f.v[j]) as V;
class Sheets{
  xyz:number[]=[];uv:number[]=[];index:number[]=[];rgb:number[]=[];color=new Color();
  quad(f:Face,rect:Rect,size:Rect,a=0,b=0,c=1,d=1,s=0,t=0,e=1,g=1){
    const [x,y,w,h]=rect,k=this.xyz.length/3;
    // inset the UVs instead of sampling the neighbouring printed cell at the seam
    for(const [u,v,i,j] of [[a,b,s,t],[c,b,e,t],[c,d,e,g],[a,d,s,g]]){
      this.xyz.push(...point(f,u,v));this.uv.push((x+2+i*(w-4))/size[0],1-(y+2+(1-j)*(h-4))/size[1]);this.rgb.push(this.color.r,this.color.g,this.color.b);
    }this.index.push(k,k+1,k+2,k,k+2,k+3);
  }
  finish(){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.xyz,3));g.setAttribute('color',new Float32BufferAttribute(this.rgb,3));g.setAttribute('uv',new Float32BufferAttribute(this.uv,2));g.setIndex(this.index);g.computeVertexNormals();g.computeBoundingSphere();return g;}
}
const size=[2048,1024];
// Intersect each face with a metre grid, keeping partial tiles at cut doors,
// the floor opening and the roof opening. No decal may bridge those holes.
function repeat(sheet:Sheets,f:Face,cell:number,stepU:number,stepV:number){
  const rect=[(cell%4)*512,Math.floor(cell/4)*512,512,512],split=(vec:V,step:number)=>{
    const l=Math.hypot(...vec),start=vec.reduce((s,v,i)=>s+v*f.o[i],0)/l,coords=[];
    for(let i=Math.floor(start/step+1e-8);i<Math.ceil((start+l)/step-1e-8);i++){
      const a=Math.max(start,i*step),b=Math.min(start+l,(i+1)*step);coords.push([(a-start)/l,(b-start)/l,a/step-i,b/step-i]);
    }return coords;
  };
  const cols=split(f.u,stepU),rows=split(f.v,stepV);
  for(const [a,c,s,e] of cols)for(const [b,d,t,g] of rows)sheet.quad(f,rect,size,a,b,c,d,s,t,e,g);
}

export function arcadePaint(){
  const room=new Sheets(),posters=new Sheets(),screens=new Sheets(),leaves=new Sheets();
  type Art=keyof typeof layout.rects;const art=(key:Art,f:Face,glow=false)=>(glow?screens:posters).quad(f,layout.rects[key],layout.size);
  const foliage=(f:Face,rect:Rect,flip:boolean)=>leaves.quad(f,rect,[1536,768],0,0,1,1,flip?1:0,0,flip?0:1,1);
  const ivy=(f:Face,flip:boolean)=>foliage(f,[0,0,512,512],flip);
  const tile=(f:Face,i:number,x:number,y:number,tint='#ffffff')=>{room.color.set(tint);repeat(room,f,i,x,y);};
  for(const b of blocks){const {x,y,z,w,h,d,tag}=b,top=y+h/2,bot=y-h/2;
    if(b.deck){tile(deck(x,top+.002,z,w,d),tag==='hall-tile'||tag==='upper-slab'?0:6,2.08,2.08);}
    if(tag==='roof'||tag==='upper-slab'||tag==='balcony')tile(deck(x,bot-.002,z,w,d,false),1,2.65,2.65);
    if(tag==='wall'||tag==='header'){
      const alongX=Math.abs(z)===upperFrontZ||z===lowerFrontZ,side=alongX?Math.sign(z):Math.sign(x);
      const layer=(s:number,dist:number,skip=0)=>alongX?zFace(x,y+skip/2,z+s*dist,w,h-skip,s):xFace(x+s*dist,y+skip/2,z,d,h-skip,s);
      tile(layer(-side,.132,tag==='wall'?.54:0),2,2.23,2.23);if(y>UPPER)tile(layer(side,cladding),3,1.65,3.3);else tile(layer(side,cladding),2,4.2,4.2,'#80bcb3');
    }
    if(tag==='east-service'||tag==='east-service-cap'||tag.startsWith('front-court'))tile(zFace(x,y,z+(tag.startsWith('front')?-1:1)*(d/2+.003),w,h,tag.startsWith('front')?-1:1),tag.startsWith('front')?4:3,2.85,2.80);
    if(tag==='east-retaining')tile(xFace(x+w/2+.003,y,z,d,h),3,1.65,3.30);
    if(tag==='west-shelter-back')tile(xFace(x-w/2-.004,y,z,d,h,-1),2,2.23,2.23);
    if(tag==='west-glass')tile(zFace(x,y,z-d/2-.004,w,h,-1),7,2.7,2.4);
    if(tag==='west-spine')for(const s of [-1,1])tile(xFace(x+s*(w/2+.003),y,z,d,h,s),2,2.38,2.17,s===-1?'#6d9e9b':'#66839a');
    if(tag==='west-end-wall')tile(zFace(x,y,z+d/2+.004,w,h),2,2.38,2.17,'#82a49e');
    if(tag==='west-side'||tag==='west-walk'||tag==='west-shelter-roof')tile(deck(x,bot-.003,z,w,d,false),2,1.70,1.72,'#afb5b0');
    if(tag==='west-step'){
      tile(zFace(x,top-.085,z-d/2-.003,w,.17,-1),2,2.48,1.70,'#8698a5');
      for(const side of [-1,1])tile(xFace(x+side*(w/2+.002),y,z,d,h,side),2,2.6,2.2,'#9ab0b4');
    }
    if(tag==='west-bench')tile(deck(x,top+.006,z,w,d),4,1.65,.83);
    if(tag==='upper-shutter'||tag==='back-shutter')tile(zFace(x,y,z+d/2+.006,w,h),5,2.6,1.13);
  }
  tile(zFace(0,UPPER/2,board.z-.135,board.w-.11,UPPER-.08,-1),4,3.1,1.38);
  tile(zFace(0,UPPER/2,board.z+.133,board.w-.09,UPPER-.09),2,2.17,3.4);
  art('blueboard',zFace(0,UPPER+.595,board.z+.142,board.w-.15,1.04));
  art('wood',zFace(0,UPPER+.60,board.z-.138,board.w-.13,1.14,-1));
  const sign=gallerySign;
  for(const side of [-1,1])art('graffiti',zFace(sign.x,sign.y,sign.z+side*(sign.d/2+.004),sign.w-.09,sign.h-.09,side));
  art('lounge',xFace(-12.48,2.09,.10,3.4,.44));
  art('direction',zFace(3.93,UPPER+2.44,4.688,1.54,.45));art('game',zFace(12.62,1.54,1.548,2.14,.40,-1));
  art('game',xFace(10.971,1.50,4.0,1.65,.40,-1));
  art('vents',zFace(lastRiser.x,1.00,lastRiser.z+.072,1.07,1.12));
  art('turn',zFace(lastRiser.x,2.21,lastRiser.z+.074,1.35,.46));
  for(const {x,y,z} of diffusers)art('diffuser',deck(x,y,z,.46,1.1,false),true);
  art('stairMap',zFace(10.15,1.41,-5.474,2.08,.78));
  for(const [i,z] of displays.entries()){
    tile(xFace(13.435,1.59,z,1.46,1.40,-1),7,1.81,1.42,'#8ea1b5');
    art('service',xFace(13.360,.54,z,1.22,.34,-1));
    for(let j=0;j<3;j++){
      const cz=z-.46+j*.43;
      art((i+j)%2?'racerB':'racerA',xFace(13.210,1.20,cz,.255,.227,-1));
      art('vents',xFace(13.236,1.635,cz,.20,.19,-1));
    }
  }
  for(const [i,b] of cabinets.entries()){
    const {x,y,z,side,style}=b,fault=style==='fault',w=fault?1.13:.66,fx=x+side*.39;
    if(style==='vent'){art('vents',xFace(fx,y+.89,z,.66,1.47,side));continue;}
    art(fault?'fault':i%2?'racerB':'racerA',xFace(fx,y+(fault?1.51:1.15),z,w-.05,fault?.74:.46,side),true);
    art(fault?'badge':'marquee',xFace(fx,y+(fault?2.087:1.557),z,w,fault?.21:.16,side),!fault);
    art('coinPort',xFace(x+side*.424,y+.315,z,w*.58,.216,side));
    // Sloped control deck with controls printed on top, oriented to the player.
    const panel=xFace(fx+side*.045,y+.879,z,w,.07,side);panel.o[0]+=side*.108;panel.v[0]=-side*.099;art('deck',panel);
  }
  for(const z of [-1.79,-1.01,-.23,.55,1.33,2.11])tile(xFace(-13.414,.57,z,.65,1.21),7,2.91,1.4);
  for(const y of [0,UPPER])for(const z of [-.72,.95])tile(xFace(6.83,y+2.37,z,1.62,.74,-1),7,1.78,.96,'#9dabb3');
  for(let i=-1;i<=1;i++)art('coin',zFace(i*.45,1.92,lowerFrontZ-.203,.395,.335,-1));
  {const r=.955,cx=-13.66,cz=-1.31,y=3.80;
    const [rx,ry,rw,rh]=layout.rects.tank;for(let i=0;i<10;i++){
      const a=(i/10-.5)*1.19+.4,b=((i+1)/10-.5)*1.19+.4;
      // Follow the tank's curvature; lift only the strip past the spherical shell.
      const f={o:[cx+r*Math.cos(b),y+.09,cz+r*Math.sin(b)],u:[r*(Math.cos(a)-Math.cos(b)),0,r*(Math.sin(a)-Math.sin(b))],v:[0,.25,0]} as Face;
      posters.quad(f,[rx,ry,rw,rh],layout.size,0,0,1,1,1-(i+1)/10,0,1-i/10,1);
    }}
  for(const b of blocks.filter(b=>b.tag==='pillar')){
    const h=2.69,y=.13+h/2;for(const s of [-1,1]){
      tile(zFace(b.x,y,b.z+s*.468,b.w-.082,h,s),2,1.63,2.66,'#bec3cb');tile(xFace(b.x+s*.459,y,b.z,b.d-.082,h,s),2,1.65,2.66,'#bdc6cc');}
  }
  // Branch crowns interrupt the façade silhouette; long hanging sprays mark
  // the inner skylight. Different widths/depths break up mirrored repeats.
  for(let i=0;i<11;i++){const x=-6.77+i*1.29,len=.65+.79*(.5+.5*Math.sin(i*2.23));ivy(zFace(x,ROOF+.48-len/2,4.69+i%3*.032,1.76,len),i%2===0);}
  for(let i=0;i<7;i++){
    const z=-3.82+i*1.26,len=.8+.69*(.5+.5*Math.sin(i*1.83));ivy(xFace(-7.20,ROOF+.31-len/2,z,1.76,len,-1),i%2===0);
    ivy(xFace(-13.45,2.57-len/2,z,1.61,len),i%2!==0);
  }
  for(let i=0;i<6;i++){
    const x=skylight.left+.38+i*.9,len=.36+.64*(.5+.5*Math.cos(2.6*i));
    const f=zFace(x,ROOF-.12-len/2,skylight.back+.051+.045*(i%3),1.32,len);f.v[2]=-.11;ivy(f,i%2===0);
  }
  const canopy=[512,0,1024,768];for(const [x,y,z,w,h,angle] of [[-9.1,4.6,-7.1,7,4.8,.34],[-14.9,4.1,-5.8,5.8,4.6,.51],[-15.4,3.85,4.75,5.6,5.4,1.2],[-5.4,6.6,-5.25,5.4,3.9,.3],[6.1,6.9,-5.44,7,4.7,-.1],[15.2,3.35,-3.40,6.3,5.1,-1.2],[-5.2,3.61,13.34,6.6,4,-.4]]){
    const f=zFace(x,y,z,w,h);f.u=[w*Math.cos(angle),0,-w*Math.sin(angle)];f.o=[x-f.u[0]/2,y-h/2,z-f.u[2]/2];foliage(f,canopy,x<0);
  }
  // Beyond the greybox crop a painted city strip fills the door sightlines.
  // Alpha sky and the shared day sky meet without another opaque sky dome.
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,b=(i+1)*Math.PI/6,r=22;
    const x=r*Math.sin(a),z=r*Math.cos(a);foliage({o:[x,-3.4,z],u:[r*Math.sin(b)-x,0,r*Math.cos(b)-z],v:[0,9.2,0]},[0,512,512,256],i%2===1);
  }
  // Borrowed ground beneath the distant silhouette; not a drop surface or XR floor.
  tile(deck(0,-.96,0,49,49),6,6,6,'#94aa92');
  return {room:room.finish(),posters:posters.finish(),screens:screens.finish(),leaves:leaves.finish()};
}
