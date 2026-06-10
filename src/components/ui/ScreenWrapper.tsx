/**
 * ScreenWrapper — reemplaza SafeAreaView en todas las pantallas.
 *
 * Con NavigationBar en modo "absolute" (transparente), los insets de
 * react-native-safe-area-context devuelven los valores REALES de las
 * barras del sistema (status bar arriba + nav bar abajo).
 *
 * Esto garantiza que el contenido NUNCA quede detrás de las barras,
 * sin importar si el dispositivo usa botones físicos, gestos, o
 * nav bar con 2/3 botones.
 */
import React from "react";
import {
  View, KeyboardAvoidingView, Platform,
  StyleSheet, ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors }    from "../../hooks/useThemeColors";

interface Props {
  children:  React.ReactNode;
  style?:    ViewStyle;
  /** false en pantallas que no tienen inputs (listas, dashboards) */
  keyboard?: boolean;
}

export function ScreenWrapper({ children, style, keyboard = true }: Props) {
  const c      = useThemeColors();
  const insets = useSafeAreaInsets();

  const inner = (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.bg,
          // Respetar las barras del sistema con insets reales
          paddingTop:    insets.top,
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

  if (!keyboard) return inner;

  return (
    <KeyboardAvoidingView
      style={[styles.kav, { backgroundColor: c.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {inner}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kav:  { flex: 1 },
});
