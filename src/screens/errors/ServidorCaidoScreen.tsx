import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface Props {
  onRetry?: () => void;
}

export function ServidorCaidoScreen({ onRetry }: Props) {
  const c = useThemeColors();

  return (
    <ScreenWrapper>
      <View style={styles.container}>

        <View style={[styles.iconBox, { borderColor: c.border }]}>
          <MaterialIcons name="cloud-off" size={48} color={c.sub} />
        </View>

        <View style={styles.textBlock}>
          <Text style={[styles.titulo, { color: c.text }]}>Servidor no disponible</Text>
          <Text style={[styles.desc, { color: c.sub }]}>
            Nuestros servidores están experimentando problemas. Estamos trabajando para resolverlo.
          </Text>
        </View>

        <View style={[styles.statusCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: c.negative }]} />
            <Text style={[styles.statusText, { color: c.text }]}>Servidor principal</Text>
            <Text style={[styles.statusVal, { color: c.negative }]}>Caído</Text>
          </View>
          <View style={[styles.statusDivider, { backgroundColor: c.border }]} />
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: c.amber }]} />
            <Text style={[styles.statusText, { color: c.text }]}>Base de datos</Text>
            <Text style={[styles.statusVal, { color: c.amber }]}>Verificando</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onRetry}
          style={[styles.btn, { borderColor: c.border }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="refresh" size={18} color={c.text} />
          <Text style={[styles.btnText, { color: c.text }]}>Reintentar</Text>
        </TouchableOpacity>

      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 40, gap: 24,
  },
  iconBox: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 1, justifyContent: "center", alignItems: "center",
  },
  textBlock: { alignItems: "center", gap: 8 },
  titulo: { fontSize: 22, fontFamily: "Syne_700Bold", textAlign: "center" },
  desc:   {
    fontSize: 14, fontFamily: "SpaceGrotesk_400Regular",
    textAlign: "center", lineHeight: 22,
  },
  statusCard: {
    width: "100%", borderWidth: 1, borderRadius: 12,
    padding: 16, gap: 12,
  },
  statusRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  statusVal:  { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  statusDivider: { height: 1 },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  btnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});