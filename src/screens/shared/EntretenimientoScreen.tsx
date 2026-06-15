import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useThemeColors }    from "../../hooks/useThemeColors";
import { ScreenWrapper }     from "../../components/ui/ScreenWrapper";
import { MarcadoresWidget }  from "../../components/widgets/MarcadoresWidget";
import { FutbolWidget }      from "../../components/widgets/FutbolWidget";

export function EntretenimientoScreen() {
  const c = useThemeColors();

  return (
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={styles.emoji}>⚽</Text>
        <View>
          <Text style={[styles.titulo, { color: c.text }]}>Mientras esperas</Text>
          <Text style={[styles.sub, { color: c.amber }]}>tu turno</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.widgetWrap, { borderBottomColor: c.border }]}>
          <MarcadoresWidget />
        </View>

        <View style={styles.widgetWrap}>
          <FutbolWidget />
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  emoji:  { fontSize: 28 },
  titulo: { fontSize: 20, fontFamily: "Syne_700Bold" },
  sub:    { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium", marginTop: -2 },
  scroll: { padding: 20, gap: 0 },
  widgetWrap: { paddingBottom: 24, marginBottom: 24, borderBottomWidth: 1 },
});
