import React from "react";
import {
  KeyboardAvoidingView, Platform, StyleSheet,
  ViewStyle, StatusBar, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../hooks/useThemeColors";

interface Props {
  children:  React.ReactNode;
  style?:    ViewStyle;
  keyboard?: boolean;
}

export function ScreenWrapper({ children, style, keyboard = true }: Props) {
  const c      = useThemeColors();
  const insets = useSafeAreaInsets();

  const content = (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.bg,
          paddingTop:    insets.top    > 0 ? insets.top    : Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 0,
          paddingLeft:   insets.left,
          paddingRight:  insets.right,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!keyboard) return content;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
