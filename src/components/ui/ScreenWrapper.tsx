import React from "react";
import {
  View, KeyboardAvoidingView, Platform,
  StyleSheet, ViewStyle, StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors }    from "../../hooks/useThemeColors";

interface Props {
  children:  React.ReactNode;
  style?:    ViewStyle;
  keyboard?: boolean;
}

export function ScreenWrapper({ children, style, keyboard = true }: Props) {
  const c      = useThemeColors();
  const insets = useSafeAreaInsets();

  // On Android, StatusBar.currentHeight is the most reliable fallback
  // when insets.top is 0 (happens on some devices before SafeAreaProvider
  // has measured correctly)
  const statusBarH  = Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0;
  const paddingTop  = insets.top    > 0 ? insets.top    : statusBarH;
  const paddingBot  = insets.bottom > 0 ? insets.bottom : 0;

  const inner = (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.bg,
          paddingTop,
          paddingBottom: paddingBot,
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
