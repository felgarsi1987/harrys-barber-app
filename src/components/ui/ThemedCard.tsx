import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { useThemeColors } from "../../hooks/useThemeColors";
import { Radius, Spacing } from "../../theme/spacing";

interface ThemedCardProps {
  children:  React.ReactNode;
  style?:    ViewStyle;
  padding?:  number;
  elevated?: boolean;
}

export function ThemedCard({
  children,
  style,
  padding = Spacing.md,
  elevated = false,
}: ThemedCardProps) {
  const c = useThemeColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          padding,
          borderColor: c.border,
          shadowOpacity: elevated ? (c.isDark ? 0 : 0.1) : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    borderWidth:  1,
    shadowColor:  "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation:    3,
  },
});