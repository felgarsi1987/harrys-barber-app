import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useThemeColors } from "../../hooks/useThemeColors";

interface Props {
  title: string;
}

export function BackHeader({ title }: Props) {
  const c = useThemeColors();
  const navigation = useNavigation();

  return (
    <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.bg }]}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[styles.backBtn, { backgroundColor: c.surface, borderColor: c.border }]}
        activeOpacity={0.7}
      >
        <MaterialIcons name="arrow-back" size={20} color={c.text} />
      </TouchableOpacity>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection:    "row",
    alignItems:       "center",
    paddingHorizontal: 16,
    paddingVertical:   12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  title:       { flex: 1, fontSize: 20, fontFamily: "Syne_700Bold" },
  placeholder: { width: 36 },
});
