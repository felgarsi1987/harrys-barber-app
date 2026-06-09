import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useThemeColors";
import { AixonFooter }    from "../../components/ui/AixonFooter";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface Props {
  onRetry?: () => void;
}

export function SinConexionScreen({ onRetry }: Props) {
  const c = useThemeColors();

  return (
    <ScreenWrapper>
      <View style={styles.container}>

        <View style={[styles.iconBox, { borderColor: c.border }]}>
          <MaterialIcons name="wifi-off" size={48} color={c.sub} />
        </View>

        <View style={styles.textBlock}>
          <Text style={[styles.titulo, { color: c.text }]}>Sin conexión</Text>
          <Text style={[styles.desc, { color: c.sub }]}>
            No pudimos conectarnos a internet. Verifica tu conexión e intenta de nuevo.
          </Text>
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
      <AixonFooter />
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
  desc:   { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", textAlign: "center", lineHeight: 22 },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  btnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});