import {Masonry,type V} from './masonry';
import {HALL} from './chamberLayout';

// Two views into the same evening palette. The foreground bridge, roofs and
// ridge are separated in metres: moving one's head changes their overlap.
export function towerViews(m:Masonry){
  function street(west:boolean){
    const p=(x:number,y:number,d:number):V=>west?[-HALL.half-d,y,1.51-x]:[1.95+x,y,HALL.back-d];
    const face=(verts:V[],c:string)=>m.quad('dusk',verts.map(([x,y,z])=>p(x,y,z)) as [V,V,V,V],c);
    const panel=(l:number,r:number,b:number,t:number,d:number,c:string)=>face([[l,b,d],[r,b,d],[r,t,d],[l,t,d]],c);
    function box(x:number,y:number,d:number,w:number,h:number,depth:number,front:string,side:string,top:string){
      const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,n=d-depth/2,f=d+depth/2;
      panel(l,r,b,t,n,front);face([[l,b,f],[l,b,n],[l,t,n],[l,t,f]],side);face([[r,b,n],[r,b,f],[r,t,f],[r,t,n]],side);face([[l,t,n],[r,t,n],[r,t,f],[l,t,f]],top);
    }
    for(let k=0;k<3;k++){
      const d=15+k*2,shade=['#475778','#676786','#9e859a'][k];for(let i=-15;i<15;i++){
        const peak=(x:number)=>2.05+k*.64+.75*Math.sin(x*.62+2*k)+.8*Math.cos(.24*x+2*k)+.31*Math.sin(1.26*x);
        face([[i*1.4,-4,d],[(i+1)*1.4,-4,d],[(i+1)*1.4,peak(i+1),d],[i*1.4,peak(i),d]],shade);
      }
    }
    // Painted sky beyond the village, with a carved crescent on the western skyline.
    for(let i=0;i<48;i++){const y=-3+i*.37,t=Math.min(1,i/35);const col=(v:number)=>v.toString(16).padStart(2,'0');
      panel(-24,24,y,y+.374,21.5,'#'+[222-139*t,151-72*t,145-7*t].map(v=>col(Math.round(v))).join(''));}
    const roof=(x:number,y:number,d:number,w:number,h:number,depth:number)=>{
      face([[x-w/2,y,d-depth/2],[x+w/2,y,d-depth/2],[x+w/2,y+h,d],[x-w/2,y+h,d]],'#776480');
      face([[x+w/2,y,d-depth/2],[x+w/2,y,d+depth/2],[x+w/2,y+h,d],[x+w/2,y+h,d]],'#484764');
    };
    for(let i=-4;i<=4;i++){
      const d=8+1.2*Math.cos(i*2.4),x=i*2.23+(west?.7:-.6),h=2.32+.48*Math.sin(i*1.8+.9);
      box(x,-2.0+h/2,d,1.9,h,1.62,i%2?'#a88983':'#ae9590','#7b737e','#967d80');roof(x,h-2,d,2.13,.93+.18*Math.cos(i),1.92);
      for(const o of [-.51,.45]){panel(x+o-.14,x+o+.14,h-2.74,h-2.31,d-.827,'#ffcf82');}
      box(x+.72,h-1.31,d+.3,.24,1.14,.36,'#9a8384','#756b7a','#bca39a');
    }
    const x=west?1.04:1.89,d=11.45;
    box(x,.87,d,1.42,4.8,1.3,'#a39aa4','#7a7c91','#bcb3b1');box(x,3.16,d,1.59,.22,1.48,'#cfb8a6','#83859b','#d1c7bd');
    for(const s of [-.28,.28])panel(x+s-.10,x+s+.10,2.36,2.94,d-.667,'#514963');
    for(let k=0;k<16;k++){
      const a=k*Math.PI/8,b=(k+1)*Math.PI/8;
      face([[x,1.96,d-.68],[x+Math.cos(a)*.25,1.96+Math.sin(a)*.25,d-.68],[x+Math.cos(b)*.25,1.96+Math.sin(b)*.25,d-.68],[x,1.96,d-.68]],'#eac396');
    }panel(x-.014,x+.014,1.95,2.15,d-.69,'#624e60');panel(x-.14,x+.014,1.946,1.974,d-.69,'#624e60');
    face([[x-.89,3.27,d-.81],[x+.89,3.27,d-.81],[x+.05,4.95,d],[x+.05,4.95,d]],'#645b81');face([[x+.89,3.27,d-.81],[x+.89,3.27,d+.81],[x+.05,4.95,d],[x+.05,4.95,d]],'#464965');
    panel(x+.02,x+.066,4.87,5.65,d,'#816058');face([[x+.05,5.33,d],[x+.77,5.47,d],[x+.43,5.51,d],[x+.05,5.64,d]],'#e8a473');
    // Warm near parapet at the foot of the castle and dark cypress silhouettes.
    box(0,-.58,3.9,17,.26,.54,'#72657a','#514759','#ad94a1');
    for(let j=-4;j<=4;j++)box(j*1.9,-1.55,3.9,.36,1.89,.42,'#746373','#544c60','#a58391');
    for(let j=0;j<8;j++){const xx=(j<4?-1:1)*(2.4+(j%4)*1.14),zz=4.9+(j%3)*.72,h=2.7+(j%3)*.31;
      for(let k=0;k<3;k++){const hw=.56-k*.13,y=-1.75+k*.72;face([[xx-hw,y,zz],[xx+hw,y,zz],[xx+.04,y+h*.65,zz],[xx+.04,y+h*.65,zz]],k%2?'#375563':'#475a69');}}
  }
  street(false);street(true);
}
