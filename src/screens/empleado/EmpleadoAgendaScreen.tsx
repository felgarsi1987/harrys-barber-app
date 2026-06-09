import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, TouchableOpacity, ActivityIndicator, Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  collection, getDocs, addDoc, query, where,
  doc, updateDoc, Timestamp, orderBy,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";

interface Reserva {
  id:            string;
  clienteNombre: string;
  clienteUid?:   string;
  servicio:      string;
  precio?:       number;
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
  completada: "default",
  fallida:    "danger",
};

const DIAS_SEMANA = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

export function EmpleadoAgendaScreen() {
  const c = useThemeColors();
  const navigation = useNavigation<any>();
  const [reservas,  setReservas]  = useState<Reserva[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [diaOffset, setDiaOffset] = useState(0);

  const marcarFallido = async (reserva: Reserva) => {
    Alert.alert(
      "¿Servicio fallido?",
      `¿Marcar como fallido el servicio de ${reserva.clienteNombre}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Marcar fallido", style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "reservas", reserva.id), {
                estado: "fallida", updatedAt: Timestamp.now(),
              });
              setReservas(prev =>
                prev.map(r => r.id === reserva.id ? { ...r, estado: "fallida" } : r)
              );
            } catch { Alert.alert("Error", "No se pudo actualizar."); }
          },
        },
      ]
    );
  };

  const fechaSeleccionada = (() => {
    const d = new Date();
    d.setDate(d.getDate() + diaOffset);
    return d;
  })();

  const marcarCompletado = async (reserva: Reserva) => {
    Alert.alert(
      "¿Servicio realizado?",
      `¿Confirmas que realizaste el servicio a ${reserva.clienteNombre}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, completado",
          onPress: async () => {
            try {
              const ahora = Timestamp.now();
              await updateDoc(doc(db, "reservas", reserva.id), {
                estado: "completada", fechaCompletado: ahora, updatedAt: ahora,
              });
              await addDoc(collection(db, "servicios_realizados"), {
                reservaId: reserva.id, clienteNombre: reserva.clienteNombre,
                clienteUid: reserva.clienteUid ?? null,
                servicio: reserva.servicio, precio: reserva.precio ?? 0,
                fecha: ahora, estado: "completado",
              });
              setReservas(prev =>
                prev.map(r => r.id === reserva.id ? { ...r, estado: "completada" } : r)
              );
              Alert.alert("✅ Listo", "Servicio registrado como completado.");
            } catch {
              Alert.alert("Error", "No se pudo registrar.");
            }
          },
        },
      ]
    );
  };

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
        <TouchableOpacity
          onPress={() => navigation.navigate("Nueva Cita")}
          style={[styles.agendarBtn, { backgroundColor: c.amber }]}
        >
          <MaterialIcons name="add" size={18} color="#000" />
          <Text style={styles.agendarBtnText}>Agendar</Text>
        </TouchableOpacity>
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
                  {r.estado === "confirmada" && (
                    <View style={styles.confirmadaRow}>
                      <TouchableOpacity
                        onPress={() => marcarCompletado(r)}
                        style={[styles.confirmadaBtn, { backgroundColor: c.positive + "18", borderColor: c.positive + "44" }]}
                      >
                        <MaterialIcons name="task-alt" size={14} color={c.positive} />
                        <Text style={[styles.confirmadaBtnText, { color: c.positive }]}>Realizado</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => marcarFallido(r)}
                        style={[styles.confirmadaBtn, { backgroundColor: c.negative + "18", borderColor: c.negative + "44" }]}
                      >
                        <MaterialIcons name="cancel" size={14} color={c.negative} />
                        <Text style={[styles.confirmadaBtnText, { color: c.negative }]}>Fallido</Text>
                      </TouchableOpacity>
                    </View>
                  )}
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
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  agendarBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  agendarBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
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
  confirmadaRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  confirmadaBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  confirmadaBtnText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
});