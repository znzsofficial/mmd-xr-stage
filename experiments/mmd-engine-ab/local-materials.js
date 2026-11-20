import {MmdStandardMaterialBuilder} from 'babylon-mmd/esm/Loader/mmdStandardMaterialBuilder';
import {ReferenceFileResolver} from 'babylon-mmd/esm/Loader/referenceFileResolver';

// PMX material references are local filenames. A miss must not turn into an
// HTTP request (including on the preview's own origin).
export class LocalMaterials extends MmdStandardMaterialBuilder {
  missing=0;
  buildMaterials(id,materials,textures,paths,root,fileRoot,files,...rest){
    const resolver=new ReferenceFileResolver(files,root,fileRoot);
    const local=paths.map(p=>{if(!p||resolver.resolve(resolver.createFullPath(p)))return p||undefined;this.missing++;return undefined});
    return super.buildMaterials(id,materials,textures,local,root,fileRoot,files,...rest);
  }
}
