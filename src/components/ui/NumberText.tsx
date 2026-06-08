import React from "react";
import { Text, TextStyle, StyleSheet } from "react-native";
import { useThemeColors } from "../../hooks/useThemeColors";

interface NumberTextProps {
  children: React.ReactNode;
  size?:     number;
  negative?: boolean;
  positive?: boolean;
  style?:    TextStyle;
}

export function NumberText({
  children,
  size = 16,
  negative = false,
  positive = false,
  style,
}: NumberTextProps) {
  const c = useThemeColors();

  const color = negative
    ? c.negative
    : positive
    ? c.positive
    : c.text;

  return (
    <Text
      style={[
        styles.base,
        { fontSize: size, lineHeight: size * 1.25, color },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: "Syne_700Bold",
  },
});