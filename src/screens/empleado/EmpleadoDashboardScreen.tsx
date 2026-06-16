import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, query, where, orderBy, Timestamp, onSnapshot,
} from "firebase/firestore";
import { db }              from "../../services/firebase";
import { useThemeColors }  from "../../hooks/useThemeColors";
import { useAuthStore }    from "../../store/authStore";
import { ThemedCard }      from "../../components/ui/ThemedCard";
import { ScreenWrapper }   from "../../components/ui/ScreenWrapper";
import { SkeletonLoader }  from "../../components/ui/SkeletonLoader";
import { TagChip }         from "../../components/ui/TagChip";
import { useNavigation }   from "@react-navigation/native";

interface Reserva {
  id:            string;
  clienteNombre: string;
  servicio:      string;
  hora:          string;
  fecha:         Timestamp;
  estado:        string;
  peluqueroUid?: string;
}

const ESTADO_CHIP: Record<string, any> = {
  pendiente:  "warning",
  confirmada: "success",
  completada: "default",
  fallida:    "danger",
  cancelada:  "danger",
};

export function EmpleadoDashboardScreen() {
  const c          = useThemeColors();
  const { user }   = useAuthStore();
  const navigation = useNavigation<any>();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading,  setLoading]  = useState(true);

  const ahora      = new Date();
  const horaAhora  = `${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;
  const hora       = ahora.getHours();
  const greeting   = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";
  const fechaLarga = ahora.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  useEffect(() => {
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(); fin.setHours(23, 59, 59, 999);
    const unsub  = onSnapshot(
      query(
        collection(db, "reservas"),
        where("fecha", ">=", Timestamp.fromDate(inicio)),
        where("fecha", "<=", Timestamp.fromDate(fin)),
        orderBy("fecha", "asc")
      ),
      snap => {
        const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Reserva);
        setReservas(todas.filter(r => r.peluqueroUid === user?.uid));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user?.uid]);

  const activas     = reservas.filter(r => ["confirmada","pendiente"].includes(r.estado));
  const completadas = reservas.filter(r => r.estado === "completada");
  const proxima     = activas.filter(r => r.hora >= horaAhora)[0];

  const estadoColor = (estado: string) => {
    if (estado === "confirmada") return c.positive;
    if (estado === "completada") return c.blue ?? c.sub;
    if (estado === "pendiente")  return c.amber;
    return c.negative;
  };

  return (
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View>
          <Text style={[styles.greeting, { color: c.sub }]}>{greeting},</Text>
          <Text style={[styles.nombre, { color: c.text }]}>{user?.nombre ?? "Peluquero"}</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate("Nueva Cita")}
          style={[styles.addBtn, { backgroundColor: c.amber }]}
        >
          <MaterialIcons name="add" size={20} color="#000" />
          <Text style={styles.addBtnText}>Nueva cita</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        <Text style={[styles.fechaHoy, { color: c.sub }]}>{fechaLarga.toUpperCase()}</Text>

        {/* Stats del día */}
        <View style={styles.statsRow}>
          {[
            { num: activas.length,     label: "Activas",     color: c.amber    },
            { num: completadas.length, label: "Completadas", color: c.positive },
            { num: reservas.length,    label: "Total hoy",   color: c.sub      },
          ].map((s, i) => (
            <ThemedCard key={i} style={[styles.statCard, { flex: 1 }]}>
              <Text style={[styles.statNum, { color: s.color }]}>{loading ? "—" : s.num}</Text>
              <Text style={[styles.statLabel, { color: c.sub }]}>{s.label}</Text>
            </ThemedCard>
          ))}
        </View>

        {/* Próxima cita */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>PRÓXIMA CITA</Text>
        {loading ? (
          <SkeletonLoader height={96} />
        ) : proxima ? (
          <ThemedCard accent accentColor={c.amber} style={styles.proximaCard}>
            <View style={[styles.proximaHoraCol, { borderRightColor: c.border }]}>
              <Text style={[styles.proximaHora, { color: c.amber }]}>{proxima.hora}</Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[styles.proximaCliente, { color: c.text }]}>{proxima.clienteNombre}</Text>
              <Text style={[styles.proximaServicio, { color: c.sub }]}>{proxima.servicio}</Text>
              <TagChip label={proxima.estado} variant={ESTADO_CHIP[proxima.estado] ?? "default"} />
            </View>
          </ThemedCard>
        ) : (
          <ThemedCard style={styles.emptyCard}>
            <MaterialIcons name="event-available" size={32} color={c.sub} />
            <Text style={[styles.emptyText, { color: c.sub }]}>Sin más citas hoy</Text>
          </ThemedCard>
        )}

        {/* Agenda del día */}
        <View style={styles.agendaHeader}>
          <Text style={[styles.sectionLabel, { color: c.sub }]}>AGENDA DE HOY</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Agenda")}>
            <Text style={[styles.verTodo, { color: c.amber }]}>Ver todo →</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <SkeletonLoader count={3} height={64} />
        ) : reservas.length === 0 ? (
          <ThemedCard style={styles.emptyCard}>
            <MaterialIcons name="event-busy" size={28} color={c.sub} />
            <Text style={[styles.emptyText, { color: c.sub }]}>No tienes citas hoy</Text>
          </ThemedCard>
        ) : (
          reservas.map(r => (
            <ThemedCard key={r.id} style={styles.citaRow}>
              <Text style={[styles.citaHora, { color: c.amber }]}>{r.hora}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.citaCliente, { color: c.text }]} numberOfLines={1}>{r.clienteNombre}</Text>
                <Text style={[styles.citaServicio, { color: c.sub }]} numberOfLines={1}>{r.servicio}</Text>
              </View>
              <View style={[styles.citaEstadoBadge, { backgroundColor: estadoColor(r.estado) + "22" }]}>
                <Text style={[styles.citaEstadoText, { color: estadoColor(r.estado) }]}>
                  {r.estado === "confirmada" ? "Conf." :
                   r.estado === "completada" ? "Listo" :
                   r.estado === "pendiente"  ? "Pend." : r.estado}
                </Text>
              </View>
            </ThemedCard>
          ))
        )}

      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:     { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting:   { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  nombre:     { fontSize: 22, fontFamily: "Syne_700Bold" },
  addBtn:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  scroll:     { padding: 20, gap: 14 },
  fechaHoy:   { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 1.5 },
  statsRow:   { flexDirection: "row", gap: 10 },
  statCard:   { alignItems: "center", gap: 4, paddingVertical: 14 },
  statNum:    { fontSize: 24, fontFamily: "Inter_700Bold" },
  statLabel:  { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  sectionLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 1.5 },
  agendaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  verTodo:      { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  proximaCard:     { flexDirection: "row", gap: 16, alignItems: "center" },
  proximaHoraCol:  { justifyContent: "center", alignItems: "center", paddingRight: 16, borderRightWidth: 1, minWidth: 72 },
  proximaHora:     { fontSize: 28, fontFamily: "Inter_700Bold" },
  proximaCliente:  { fontSize: 16, fontFamily: "SpaceGrotesk_600SemiBold" },
  proximaServicio: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  emptyCard:  { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyText:  { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  citaRow:         { flexDirection: "row", alignItems: "center", gap: 12 },
  citaHora:        { fontSize: 15, fontFamily: "Inter_700Bold", minWidth: 48 },
  citaCliente:     { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  citaServicio:    { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  citaEstadoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  citaEstadoText:  { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold" },
});
