import {Fn,If,attributeArray,instanceIndex,storage,uint,uniform} from 'three/tsl';
import {invalidateMmdTslSparseMorphOutputs} from '@yohawing/three-mmd-loader/webgpu';
import {fitPoseSkirt} from '../../src/mmdVrShowcase/mmdRuntime/poseSkirtClearance';
import {fitSparsePoseSkirt} from '../../src/mmdVrShowcase/mmdRuntime/sparsePoseSkirt';

/** Apply measured bind-space offsets to the freshly computed sparse positions,
 * before skinning, outlines and the two eye draws. The loader owns that buffer
 * (including its vec3 storage stride). Never upload its stale CPU array. */
export function createFloorPoseSkirt(renderer,mesh,source){
  const output=mesh.geometry.attributes.position;
  let dense,layer,points,staging,compute,used,affected,entries=0,show=false,version=-1,submitted=-1,wasShown=false;
  function capture(){
    if(layer.version!==version){
      affected??=new Set();affected.clear();entries=0;
      layer.visitOffsets((index,x,y,z)=>{
        staging??=new Float32Array(layer.capacity*4);
        const at=entries++*4;
        staging[at]=x;staging[at+1]=y;staging[at+2]=z;staging[at+3]=index;affected.add(index);
      });
      version=layer.version;
    }
    show=entries>0;
    if(show&&!wasShown)invalidateMmdTslSparseMorphOutputs(mesh);
  }
  return {
    fit(){
      if(output===source.position){dense=fitPoseSkirt(mesh);return dense;}
      if(!mesh.userData.mmdTslSparsePositionMorphs||!output.isStorageBufferAttribute)return null;
      layer=fitSparsePoseSkirt(mesh,source);if(!layer)return null;
      source.poseSkirtSampleable=ids=>!show||ids.every(i=>!affected.has(i));
      return {...layer,get hasField(){return layer.hasField;},
        seed(){show=false;layer.seed();},present(){layer.present();capture();},
        restore(){show=false;layer.restore();},clear(){show=false;layer.clear();}};
    },
    get active(){return show||!!dense?.hasOffsets;},
    get dirty(){return show!==wasShown||show&&version!==submitted;},
    submit(){
      if(show){
        if(!compute){
          points=attributeArray(layer.capacity,'vec4').toReadOnly();used=uniform(0,'uint');
          const dst=storage(output,'vec3',output.count);
          compute=Fn(()=>{If(instanceIndex.lessThan(used),()=>{
            const row=points.element(instanceIndex).toConst();dst.element(uint(row.w)).addAssign(row.xyz);
          });})().compute(layer.capacity);
          compute.name='Manual pose skirt clearance';
        }
        if(version!==submitted){points.value.array.set(staging.subarray(0,entries*4));points.value.needsUpdate=true;}
        used.value=entries;
        // GPU addAssign does not change BufferAttribute.version. Even the
        // first prepare after this layer stops must reconstruct a clean base.
        invalidateMmdTslSparseMorphOutputs(mesh);
        renderer.compute(compute);
      }
      // A skipped presentation retains the last complete buffer. Whenever the
      // loader actually runs it overwrites ALL previous offsets, even on hold.
      submitted=version;wasShown=show;
    },
    dispose(){show=false;layer?.clear();delete source.poseSkirtSampleable;compute?.dispose();points?.value.dispose();}
  };
}
