import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { useThemeColors } from "../../hooks/useThemeColors";
import { Radius, Spacing } from "../../theme/spacing";

interface ThemedCardProps {
  children:     React.ReactNode;
  style?:       StyleProp<ViewStyle>;
  padding?:     number;
  elevated?:    boolean;
  accent?:      boolean;
  accentColor?: string;
}

export function ThemedCard({
  children,
  style,
  padding = Spacing.md,
  elevated = false,
  accent = false,
  accentColor,
}: ThemedCardProps) {
  const c = useThemeColors();
  const stripe = accentColor ?? c.amber;

  const baseStyle = {
    backgroundColor: c.surface,
    borderColor:     c.border,
    shadowOpacity:   elevated && !c.isDark ? 0.1 : 0,
    elevation:       elevated ? 3 : 0,
  };

  if (accent) {
    return (
      <View style={[styles.card, styles.row, baseStyle, style]}>
        <View style={[styles.accentStripe, { backgroundColor: stripe }]} />
        <View style={{ padding, flex: 1 }}>
          {children}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { ...baseStyle, padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius:  Radius.md,
    borderWidth:   1,
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 2 },
    shadowRadius:  6,
    overflow:      "hidden",
  },
  row: {
    flexDirection: "row",
  },
  accentStripe: {
    width: 3,
  },
});
