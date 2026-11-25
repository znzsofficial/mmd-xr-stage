import {expect,it} from 'vitest';
import {BoxGeometry,Group,InstancedMesh,Matrix4,MeshBasicMaterial,OrthographicCamera,Scene,Vector3,type BufferGeometry,type WebGLRenderer} from 'three';
import {cypressShadowPrefix} from './cypressShadows';
import {furnishingShadowPass} from './wedding/furnishingShadow';
import {makeFeast} from './wedding/furnishingsFeast';
import {makeSedan} from './wedding/furnishingsSedan';

// Rasterize just the silhouette, without a GPU, at a 5 mm sampling pitch.
// The low, nearly horizontal view exposes table/stool legs and the sedan's
// bearer gaps that are hidden under their tops in an overhead-only check.
function silhouette(g:BufferGeometry,dir:Vector3){
  const horizontal=new Vector3().crossVectors(dir,new Vector3(0,1,0)).normalize(),up=horizontal.clone().cross(dir).normalize();
  const p=g.getAttribute('position'),v=new Vector3(),xy=new Float64Array(2*p.count),width=1024,height=768;
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);xy[i*2]=width*.5+200*v.dot(horizontal);xy[i*2+1]=height*.35+200*v.dot(up);
  }
  const mask=new Uint8Array(width*height),index=g.index!.array,start=g.drawRange.start,end=start+g.drawRange.count;
  for(let i=start;i<end;i+=3){
    const a=2*index[i],b=2*index[i+1],c=2*index[i+2],ax=xy[a],ay=xy[a+1],bx=xy[b],by=xy[b+1],cx=xy[c],cy=xy[c+1];
    const sign=Math.sign((bx-ax)*(cy-ay)-(by-ay)*(cx-ax));if(!sign)continue;
    const x1=Math.ceil(Math.max(ax,bx,cx)),y1=Math.ceil(Math.max(ay,by,cy));
    for(let y=Math.floor(Math.min(ay,by,cy));y<y1;y++)for(let x=Math.floor(Math.min(ax,bx,cx));x<x1;x++){
      const u=x+.5,w=y+.5;
      if(sign*((bx-ax)*(w-ay)-(by-ay)*(u-ax))>=0&&sign*((cx-bx)*(w-by)-(cy-by)*(u-bx))>=0&&sign*((ax-cx)*(w-cy)-(ay-cy)*(u-cx))>=0)mask[y*width+x]=1;
    }
  }
  return mask;
}

it.each([['feast',makeFeast,13620],['sedan',makeSedan,16814]] as const)('retains the %s cast silhouette and restores the original indexed camera/interaction range',(_name,build,original)=>{
  const piece=build(),g=piece.body,index=g.index!,vertices=g.getAttribute('position'),hooks=furnishingShadowPass(g);
  const args=[{} as WebGLRenderer,new Scene(),new OrthographicCamera(),new OrthographicCamera(),g,new MeshBasicMaterial(),new Group()] as const;
  expect(g.drawRange).toEqual({start:0,count:3*original});
  for(const light of [new Vector3(-3.4,6.1,5.8),new Vector3(2,.3,3)]){
    light.normalize();const full=silhouette(g,light);hooks.onBeforeShadow(...args);
    expect(g.drawRange.count).toBeLessThan(original*3*.9);
    const low=silhouette(g,light);hooks.onAfterShadow(...args);
    let changed=0,covered=0;
    for(let i=0;i<full.length;i++){if(low[i]!==full[i])changed++;if(full[i])covered++;}
    expect(covered).toBeGreaterThan(8000);expect(changed/covered).toBeLessThan(.006);
    expect(g.drawRange).toEqual({start:0,count:3*original});
    expect(g.index).toBe(index);expect(g.getAttribute('position')).toBe(vertices);
  }
  for(const geometry of Object.values(piece))geometry?.dispose();args[5].dispose();
});

it('keeps exact cypress crowns at the light-frustum edge and restores all instances after each shadow, even when the last crown is lit',()=>{
  const g=new BoxGeometry(),material=new MeshBasicMaterial(),mesh=new InstancedMesh(g,material,6);
  for(let i=0;i<6;i++)mesh.setMatrixAt(i,new Matrix4().makeTranslation([0,1,8,9,14,15][i],0,0));
  mesh.position.x=5;mesh.updateMatrixWorld();const original=mesh.onBeforeShadow,finish=cypressShadowPrefix(mesh,[2,4,6]);
  const camera=new OrthographicCamera(-1,1,1,-1,.1,10),args=[{} as WebGLRenderer,new Scene(),new OrthographicCamera(),camera,g,material,new Group()] as const;
  for(const [x,expected] of [[5,2],[11.6,4],[20,6],[-1,0]]){
    camera.position.set(x,0,4);camera.updateMatrixWorld();mesh.onBeforeShadow(...args);
    expect(mesh.count).toBe(expected);mesh.onAfterShadow(...args);expect(mesh.count).toBe(6);
  }
  mesh.onBeforeShadow(...args);finish();expect(mesh.onBeforeShadow).toBe(original);expect(mesh.count).toBe(6);
  mesh.dispose();g.dispose();material.dispose();
});
