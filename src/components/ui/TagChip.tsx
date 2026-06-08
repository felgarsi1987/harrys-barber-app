import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useThemeColors } from "../../hooks/useThemeColors";
import { Fonts } from "../../theme/typography";
import { Radius, Spacing } from "../../theme/spacing";

type ChipVariant = "default" | "success" | "warning" | "danger" | "info";

interface TagChipProps {
  label:    string;
  variant?: ChipVariant;
}

const variantMap: Record<ChipVariant, { bg: string; text: string }> = {
  default: { bg: "#2A2D35", text: "#F4F2EE" },
  success: { bg: "#14532D", text: "#22C55E" },
  warning: { bg: "#78350F", text: "#F2B90C" },
  danger:  { bg: "#450A0A", text: "#F43F5E" },
  info:    { bg: "#1E3A8A", text: "#93C5FD" },
};

export function TagChip({ label, variant = "default" }: TagChipProps) {
  const c = useThemeColors();
  const palette = variantMap[variant];

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: c.isDark ? palette.bg : palette.bg + "22" },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: c.isDark ? palette.text : palette.bg },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical:   3,
    borderRadius:      Radius.full,
    alignSelf:         "flex-start",
  },
  label: {
    fontFamily:    Fonts.spaceGroteskSemiBold,
    fontSize:      11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});