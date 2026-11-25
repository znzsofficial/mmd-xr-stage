import {Frustum,Matrix4,type Box3,type BufferGeometry,type Camera,type Mesh,type Scene,type WebGLRenderer} from 'three';

export interface GroveRange {bounds:Box3;start:number;end:number}

/** One immutable index buffer per opaque material. Skip only the invisible
 * ends of its grove list: gaps inside cost triangles, not extra draw calls. */
export function lanternGroveBatch(geometry:BufferGeometry,groves:readonly GroveRange[]){
  const clip=new Matrix4(),frustum=new Frustum();
  return {geometry,
    // WebGLRenderer passes the actual drawing eye here (also for stereo).
    onBeforeRender(this:Mesh,_renderer:WebGLRenderer,_scene:Scene,camera:Camera){
      clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(this.matrixWorld);
      frustum.setFromProjectionMatrix(clip,camera.coordinateSystem,camera.reversedDepth);
      let first=0,last=groves.length-1;
      while(first<=last&&!frustum.intersectsBox(groves[first].bounds))first++;
      while(last>first&&!frustum.intersectsBox(groves[last].bounds))last--;
      if(first>last)geometry.setDrawRange(0,0);
      else {const start=groves[first].start;geometry.setDrawRange(start,groves[last].end-start);}
    },
    onAfterRender(){geometry.setDrawRange(0,Infinity);},
  };
}
