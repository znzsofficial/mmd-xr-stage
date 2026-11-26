import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MmdVrPrepApp } from "./mmdVrShowcase/prep/MmdVrPrepApp";
import { initializeBrowserColorScheme } from "./system/theme";
import "./styles.css";
import {openStageLink} from './mmdVrShowcase/screen/enterScreen';
import type {LoadFloorBackend} from './mmdVrShowcase/xr/floorBackend';

const query=new URLSearchParams(location.search);
openStageLink(query);
// Import only after the player chooses the WebGPU floor or follows its link.
const loadFloorBackend:LoadFloorBackend = ()=>import('../scripts/webgpu-actor/stage-host.jsx').then(m=>m.startGameFloor);

const stopColorSchemeSync = initializeBrowserColorScheme();
if (import.meta.hot) import.meta.hot.dispose(stopColorSchemeSync);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MmdVrPrepApp loadFloorBackend={loadFloorBackend} initialFloorRenderer={query.get('xrBackend')==='webgpu'?'webgpu':'webgl'}/>
  </StrictMode>,
);
