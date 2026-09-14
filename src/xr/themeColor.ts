import type { ThemeSettings } from "../types";

export const XR_THEME_COLORS = ["blue", "cyan", "purple", "green", "red"] as const;
export type XrThemeColor = (typeof XR_THEME_COLORS)[number];
export type XrThemeMode = "light" | "dark";

export type XrAccentTokens = {
  primary: string;
  soft: string;
  border: string;
  marker: string;
  gridMajor: string;
  gridMinor: string;
  ink: string;
  muted: string;
  track: string;
  stageBg: string;
};

const PALETTES: Record<XrThemeColor, XrAccentTokens> = {
  blue: { primary: "#5b8def", soft: "#1d2c4b", border: "#496ca8", marker: "#72a7ff", gridMajor: "#365584", gridMinor: "#243956", ink: "#f7f2f4", muted: "#c8bcc1", track: "#4b4248", stageBg: "#0c1018" },
  cyan: { primary: "#36a9bf", soft: "#173b43", border: "#347987", marker: "#57c9dc", gridMajor: "#2d6470", gridMinor: "#21434a", ink: "#f7f2f4", muted: "#c8bcc1", track: "#4b4248", stageBg: "#0b1216" },
  purple: { primary: "#9270df", soft: "#30244d", border: "#6c58a0", marker: "#ad8cf2", gridMajor: "#57477d", gridMinor: "#393052", ink: "#f7f2f4", muted: "#c8bcc1", track: "#4b4248", stageBg: "#100d18" },
  green: { primary: "#4fa77d", soft: "#1d3b2f", border: "#3f775e", marker: "#6cc69a", gridMajor: "#37634f", gridMinor: "#274437", ink: "#f7f2f4", muted: "#c8bcc1", track: "#4b4248", stageBg: "#0b1511" },
  red: { primary: "#c35d70", soft: "#3a2028", border: "#80505e", marker: "#df788b", gridMajor: "#633945", gridMinor: "#432a31", ink: "#f7f2f4", muted: "#c8bcc1", track: "#4b4248", stageBg: "#160d11" },
};

const SYSTEM_ACCENT_HEX: Record<ThemeSettings["accentColor"], string> = {
  blue: "#5b8def",
  cyan: "#36a9bf",
  emerald: "#4fa77d",
  mint: "#43b89d",
  amber: "#d28a3d",
  coral: "#d46b58",
  rose: "#d15b79",
  purple: "#9270df",
  violet: "#8069d8",
  slate: "#71809a",
};

function parseHex(value: string): [number, number, number] {
  const normalized = value.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function mixHex(a: string, b: string, amount: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const mix = (first: number, second: number) => Math.round(first + (second - first) * amount).toString(16).padStart(2, "0");
  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`;
}

function createSystemAccentTokens(primary: string, mode: XrThemeMode): XrAccentTokens {
  const dark = mode === "dark";
  const stageBase = "#090b10";
  return {
    primary,
    soft: mixHex(primary, dark ? "#17131a" : "#fffaf8", dark ? 0.24 : 0.86),
    border: mixHex(primary, dark ? "#3e3440" : "#55454c", 0.5),
    marker: mixHex(primary, "#ffffff", dark ? 0.24 : 0.08),
    gridMajor: mixHex(primary, dark ? "#11131a" : "#ffffff", dark ? 0.56 : 0.25),
    gridMinor: mixHex(primary, dark ? "#11131a" : "#ffffff", dark ? 0.74 : 0.54),
    ink: dark ? "#f7f2f4" : "#2b2428",
    muted: dark ? "#c8bcc1" : "#685a60",
    track: dark ? "#4b4248" : "#b8aeb2",
    stageBg: mixHex(primary, stageBase, 0.12),
  };
}

const SYSTEM_PALETTES: Record<ThemeSettings["accentColor"], Record<XrThemeMode, XrAccentTokens>> = Object.fromEntries(
  Object.entries(SYSTEM_ACCENT_HEX).map(([accent, primary]) => [
    accent,
    {
      light: createSystemAccentTokens(primary, "light"),
      dark: createSystemAccentTokens(primary, "dark"),
    },
  ]),
) as Record<ThemeSettings["accentColor"], Record<XrThemeMode, XrAccentTokens>>;

export function normalizeXrThemeColor(value: unknown): XrThemeColor {
  return XR_THEME_COLORS.includes(value as XrThemeColor) ? value as XrThemeColor : "blue";
}

export function getXrAccentTokens(value: unknown): XrAccentTokens {
  return PALETTES[normalizeXrThemeColor(value)];
}

export function getSystemXrAccentTokens(value: unknown, mode: XrThemeMode = "dark"): XrAccentTokens {
  const accent = typeof value === "string" && Object.prototype.hasOwnProperty.call(SYSTEM_PALETTES, value)
    ? value as ThemeSettings["accentColor"]
    : "coral";
  return SYSTEM_PALETTES[accent][mode];
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
