// Original, in-memory PMX fitting swatch. Exercises exactly the same importer,
// native world, pose clip, compute pass and draw calls as a picked local PMX.
export function makeSwatch(){
  const bone=[],body=[],joint=[],vertices=[],groups=[[],[],[]];
  const addBone=(name,p,parent=-1)=>bone.push({name,p,parent})-1;
  const torso=addBone('下半身',[0,9,0]),spine=addBone('上半身',[0,11,0],torso),neck=addBone('首',[0,14,0],spine);addBone('頭',[0,15,0],neck);
  const collider=(b,p,r,h=0)=>body.push({name:bone[b].name,b,p,r,h,dyn:false})-1;
  collider(torso,[0,9,0],1.25,1.0);collider(spine,[0,11,0],1.28,.8);
  const vertex=(p,b,normal=[0,1,0])=>vertices.push({p,b,normal})-1;
  function oval(b,x,y,z,rx,ry,rz){const rows=8,cols=16,base=vertices.length;
    for(let j=0;j<=rows;j++)for(let k=0;k<cols;k++){const lat=(j/rows-.5)*Math.PI,a=k/cols*2*Math.PI,n=[Math.cos(lat)*Math.cos(a),Math.sin(lat),Math.cos(lat)*Math.sin(a)];vertex([x+n[0]*rx,y+n[1]*ry,z+n[2]*rz],b,n);}
    for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const a=base+j*cols+k,c=base+j*cols+(k+1)%cols;groups[0].push(a,c,a+cols,c,c+cols,a+cols);}}
  oval(spine,0,11.55,0,1.8,2.6,1.02);oval(torso,0,9,0,1.5,1.05,1.18);
  for(const [s,side] of [[1,'左'],[-1,'右']]){const x=s*.86,leg=addBone(side+'足',[x,9,0],torso),knee=addBone(side+'ひざ',[x,5,-.12],leg),foot=addBone(side+'足首',[x,1,0],knee);
    addBone(side+'つま先',[x,.55,-1],foot);collider(leg,[x,7,0],.76,2.6);collider(knee,[x,3,0],.53,2.8);
    oval(leg,x,7,0,.79,2.45,.78);oval(knee,x,3,0,.52,2.2,.52);oval(foot,x,.68,-.27,.50,.52,.83);
    const arm=addBone(side+'腕',[s*1.5,13.1,0],spine),elbow=addBone(side+'ひじ',[s*3.9,12.1,.1],arm);addBone(side+'手首',[s*6.1,11.25,0],elbow);}
  const cols=20,rows=8,start=vertices.length,rb=[],bs=[];
  for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const t=j/(rows-1),a=2*Math.PI*k/cols,fold=k%2?.14:-.14,r=1.62+1.65*t+fold*t,p=[Math.sin(a)*r,10.15-3.95*t,-Math.cos(a)*(r*.78)];
    const n=j*cols+k,b=addBone(`skirt ${j}/${k}`,p,j?bs[n-cols]:torso);bs.push(b);rb.push(body.push({name:bone[b].name,b,p,r:.22,h:0,dyn:true})-1);vertex(p,b,[Math.sin(a),.28,-Math.cos(a)]);}
  for(let j=0;j<rows;j++)for(let k=0;k<cols;k++){const i=j*cols+k,v=j*cols+(k+1)%cols;
     joint.push([rb[i],j?rb[i-cols]:0,bone[bs[i]].p],[rb[i],rb[v],bone[bs[i]].p]);
     if(j<rows-1)groups[j===rows-2?2:1].push(start+i,start+i+cols,start+v,start+v,start+i+cols,start+v+cols);}
  return encodeSwatch({bone,body,joint,vertices,groups},'fitting-swatch.pmx');
}

// Also used by the independent mask fixture: same PMX importer, different rig.
export function encodeSwatch({bone,body,joint,vertices,groups},filename){
  const bytes=[],enc=new TextEncoder(),scratch=new DataView(new ArrayBuffer(4));const u=x=>bytes.push(x&255),u16=x=>{u(x);u(x>>8);},i=x=>{scratch.setInt32(0,x,true);bytes.push(...new Uint8Array(scratch.buffer));},f=x=>{scratch.setFloat32(0,x,true);bytes.push(...new Uint8Array(scratch.buffer));};
  const vec=(...x)=>x.forEach(f),str=s=>{const a=enc.encode(s);i(a.length);bytes.push(...a);};bytes.push(...enc.encode('PMX '));f(2);bytes.push(8,1,0,2,1,1,2,1,2);str('Fitting swatch');str('');str('');str('');
  i(vertices.length);for(const v of vertices){vec(...v.p,...v.normal,0,0);u(0);u16(v.b);f(1);}i(groups.reduce((s,g)=>s+g.length,0));for(const g of groups)g.forEach(u16);
  i(0);i(groups.length);for(const [k,color] of [[0,[.72,.58,.5]],[1,[.24,.63,.67]],[2,[.90,.72,.36]]]){str(['form','cloth','selvage'][k]);str('');vec(...color,1,0,0,0,1,.3,.3,.3);u(1);vec(0,0,0,1,0);bytes.push(255,255,0,1,0);str('');i(groups[k].length);}
  i(bone.length);for(const b of bone){str(b.name);str('');vec(...b.p);u16(b.parent);i(0);u16(0x1e);vec(0,-.4,0);}
  i(0);i(0);i(body.length);for(const b of body){str(b.name);str('');u16(b.b);u(b.group??(b.dyn?6:0));u16(b.mask??(b.dyn?1<<6:0));u(b.h?2:0);vec(b.r,b.h,0,...b.p,0,0,0,b.dyn?.38:0,.8,.8,0,.4);u(b.dyn?1:0);}
  i(joint.length);for(const [a,b,p] of joint){str('seam');str('');u(0);u16(a);u16(b);vec(...p,0,0,0,0,0,0,0,0,0,-.45,-.3,-.45,.45,.3,.45,0,0,0,1,1,1);}
  return new File([new Uint8Array(bytes)],filename);
}
