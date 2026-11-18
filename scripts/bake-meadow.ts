// In the Vite dev page console: (await import('/scripts/bake-meadow.ts')).download()
// The result goes in src/mmdVrShowcase/scenery/meadow-ground.webp. Re-bake when
// the path, clearing size, trees or sun change. Never paint this atlas in XR.
import { LAWN_SIZE, LAWN_TREES, MEADOW_SUN, meadowPathX } from '../src/mmdVrShowcase/scenery/placementAreas';
import { seededRandom } from '../src/mmdVrShowcase/scenery/ClassroomLayout';

export function paintGround() {
  const n=1024, px=(x:number)=>(x/LAWN_SIZE+.5)*n;
  const canvas=document.createElement('canvas');canvas.width=n;canvas.height=n;const g=canvas.getContext('2d')!;
  const rng=seededRandom(27101);g.fillStyle='#98ae6c';g.fillRect(0,0,n,n);
  for(let i=0;i<850;i++) {
    const x=rng()*n,z=rng()*n,r=(rng()*45+16);const tint=i%2?'123,149,82':'213,202,130';
    const grd=g.createRadialGradient(x,z,0,x,z,r);grd.addColorStop(0,`rgba(${tint},.38)`);grd.addColorStop(1,`rgba(${tint},0)`);g.fillStyle=grd;g.fillRect(x-r,z-r,2*r,2*r);
  }
  const trace=()=>{g.beginPath();for(let i=0;i<=200;i++){const z=(i/200-.5)*LAWN_SIZE,x=px(meadowPathX(z));if(i)g.lineTo(x,px(z));else g.moveTo(x,px(z));}};
  for(const [width,color] of [[1.34,'#a1a16a'],[1.19,'#c1b585'],[.94,'#cfc398']] as const){trace();g.strokeStyle=color;g.lineWidth=n*width/LAWN_SIZE;g.stroke();}
  for(let i=0;i<19500;i++) {const x=rng()*n,y=rng()*n;g.fillStyle=i%2?'#eef0b333':'#506e452b';g.fillRect(x,y,rng()*2.2+.6,rng()*1.7+.5);}
  for(const tree of LAWN_TREES){const x=px(tree.x-MEADOW_SUN[0]/MEADOW_SUN[1]*tree.h*.70),y=px(tree.z-MEADOW_SUN[2]/MEADOW_SUN[1]*tree.h*.70);
    for(let k=0;k<18;k++){const cx=x+(rng()-.5)*tree.h*8,cy=y+(rng()-.5)*tree.h*6,r=tree.h*(3+rng()*1.8);const shadow=g.createRadialGradient(cx,cy,0,cx,cy,r);shadow.addColorStop(0,'rgba(49,78,59,.12)');shadow.addColorStop(1,'rgba(49,78,59,0)');g.fillStyle=shadow;g.fillRect(cx-r,cy-r,r*2,r*2);}}
  return canvas;
}
export function download(){const a=document.createElement('a');a.download='meadow-ground.webp';a.href=paintGround().toDataURL('image/webp',.92);a.click();}
