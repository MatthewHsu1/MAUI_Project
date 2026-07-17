import type { Theme } from "@glideapps/glide-data-grid";
import type { Appearance } from "./appearanceSlice";

export const lightGridTheme: Partial<Theme> = {
  // Base Grid Layout Fills
  bgCell: "#FFFFFF",
  bgCellMedium: "#FAFAFB",
  bgHeader: "#F7F9FA",
  bgHeaderHovered: "#EAEFF2",
  bgHeaderHasFocus: "#E1E7EC",
  borderColor: "#E1E6EB",
  drilldownBorder: "#E1E6EB",
  horizontalBorderColor: "#E1E6EB",

  // Icons
  bgIconHeader: "#EAEFF2",
  fgIconHeader: "#4A4A52",

  // High-Contrast Light Typography
  textDark: "#313139",
  textMedium: "#737380",
  textLight: "#B2B2BC",
  textBubble: "#313139",
  textHeader: "#4A4A52",
  textHeaderSelected: "#000000",
  linkColor: "#4F46E5",

  // Selection Systems
  accentColor: "#4F46E5",
  accentLight: "rgba(79, 70, 229, 0.1)",
  accentFg: "#FFFFFF",

  // Interface Popups & Results
  bgBubble: "#EDF2F7",
  bgBubbleSelected: "#FFFFFF",
  bgSearchResult: "#FFF7ED",

  // Font Styles
  baseFontStyle: "13px",
  headerFontStyle: "bold 12px",
  markerFontStyle: "9px",
  fontFamily: "Inter, Roboto, -apple-system, sans-serif",
  editorFontSize: "13px",
  lineHeight: 1.2,

  // Sizing and Layout
  cellHorizontalPadding: 12,
  cellVerticalPadding: 8,
  headerIconSize: 16,
};

export const darkGridTheme: Partial<Theme> = {
  // Base App & Grid Architecture Colors
  bgCell: "#161719",
  bgCellMedium: "#0B0C0E",
  bgHeader: "#161719",
  bgHeaderHovered: "#22242A",
  bgHeaderHasFocus: "#2C2E35",
  borderColor: "#2C2E35",
  drilldownBorder: "#2C2E35",
  horizontalBorderColor: "#2C2E35",

  // Icons
  bgIconHeader: "#22242A",
  fgIconHeader: "#A0A5AD",

  // System Text & Typography
  textDark: "#F0F1F2",
  textMedium: "#A0A5AD",
  textLight: "#6B7280",
  textBubble: "#F0F1F2",
  textHeader: "#A0A5AD",
  textHeaderSelected: "#FFFFFF",
  linkColor: "#60A5FA",

  // Font Styles
  baseFontStyle: "13px",
  headerFontStyle: "bold 12px",
  markerFontStyle: "9px",
  fontFamily: "Inter, Roboto, -apple-system, sans-serif",
  editorFontSize: "13px",
  lineHeight: 1.2,

  // Layout
  cellHorizontalPadding: 12,
  cellVerticalPadding: 8,
  headerIconSize: 16,

  // Selection Highlight Systems
  accentColor: "#3B82F6",
  accentLight: "rgba(59, 130, 246, 0.15)",
  accentFg: "#FFFFFF",

  // Interactive Overlays
  bgBubble: "#22242A",
  bgBubbleSelected: "#3B82F6",
  bgSearchResult: "#3E3214",
};

export function themeForAppearance(appearance: Appearance): Partial<Theme> {
  return appearance === "dark" ? darkGridTheme : lightGridTheme;
}
