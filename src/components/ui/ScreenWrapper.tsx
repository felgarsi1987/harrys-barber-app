/**
 * ScreenWrapper — reemplaza SafeAreaView en todas las pantallas.
 * 
 * Solución definitiva para Android edge-to-edge:
 * - Usa StatusBar.currentHeight para el padding top
 * - Usa useSafeAreaInsets() para bottom/left/right
 * - KeyboardAvoidingView solo en iOS (en Android causa más problemas que soluciona)
 * - En Android el teclado se maneja con softwareKeyboardLayoutMode: "pan" en app.json
 */
import React from "react";
import {
  View, StyleSheet, StatusBar,
  Platform, ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../hooks/useThemeColors";

interface Props {
  children:  React.ReactNode;
  style?:    ViewStyle;
  noPadding?: boolean;
}

export function ScreenWrapper({ children, style, noPadding = false }: Props) {
  const c      = useThemeColors();
  const insets = useSafeAreaInsets();

  // En Android, StatusBar.currentHeight es la altura real de la barra de estado.
  // useSafeAreaInsets().top puede ser 0 en algunos dispositivos con edge-to-edge.
  // Tomamos el máximo de los dos para garantizar que siempre haya padding suficiente.
  const paddingTop = noPadding ? 0 : Math.max(
    insets.top,
    Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0
  );

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.bg,
          paddingTop,
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
