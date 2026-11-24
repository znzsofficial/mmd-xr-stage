import {ActorHudDiagram,ActorScreenDiagram,type DiagramActor,type DiagramSpec} from '../../observation/ActorDiagram';
import {breastPainter,BREAST_WIDTH,BREAST_HEIGHT} from './painter';
import {readBreastView,setBreastView} from './view';

export const breastDiagram:DiagramSpec={id:'breast',meshName:'body:breast-observation',classes:'breast-artboard',width:BREAST_WIDTH,height:BREAST_HEIGHT,
  angle:id=>readBreastView(id).degrees,turn:(id,degrees)=>setBreastView(id,{degrees}),open:breastPainter};
export const BreastScreenGraphic=(props:DiagramActor)=><ActorScreenDiagram {...props} spec={breastDiagram}/>;
export const BreastHudGraphic=(props:DiagramActor&{widthM:number})=><ActorHudDiagram {...props} spec={breastDiagram}/>;
