export const Colors = {
  blue:         "#0511F2",
  amber:        "#F2B90C",
  amberLight:   "#C9900A",
  red:          "#D90404",
  redLight:     "#B50303",
  bgDark:       "#0D0D0D",
  surfaceDark:  "#161920",   // ligeramente más azul para diferenciarse del bg
  textDark:     "#F0EDE8",   // un poco más cálido, menos frío que puro blanco
  subDark:      "#9A948F",   // más claro que antes para mejor legibilidad en textos pequeños
  bgLight:      "#F4F5F7",
  surfaceLight: "#FFFFFF",
  textLight:    "#0D0D0D",
  subLight:     "#5E5C58",
  positive:      "#22C55E",
  positiveLight: "#15803D",
  negative:      "#F43F5E",
  negativeLight: "#B91C1C",
};

export type ThemeMode = "dark" | "light";

export interface ThemeColors {
  bg:       string;
  surface:  string;
  text:     string;
  sub:      string;
  amber:    string;
  red:      string;
  positive: string;
  negative: string;
  blue:     string;
  border:   string;
  isDark:   boolean;
}

export function getThemeColors(mode: ThemeMode): ThemeColors {
  const isDark = mode === "dark";
  return {
    bg:       isDark ? Colors.bgDark       : Colors.bgLight,
    surface:  isDark ? Colors.surfaceDark  : Colors.surfaceLight,
    text:     isDark ? Colors.textDark     : Colors.textLight,
    sub:      isDark ? Colors.subDark      : Colors.subLight,
    amber:    isDark ? Colors.amber        : Colors.amberLight,
    red:      isDark ? Colors.red          : Colors.redLight,
    positive: isDark ? Colors.positive     : Colors.positiveLight,
    negative: isDark ? Colors.negative     : Colors.negativeLight,
    blue:     Colors.blue,
    border:   isDark ? "#2E3240"           : "#E2E4E8",
    isDark,
  };
}