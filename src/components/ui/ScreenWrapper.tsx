/**
 * ScreenWrapper — solución definitiva Android edge-to-edge.
 * Usa windowSoftInputMode="adjustResize" + paddingBottom dinámico.
 */
import React from "react";
import { View, StyleSheet, Platform, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../hooks/useThemeColors";

interface Props {
  children:   React.ReactNode;
  style?:     ViewStyle;
  noPadding?: boolean;
}

export function ScreenWrapper({ children, style, noPadding = false }: Props) {
  const c      = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.bg,
          paddingTop:    noPadding ? 0 : insets.top,
          paddingBottom: insets.bottom,
          paddingLeft:   insets.left,
          paddingRight:  insets.right,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
