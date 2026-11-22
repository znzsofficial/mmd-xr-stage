import {ActorHudDiagram,ActorScreenDiagram,type DiagramSpec} from '../../components/ActorDiagram';
import {SECTION_W,SECTION_H} from '../sectionPaint';
import {atlasPainter,type AtlasActor,type AtlasScope} from './painter';
import {readAtlasView,setAtlasView} from './view';

export const atlasAspect=SECTION_H/SECTION_W;
function atlasSpec(scope:AtlasScope):DiagramSpec{return {id:scope,meshName:scope==='body'||scope==='pelvic'?'pelvic:sagittal-section':`observation:${scope}`,classes:'pelvic-section atlas-artboard',width:SECTION_W,height:SECTION_H,
  angle:id=>readAtlasView(id).degrees,turn:(id,degrees)=>setAtlasView(id,{degrees}),open:(c,a,w,u)=>atlasPainter(c,a,scope,w,u)};}
export const atlasDiagrams={body:atlasSpec('body'),pelvic:atlasSpec('pelvic'),vulva:atlasSpec('vulva'),vagina:atlasSpec('vagina'),uterus:atlasSpec('uterus')};
type GraphicProps=AtlasActor&{scope:AtlasScope};
export const AtlasScreenGraphic=({scope,...actor}:GraphicProps)=><ActorScreenDiagram {...actor} spec={atlasDiagrams[scope]}/>;
export const AtlasHudGraphic=({scope,...props}:GraphicProps&{widthM:number})=><ActorHudDiagram {...props} spec={atlasDiagrams[scope]}/>;
