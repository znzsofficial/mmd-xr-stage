import {RGBAFormat,Vector2,Vector3,type BufferGeometry,type Material,type Texture,type Triangle} from 'three';

const bary=new Vector3(),uv=new Vector2();
type Tile={key:number;w:number;data:Uint8ClampedArray};
const caches=new WeakMap<Texture,{image:unknown;tiles:Tile[]}>();
let canvas:CanvasRenderingContext2D|null|undefined;

/** Read a small native-resolution tile on demand, never copy a full 4K map
 * on first touch. Cache by texture/image identity. Unreadable cutouts fail
 * closed rather than treating the transparent parts of a card as skin. */
function alpha(tex:Texture,u:number,v:number){
  const image=tex.image as (CanvasImageSource&{width:number;height:number;data?:Uint8Array|Uint8ClampedArray})|undefined;
  if(!image?.width||!image.height)return null;
  if(tex.matrixAutoUpdate)tex.updateMatrix();tex.transformUv(uv.set(u,v));
  const x=Math.min(image.width-1,Math.max(0,Math.floor(uv.x*image.width))), y=Math.min(image.height-1,Math.max(0,Math.floor(uv.y*image.height)));
  if(image.data){return tex.format===RGBAFormat&&(image.data instanceof Uint8Array||image.data instanceof Uint8ClampedArray)?image.data[(y*image.width+x)*4+3]/255:null;}
  if(typeof document==='undefined')return null;
  let cache=caches.get(tex);if(!cache||cache.image!==image){cache={image,tiles:[]};caches.set(tex,cache);}
  const sx=x&~31,sy=y&~31,key=sy*image.width+sx;
  let tile=cache.tiles.find(t=>t.key===key);
  if(!tile){
    if(canvas===undefined){const c=document.createElement('canvas');c.width=c.height=32;canvas=c.getContext('2d',{willReadFrequently:true});}
    if(!canvas)return null;
    const w=Math.min(32,image.width-sx),h=Math.min(32,image.height-sy);
    try{canvas.clearRect(0,0,32,32);canvas.drawImage(image,sx,sy,w,h,0,0,w,h);tile={key,w,data:canvas.getImageData(0,0,w,h).data};}
    catch{return null;}
    if(cache.tiles.length===8)cache.tiles.shift();cache.tiles.push(tile);
  }return tile.data[((y-sy)*tile.w+x-sx)*4+3]/255;
}

export function visibleTexel(material:Material,geometry:BufferGeometry,face:number,tri:Triangle,p:Vector3,attr=geometry.attributes.uv,unknownBlocks=false){
  const tex=(material as Material&{map?:Texture}).map??material.userData.mmdTslSourceDiffuseTexture;
  if(!tex||(!material.transparent&&!material.alphaTest))return true;
  const index=geometry.index;if(!attr||!tri.getBarycoord(p,bary))return unknownBlocks;
  const a=index?.getX(face)??face,b=index?.getX(face+1)??face+1,c=index?.getX(face+2)??face+2;
  const texel=alpha(tex,bary.x*attr.getX(a)+bary.y*attr.getX(b)+bary.z*attr.getX(c),bary.x*attr.getY(a)+bary.y*attr.getY(b)+bary.z*attr.getY(c));
  if(texel===null)return unknownBlocks;
  const opacity=material.opacity*texel;
  return opacity>0 && opacity>=material.alphaTest;
}
