import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getMarcadores, PartidoMarcador } from "../../services/marcadorService";
import { useThemeColors } from "../../hooks/useThemeColors";

export function MarcadoresWidget() {
  const c = useThemeColors();
  const [partidos, setPartidos] = useState<PartidoMarcador[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getMarcadores();
      // Solo partidos de hoy (en vivo + terminados + próximos del día)
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);
      const deHoy = data.filter(p => p.fecha >= hoy && p.fecha < manana);
      setPartidos(deHoy);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, []);

  const enVivo  = partidos.filter(p => p.estado === "in");
  const otros   = partidos.filter(p => p.estado !== "in");

  return (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.emoji}>🏆</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.titulo, { color: c.text }]}>Partidos de hoy</Text>
          <Text style={[styles.sub, { color: c.sub }]}>
            {enVivo.length > 0
              ? `${enVivo.length} en vivo ahora`
              : partidos.length > 0
                ? `${partidos.length} partidos programados`
                : "Resultados en tiempo real"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={cargar}
          style={[styles.refreshBtn, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Text style={[styles.refreshTxt, { color: c.sub }]}>↻</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={c.amber} />
          <Text style={[styles.statusTxt, { color: c.sub }]}>Cargando partidos…</Text>
        </View>
      )}

      {!loading && error && (
        <View style={styles.centered}>
          <Text style={{ fontSize: 28 }}>📡</Text>
          <Text style={[styles.statusTxt, { color: c.sub }]}>Sin conexión</Text>
          <TouchableOpacity onPress={cargar} style={[styles.retryBtn, { backgroundColor: c.amber }]}>
            <Text style={styles.retryTxt}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && partidos.length === 0 && (
        <View style={styles.centered}>
          <Text style={{ fontSize: 28 }}>😴</Text>
          <Text style={[styles.statusTxt, { color: c.sub }]}>Sin partidos hoy</Text>
        </View>
      )}

      {!loading && !error && partidos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {/* EN VIVO primero */}
          {enVivo.map((p, i) => (
            <Animated.View key={p.id} entering={FadeInDown.delay(i * 50)}>
              <PartidoCard partido={p} c={c} enVivo />
            </Animated.View>
          ))}
          {/* Terminados y próximos */}
          {otros.map((p, i) => (
            <Animated.View key={p.id} entering={FadeInDown.delay((enVivo.length + i) * 40)}>
              <PartidoCard partido={p} c={c} />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function PartidoCard({ partido: p, c, enVivo = false }: {
  partido: PartidoMarcador;
  c: any;
  enVivo?: boolean;
}) {
  return (
    <View style={[
      styles.card,
      {
        backgroundColor: enVivo ? c.positive + "08" : c.surface,
        borderColor:     enVivo ? c.positive + "50" : c.border,
      },
    ]}>
      {/* Liga + reloj */}
      <View style={styles.cardTop}>
        <Text style={[styles.liga, { color: c.sub }]} numberOfLines={1}>
          {p.ligaEmoji} {p.ligaNombre}
        </Text>
        {enVivo ? (
          <View style={styles.enVivoRow}>
            <View style={[styles.dot, { backgroundColor: c.positive }]} />
            <Text style={[styles.relojVivo, { color: c.positive }]}>{p.reloj}</Text>
          </View>
        ) : (
          <Text style={[styles.reloj, { color: p.estado === "post" ? c.sub : c.amber }]}>
            {p.reloj}
          </Text>
        )}
      </View>

      <EquipoFila equipo={p.local}     enVivo={enVivo} c={c} />
      <View style={[styles.sep, { backgroundColor: c.border }]} />
      <EquipoFila equipo={p.visitante} enVivo={enVivo} c={c} />
    </View>
  );
}

function EquipoFila({ equipo, enVivo, c }: { equipo: any; enVivo: boolean; c: any }) {
  return (
    <View style={styles.equipoRow}>
      {equipo.logo
        ? <Image source={{ uri: equipo.logo }} style={styles.logo} resizeMode="contain" />
        : <View style={[styles.logo, styles.logoPlaceholder, { backgroundColor: c.border }]} />
      }
      <Text style={[styles.equipoNombre, { color: c.text }]} numberOfLines={1}>
        {equipo.nombre}
      </Text>
      <Text style={[
        styles.score,
        { color: enVivo ? c.positive : equipo.score === "-" ? c.sub : c.text },
        enVivo && { fontSize: 18 },
      ]}>
        {equipo.score}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  emoji:       { fontSize: 24 },
  titulo:      { fontSize: 15, fontFamily: "Syne_700Bold" },
  sub:         { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular", marginTop: 1 },
  refreshBtn:  { width: 32, height: 32, borderRadius: 8, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  refreshTxt:  { fontSize: 16, fontFamily: "SpaceGrotesk_600SemiBold" },

  centered:    { alignItems: "center", paddingVertical: 24, gap: 8 },
  statusTxt:   { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  retryBtn:    { marginTop: 4, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  retryTxt:    { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },

  scroll:      { paddingBottom: 4, gap: 10 },

  card:        { width: 190, padding: 12, borderRadius: 14, borderWidth: 1, gap: 8 },
  cardTop:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  liga:        { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", flex: 1 },
  enVivoRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  dot:         { width: 5, height: 5, borderRadius: 3 },
  relojVivo:   { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold" },
  reloj:       { fontSize: 11, fontFamily: "SpaceGrotesk_500Medium" },
  sep:         { height: 1, marginVertical: 2 },

  equipoRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  logo:        { width: 22, height: 22 },
  logoPlaceholder: { borderRadius: 4 },
  equipoNombre:{ flex: 1, fontSize: 13, fontFamily: "SpaceGrotesk_500Medium" },
  score:       { fontSize: 16, fontFamily: "Syne_700Bold", minWidth: 22, textAlign: "right" },
});
