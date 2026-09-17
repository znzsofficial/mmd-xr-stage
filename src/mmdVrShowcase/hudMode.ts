export type HudSurface = "watch" | "adjust" | "load" | "physics" | "diagnostics";

export function resolveHudSurface(options: { watching: boolean; loading: boolean; pendingFailures: boolean; physicsDetails: boolean; diagnostics: boolean }): HudSurface {
  if (options.physicsDetails) return "physics";
  if (options.loading || options.pendingFailures) return "load";
  if (options.diagnostics) return "diagnostics";
  return options.watching ? "watch" : "adjust";
}
