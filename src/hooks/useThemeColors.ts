import { useThemeStore } from "../store/themeStore";
import { getThemeColors, ThemeColors } from "../theme/colors";

export function useThemeColors(): ThemeColors & {
  mode: "dark" | "light";
  toggle: () => void;
} {
  const { mode, toggleTheme } = useThemeStore();
  const colors = getThemeColors(mode);
  return {
    ...colors,
    mode,
    toggle: toggleTheme,
  };
}