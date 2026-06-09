import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export type Categoria = "plata" | "oro" | "diamante";

const CONFIG: Record<Categoria, { icon: string; color: string; bg: string; label: string }> = {
  plata:    { icon: "stars",    color: "#9E9E9E", bg: "#9E9E9E22", label: "Plata" },
  oro:      { icon: "stars",    color: "#FFC107", bg: "#FFC10722", label: "Oro" },
  diamante: { icon: "diamond",  color: "#29B6F6", bg: "#29B6F622", label: "Diamante" },
};

interface Props {
  categoria: Categoria;
  showLabel?: boolean;
}

export function FidelizacionBadge({ categoria, showLabel = true }: Props) {
  const cfg = CONFIG[categoria];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <MaterialIcons name={cfg.icon as any} size={12} color={cfg.color} />
      {showLabel && (
        <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
  },
  label: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold" },
});
