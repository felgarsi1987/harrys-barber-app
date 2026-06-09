/**
 * ScreenWrapper
 * Reemplaza SafeAreaView en todas las pantallas.
 * - Maneja insets de barra de navegación Android (edge-to-edge)
 * - Maneja el teclado con KeyboardAvoidingView
 * - Aplica el color de fondo del tema
 */
import React from "react";
import {
  KeyboardAvoidingView, Platform, StyleSheet,
  ViewStyle, StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../hooks/useThemeColors";

interface Props {
  children: React.ReactNode;
  style?:   ViewStyle;
  /** true por defecto — desactivar solo en pantallas sin inputs */
  keyboard?: boolean;
}

export function ScreenWrapper({ children, style, keyboard = true }: Props) {
  const c      = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        {
          backgroundColor: c.bg,
          paddingTop:    insets.top,
          paddingBottom: insets.bottom,
          paddingLeft:   insets.left,
          paddingRight:  insets.right,
        },
        style,
      ]}
      behavior={keyboard ? (Platform.OS === "ios" ? "padding" : "height") : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : StatusBar.currentHeight ?? 0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
