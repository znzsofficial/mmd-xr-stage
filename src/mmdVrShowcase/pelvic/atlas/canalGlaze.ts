import {clamp,stride,type Mesh} from './model';

type P=[number,number];
/** Sparse reflected edges and pressed lines in the *material coordinates* of
 * the mucosa. The depth-tested tissue carries them through each impression.
 * Leave dark intervals between the small wet catchlights instead of coating
 * the whole lining white or drawing free-standing spots on the section. */
export function glazeFoldEdges(mesh:Mesh,posterior:boolean,stations:number,mucosa:number,widthAt:(t:number)=>number,foldAt:(i:number,x:number)=>number){
  const w=384,h=384,ink=new Int8Array(w*h),pitch=mesh.cols*stride,end=Math.round((mesh.cols-1)*mucosa)*stride;
  function uv(x:number,t:number):P{
    const f=clamp(t/stations)*(mesh.rows-1),j=Math.min(mesh.rows-2,Math.floor(f)),k=f-j,b=j*pitch,a=mesh.a;
    const start=(1-k)*a[b]+k*a[b+pitch],edge=(1-k)*a[b+end]+k*a[b+pitch+end];
    return [(x*widthAt(t)-start)/(edge-start)*mucosa*(w-1),t/stations*(h-1)];
  }
  function stroke(fn:(s:number)=>P,r:number,value:number,lo=0,hi=mucosa){
    let old=fn(0);for(let n=1;n<=32;n++){
      const next=fn(n/32),du=next[0]-old[0],dv=next[1]-old[1],steps=Math.max(1,Math.ceil(Math.hypot(du,dv)));
      for(let s=1;s<=steps;s++){
        const weight=Math.sin(Math.PI*((n-1)+s/steps)/32)**.68,radius=r*(.55+.45*weight),x=old[0]+du*s/steps,y=old[1]+dv*s/steps;
        for(let j=Math.max(0,Math.floor(y-radius));j<=Math.min(h-1,Math.ceil(y+radius));j++)for(let i=Math.max(Math.ceil(lo*(w-1)),Math.floor(x-radius));i<=Math.min(hi*(w-1),Math.ceil(x+radius));i++){
          const fall=1-((i-x)**2+(j-y)**2)/(radius*radius);if(fall<=0)continue;
          const index=j*w+i,mark=Math.round(fall*weight*value);if(Math.abs(mark)>Math.abs(ink[index]))ink[index]=mark;
        }
      }old=next;
    }
  }
  if(posterior)for(let i=0;i<7;i++){
    const left=-.72+.13*Math.sin(4*i),tip=-.12+.18*Math.sin(2.5*i+.3);
    const line=(a:number,b:number,offset:number,bend=0)=>(s:number):P=>{const x=a+(b-a)*s;
      return uv(x,foldAt(i,x)+offset+bend*Math.sin(Math.PI*s));};
    // The reflected arc on the turned summit and the shorter, softer dark
    // return sit on opposite slopes, interrupted at each lateral leaflet.
    stroke(line(left,tip,.014,.006),2.1,47-i*2);stroke(line(left+.03,tip+.13,-.023,-.008),2.6,-24);
    stroke(line(tip+.06,.35+.05*Math.cos(i),.012,-.006),1.35,28-i);
    if(i<5){stroke(line(left+.04,tip-.03,-.042,.020),1.35,18);stroke(line(-.80,left+.12,.014),1.15,22);}
  }
  // A few oblique secondary pleats near the fornices fade into the long axis.
  if(posterior)for(let i=0;i<5;i++){
    const a=-.75+i*.225;stroke(s=>uv(a+.10*s+.035*Math.sin(3.8*s+i),.78+.23*s+.032*Math.cos(i)),1.55,i%2?-13:12);
  }
  // Oblique lamina bundles in the exposed wall (separate from the mucosal
  // print). Discontinuous, uneven arcs; a narrow branch occasionally turns
  // down beside the bundle. The outside of the sheath remains unengraved.
  const spans=[[.055,.18,.048],[.22,.62,-.061],[.31,.41,.084],[.52,.31,.075],[.70,.73,-.085],[.82,.42,.066],[1.07,.51,-.058]];
  for(const [i,[t,axis,bend]] of spans.entries()){
    const phase=i*.84+(posterior?0:1.6),base=t+(posterior?0:.042);
    const arc=(offset:number,branch:boolean)=>(s:number):P=>{
      const d=branch?(.18+.40*s):s,thick=axis+(.24+.033*Math.cos(phase))*Math.sin(2.34*d+phase)-.093*d+(branch?.17*s:0);
      return [(1-.25*thick)*(w-1),(base+.095*d+bend*d*d+offset+.010*Math.sin(3*d+phase))*(h-1)/stations];
    };
    stroke(arc(0,false),1.85,-19,.75,1);stroke(arc(.008,false),1.35,12,.75,1);if(i%2===0)stroke(arc(0,true),1.15,-14,.75,1);
  }
  const map={width:w,height:h,ink};mesh.etch=[map,map];
}
