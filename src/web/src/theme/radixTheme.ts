import type { ThemeProps } from "@radix-ui/themes";

// Shared Radix Themes config for the ServiceCenter app. `iris` is the nearest
// Radix accent to the grid's #4F46E5 selection highlight; `slate` matches the
// grid's cool-gray tints. `as const` narrows each value to the literal Radix
// prop union (no TS enums — keeps the project's erasable-syntax rule). One prop
// each to revisit later (e.g. accentColor: 'indigo').
export const radixThemeConfig = {
  accentColor: "iris",
  grayColor: "slate",
  radius: "medium",
  scaling: "100%",
} as const satisfies Pick<ThemeProps, "accentColor" | "grayColor" | "radius" | "scaling">;
