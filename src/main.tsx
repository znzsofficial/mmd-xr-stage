import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MmdVrPrepApp } from "./mmdVrShowcase/MmdVrPrepApp";
import { initializeBrowserColorScheme } from "./system/theme";
import "./styles.css";

const stopColorSchemeSync = initializeBrowserColorScheme();
if (import.meta.hot) import.meta.hot.dispose(stopColorSchemeSync);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MmdVrPrepApp />
  </StrictMode>,
);
