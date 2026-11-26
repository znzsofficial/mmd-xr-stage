import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MmdVrPrepApp } from "./mmdVrShowcase/prep/MmdVrPrepApp";
import { initializeBrowserColorScheme } from "./system/theme";
import "./styles.css";
import {openStageLink} from './mmdVrShowcase/screen/enterScreen';
import type {LoadFloorBackend} from './mmdVrShowcase/xr/floorBackend';

const query=new URLSearchParams(location.search);
openStageLink(query);
// The qualification build runs the actual game entry and UI. A normal
// release erases this branch, including the renderer chunk, before bundling.
const loadFloorBackend:LoadFloorBackend|undefined = (import.meta.env.DEV || import.meta.env.MODE==='webgpu-qualification') && query.get('xrBackend')==='webgpu'
  ? ()=>import('../scripts/webgpu-actor/stage-host.jsx').then(m=>m.startGameFloor) : undefined;

const stopColorSchemeSync = initializeBrowserColorScheme();
if (import.meta.hot) import.meta.hot.dispose(stopColorSchemeSync);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MmdVrPrepApp loadFloorBackend={loadFloorBackend}/>
  </StrictMode>,
);
