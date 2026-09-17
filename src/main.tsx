import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MmdVrPrepApp } from "./mmdVrShowcase/MmdVrPrepApp";
import { applyThemeSettings, initializeThemeSync, readThemeSettings } from "./system/theme";
import "./styles.css";

applyThemeSettings(readThemeSettings());
initializeThemeSync();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MmdVrPrepApp />
  </StrictMode>,
);
