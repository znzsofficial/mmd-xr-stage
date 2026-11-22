import {createVertexMorphLayer} from '../play/vertexMorphLayer';
import type {WandModel} from '../play/wandSurface';
import {getApertureMorph} from './apertureConfig';

export function createApertureLayer(){
  const layer=createVertexMorphLayer();
  return {restore:layer.restore, apply(assetId:string,surface:WandModel|null,amount:number){
    layer.apply(getApertureMorph(assetId),surface,amount);
  }};
}
