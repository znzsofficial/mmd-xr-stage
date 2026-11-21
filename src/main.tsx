import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MmdVrPrepApp } from "./mmdVrShowcase/MmdVrPrepApp";
import { initializeBrowserColorScheme } from "./system/theme";
import "./styles.css";
import {useMmdVrStore} from './mmdVrShowcase/mmdVrStore';
import {enterScreen} from './mmdVrShowcase/screen/enterScreen';

// Direct link for comparing the local prototype against the reference angles.
if(new URLSearchParams(location.search).get('preview')==='arcade'){
  useMmdVrStore.getState().setPrefs({scenery:'arcadeHall'});enterScreen();
}

const stopColorSchemeSync = initializeBrowserColorScheme();
if (import.meta.hot) import.meta.hot.dispose(stopColorSchemeSync);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MmdVrPrepApp />
  </StrictMode>,
);
