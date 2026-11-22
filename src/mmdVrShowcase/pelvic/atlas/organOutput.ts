import {diagramOutput} from '../../components/diagramOutput';
import {createOrganArt,type OrganArtOptions} from './organArt';

export const organOutput=(wake:(result:'ready'|'retry')=>void)=>diagramOutput<OrganArtOptions>(
  ()=>new Worker(new URL('./organ.worker.ts',import.meta.url),{type:'module'}),createOrganArt,wake);
