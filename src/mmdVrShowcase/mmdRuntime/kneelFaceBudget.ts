import {Vector3} from 'three';

// The thigh pass can already have bent this triangle. Its currently drawn
// normal and three edge lengths, not the raw Bullet face, define the remaining
// room for a shin correction. Find a common fraction for the entire panel.
export function kneelFaceBudget(){
  const e=new Vector3(),f=new Vector3(),g=new Vector3(),n=new Vector3(),u=e.clone(),v=e.clone(),m=e.clone(),a1=e.clone(),a2=e.clone();
  const cos2=Math.cos(Math.PI/15)**2,low=.90**2,high=1.10**2;
  return (a:Vector3,b:Vector3,c:Vector3,da:Vector3,db:Vector3,dc:Vector3,max:number)=>{
    e.subVectors(b,a);f.subVectors(c,a);g.subVectors(f,e);u.subVectors(db,da);v.subVectors(dc,da);
    if(!u.lengthSq()&&!v.lengthSq())return max;
    const ne=e.lengthSq(),nf=f.lengthSq(),ng=g.lengthSq(),nn=n.crossVectors(e,f).lengthSq();
    if(nn<1e-18*Math.max(ne,nf,ng)**2||!nn)return 0;
    const ok=(t:number)=>{
      a1.copy(e).addScaledVector(u,t);a2.copy(f).addScaledVector(v,t);m.crossVectors(a1,a2);const dot=m.dot(n);
      if(dot<=0||dot*dot<cos2*nn*m.lengthSq())return false;
      const l=a1.lengthSq(),r=a2.lengthSq(),s=a1.distanceToSquared(a2);return l>=low*ne&&l<=high*ne&&r>=low*nf&&r<=high*nf&&s>=low*ng&&s<=high*ng;
    };
    if(ok(max))return max;let lo=0,hi=max;for(let i=0;i<8;i++){const mid=(lo+hi)*.5;if(ok(mid))lo=mid;else hi=mid;}return lo;
  };
}
