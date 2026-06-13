import React from "react";
import {
  View, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, ViewStyle, StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors }    from "../../hooks/useThemeColors";

interface Props {
  children:   React.ReactNode;
  style?:     ViewStyle;
  keyboard?:  boolean;
  scrollable?: boolean; // wrap content in ScrollView for forms
}

export function ScreenWrapper({ children, style, keyboard = true, scrollable = false }: Props) {
  const c      = useThemeColors();
  const insets = useSafeAreaInsets();

  const statusBarH = Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 0;
  const paddingTop = insets.top    > 0 ? insets.top    : statusBarH;
  const paddingBot = insets.bottom > 0 ? insets.bottom : 0;

  const containerStyle = [
    styles.root,
    {
      backgroundColor: c.bg,
      paddingTop,
      paddingLeft:  insets.left,
      paddingRight: insets.right,
    },
    style,
  ];

  const content = scrollable ? (
    <ScrollView
      style={[styles.root, { backgroundColor: c.bg }]}
      contentContainerStyle={{ paddingBottom: paddingBot + 20 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={containerStyle}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[containerStyle, { paddingBottom: paddingBot }]}>
      {children}
    </View>
  );

  if (!keyboard) return content;

  return (
    <KeyboardAvoidingView
      style={[styles.kav, { backgroundColor: c.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      keyboardVerticalOffset={Platform.OS === "android" ? 0 : 0}
      enabled
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  kav:  { flex: 1 },
});
