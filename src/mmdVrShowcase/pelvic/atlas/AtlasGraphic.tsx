import {ActorHudDiagram,ActorScreenDiagram,type DiagramSpec} from '../../components/ActorDiagram';
import {SECTION_W,SECTION_H} from '../sectionPaint';
import {atlasPainter,type AtlasActor,type AtlasScope} from './painter';
import {readAtlasView,setAtlasView} from './view';

export const atlasAspect=SECTION_H/SECTION_W;
function atlasSpec(scope:AtlasScope):DiagramSpec{return {id:scope,meshName:'pelvic:sagittal-section',classes:'pelvic-section atlas-artboard',width:SECTION_W,height:SECTION_H,
  angle:id=>readAtlasView(id).degrees,turn:(id,degrees)=>setAtlasView(id,{degrees}),open:(c,a,w,u)=>atlasPainter(c,a,scope,w,u)};}
const specs={body:atlasSpec('body'),pelvic:atlasSpec('pelvic')};
type GraphicProps=AtlasActor&{scope:AtlasScope};
export const AtlasScreenGraphic=({scope,...actor}:GraphicProps)=><ActorScreenDiagram {...actor} spec={specs[scope]}/>;
export const AtlasHudGraphic=({scope,...props}:GraphicProps&{widthM:number})=><ActorHudDiagram {...props} spec={specs[scope]}/>;
