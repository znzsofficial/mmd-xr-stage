// Older pages own this record. Honor their browser chrome mode without
// migrating, rewriting or subscribing our scene to their palettes.
const LEGACY_THEME_KEY = "neko-virt-os.theme-settings.v1";

function syncBrowserColorScheme() {
  let scheme = "light dark"; // let native chrome follow the OS
  try {
    const mode = JSON.parse(localStorage.getItem(LEGACY_THEME_KEY) ?? "null")?.theme;
    if (mode === "light" || mode === "dark") scheme = mode;
  } catch { /* storage unavailable or legacy record malformed */ }
  document.documentElement.style.colorScheme = scheme;
}

export function initializeBrowserColorScheme() {
  syncBrowserColorScheme();
  const onStorage = (event: StorageEvent) => {
    if (event.key === LEGACY_THEME_KEY || event.key === null) syncBrowserColorScheme();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
