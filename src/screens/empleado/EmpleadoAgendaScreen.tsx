import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, TouchableOpacity, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, getDocs, query, where,
  Timestamp, orderBy,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";

interface Reserva {
  id:            string;
  clienteNombre: string;
  servicio:      string;
  hora:          string;
  fecha:         Timestamp;
  estado:        string;
  noRegistrado?: boolean;
}

const ESTADO_CHIP: Record<string, any> = {
  pendiente:  "warning",
  confirmada: "success",
  aplazada:   "info",
  negada:     "danger",
};

const DIAS_SEMANA = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

export function EmpleadoAgendaScreen() {
  const c = useThemeColors();
  const [reservas,  setReservas]  = useState<Reserva[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [diaOffset, setDiaOffset] = useState(0);

  const fechaSeleccionada = (() => {
    const d = new Date();
    d.setDate(d.getDate() + diaOffset);
    return d;
  })();

  const fechaStr = fechaSeleccionada.toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long",
  }).toUpperCase();

  useEffect(() => {
    setLoading(true);
    const inicio = new Date(fechaSeleccionada);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaSeleccionada);
    fin.setHours(23, 59, 59, 999);

    getDocs(query(
      collection(db, "reservas"),
      where("fecha", ">=", Timestamp.fromDate(inicio)),
      where("fecha", "<=", Timestamp.fromDate(fin)),
      orderBy("fecha", "asc")
    )).then(snap => {
      setReservas(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Reserva));
    }).catch(console.log)
    .finally(() => setLoading(false));
  }, [diaOffset]);

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Mi agenda</Text>
      </View>

      {/* Selector de días */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.diasRow, { borderBottomColor: c.border }]}
      >
        {dias.map((d, i) => {
          const activo = diaOffset === i;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setDiaOffset(i)}
              style={[
                styles.diaBtn,
                activo && { backgroundColor: c.amber },
              ]}
            >
              <Text style={[styles.diaNombre, { color: activo ? "#000" : c.sub }]}>
                {DIAS_SEMANA[d.getDay()]}
              </Text>
              <Text style={[styles.diaNumero, { color: activo ? "#000" : c.text }]}>
                {d.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Fecha */}
      <View style={[styles.fechaBar, { borderBottomColor: c.border }]}>
        <Text style={[styles.fechaText, { color: c.sub }]}>{fechaStr}</Text>
        <Text style={[styles.citasCount, { color: c.amber }]}>
          {reservas.length} {reservas.length === 1 ? "cita" : "citas"}
        </Text>
      </View>

      {/* Lista */}
      {loading ? (
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {reservas.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="event-busy" size={48} color={c.sub} />
              <Text style={[styles.emptyText, { color: c.sub }]}>
                Sin citas para este día
              </Text>
            </View>
          ) : (
            reservas.map((r, i) => (
              <ThemedCard key={i} style={styles.reservaCard}>
                <View style={[styles.horaBlock, { borderRightColor: c.border }]}>
                  <Text style={[styles.hora, { color: c.amber }]}>{r.hora}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.clienteNombre, { color: c.text }]}>
                    {r.clienteNombre}
                  </Text>
                  <Text style={[styles.servicio, { color: c.sub }]}>
                    {r.servicio}
                  </Text>
                  <View style={styles.tagsRow}>
                    <TagChip
                      label={r.estado}
                      variant={ESTADO_CHIP[r.estado] ?? "default"}
                    />
                    {r.noRegistrado && (
                      <TagChip label="Sin registro" variant="default" />
                    )}
                  </View>
                </View>
              </ThemedCard>
            ))
          )}
        </ScrollView>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  diasRow: {
    paddingHorizontal: 16, paddingVertical: 12,
    gap: 8, borderBottomWidth: 1,
  },
  diaBtn: {
    alignItems: "center", paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 10, gap: 4, minWidth: 52,
  },
  diaNombre:  { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold" },
  diaNumero:  { fontSize: 18, fontFamily: "Syne_700Bold" },
  fechaBar: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  fechaText:  { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 1 },
  citasCount: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  scroll:     { padding: 20, gap: 10 },
  empty:      { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText:  { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  reservaCard: { flexDirection: "row", gap: 16, padding: 14 },
  horaBlock: {
    justifyContent: "center", alignItems: "center",
    paddingRight: 16, borderRightWidth: 1, minWidth: 54,
  },
  hora:          { fontSize: 16, fontFamily: "Syne_700Bold" },
  clienteNombre: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  servicio:      { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  tagsRow:       { flexDirection: "row", gap: 6, marginTop: 4 },
});