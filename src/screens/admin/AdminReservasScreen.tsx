import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, TouchableOpacity, ActivityIndicator, Alert,
  RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  collection, getDocs, addDoc, query, orderBy,
  doc, updateDoc, Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { notificarCambioEstado, cancelarRecordatorio } from "../../services/notifications";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";

interface Reserva {
  id:            string;
  clienteNombre: string;
  clienteEmail:  string;
  clienteUid?:   string;
  servicio:      string;
  precio?:       number;
  fecha:         Timestamp;
  hora:          string;
  estado:        "pendiente" | "confirmada" | "aplazada" | "negada" | "completada";
  noRegistrado?: boolean;
}

const ESTADO_CHIP: Record<string, any> = {
  pendiente:   "warning",
  confirmada:  "success",
  aplazada:    "info",
  negada:      "danger",
  completada:  "default",
  fallida:     "danger",
};

export function AdminReservasScreen() {
  const c = useThemeColors();
  const navigation = useNavigation<any>();
  const [reservas,   setReservas]   = useState<Reserva[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<"todas" | "pendiente" | "confirmada">("todas");

  const loadReservas = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "reservas"), orderBy("fecha", "asc"))
      );
      setReservas(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Reserva));
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadReservas(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReservas();
    setRefreshing(false);
  };

  const cambiarEstado = async (reserva: Reserva, nuevoEstado: Reserva["estado"]) => {
    const labels: Record<string, string> = {
      confirmada: "Confirmar",
      aplazada:   "Aplazar",
      negada:     "Negar",
    };
    Alert.alert(
      `${labels[nuevoEstado]} reserva`,
      `¿${labels[nuevoEstado]} la cita de ${reserva.clienteNombre}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: labels[nuevoEstado],
          style: nuevoEstado === "negada" ? "destructive" : "default",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "reservas", reserva.id), {
                estado: nuevoEstado,
                updatedAt: Timestamp.now(),
              });
              setReservas(prev =>
                prev.map(r => r.id === reserva.id ? { ...r, estado: nuevoEstado } : r)
              );
              // Notificar al cliente
              notificarCambioEstado(reserva.clienteUid, reserva.clienteNombre, reserva.servicio, nuevoEstado, reserva.hora);
              if (nuevoEstado === "negada" || nuevoEstado === "aplazada") cancelarRecordatorio(reserva.id);
            } catch {
              Alert.alert("Error", "No se pudo actualizar.");
            }
          },
        },
      ]
    );
  };

  // ── NUEVO: marcar servicio como realizado y registrar ingreso ──
  const marcarCompletado = async (reserva: Reserva) => {
    Alert.alert(
      "¿Servicio realizado?",
      `Confirma que se realizó el servicio a ${reserva.clienteNombre}. Esto registrará el ingreso.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, completado",
          onPress: async () => {
            try {
              const ahora = Timestamp.now();
              // 1. Actualizar estado de la reserva
              await updateDoc(doc(db, "reservas", reserva.id), {
                estado:           "completada",
                fechaCompletado:  ahora,
                updatedAt:        ahora,
              });
              // 2. Registrar ingreso en colección servicios_realizados
              await addDoc(collection(db, "servicios_realizados"), {
                reservaId:     reserva.id,
                clienteNombre: reserva.clienteNombre,
                clienteUid:    reserva.clienteUid ?? null,
                servicio:      reserva.servicio,
                precio:        reserva.precio ?? 0,
                fecha:         ahora,
                estado:        "completado",
              });
              setReservas(prev =>
                prev.map(r => r.id === reserva.id ? { ...r, estado: "completada" } : r)
              );
              notificarCambioEstado(reserva.clienteUid, reserva.clienteNombre, reserva.servicio, "completada", reserva.hora);
              Alert.alert("✅ Ingreso registrado", `Servicio completado para ${reserva.clienteNombre}`);
            } catch {
              Alert.alert("Error", "No se pudo registrar el servicio.");
            }
          },
        },
      ]
    );
  };

  // ── Marcar servicio fallido ──
  const marcarFallido = async (reserva: Reserva) => {
    Alert.alert(
      "¿Servicio fallido?",
      `¿Marcar como fallido el servicio de ${reserva.clienteNombre}? No se registrará ingreso.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Marcar fallido",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "reservas", reserva.id), {
                estado: "fallida", updatedAt: Timestamp.now(),
              });
              setReservas(prev =>
                prev.map(r => r.id === reserva.id ? { ...r, estado: "fallida" as any } : r)
              );
              notificarCambioEstado(reserva.clienteUid, reserva.clienteNombre, reserva.servicio, "fallida", reserva.hora);
            } catch {
              Alert.alert("Error", "No se pudo actualizar.");
            }
          },
        },
      ]
    );
  };

  const filtered = reservas.filter(r =>
    filter === "todas" ? true : r.estado === filter
  );

  const formatFecha = (ts: Timestamp) => {
    const d = ts.toDate();
    return d.toLocaleDateString("es-CO", {
      weekday: "short", day: "numeric", month: "short"
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Reservas</Text>
        <TouchableOpacity
          style={[styles.addBtn, { borderColor: c.border }]}
          onPress={() => navigation.navigate("AdminNuevaReserva")}
        >
          <MaterialIcons name="add" size={20} color={c.text} />
        </TouchableOpacity>
      </View>

      {/* Filtros */}
      <View style={[styles.filterRow, { borderBottomColor: c.border }]}>
        {(["todas","pendiente","confirmada"] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.filterBtn,
              filter === f && { borderBottomWidth: 2, borderBottomColor: c.amber },
            ]}
          >
            <Text style={[
              styles.filterText,
              { color: filter === f ? c.amber : c.sub },
            ]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="event-busy" size={48} color={c.sub} />
              <Text style={[styles.emptyText, { color: c.sub }]}>Sin reservas</Text>
            </View>
          ) : (
            filtered.map((r, i) => (
              <ThemedCard key={i} style={styles.card}>
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.clienteNombre, { color: c.text }]}>
                        {r.clienteNombre}
                      </Text>
                      {r.noRegistrado && (
                        <TagChip label="Sin registro" variant="default" />
                      )}
                    </View>
                    <Text style={[styles.servicio, { color: c.amber }]}>
                      {r.servicio}
                      {r.precio ? `  ·  $${r.precio.toLocaleString("es-CO")}` : ""}
                    </Text>
                  </View>
                  <TagChip label={r.estado} variant={ESTADO_CHIP[r.estado]} />
                </View>

                {/* Fecha y hora */}
                <View style={styles.fechaRow}>
                  <MaterialIcons name="event" size={14} color={c.sub} />
                  <Text style={[styles.fechaText, { color: c.sub }]}>
                    {formatFecha(r.fecha)} — {r.hora}
                  </Text>
                </View>

                {/* Acciones pendiente */}
                {r.estado === "pendiente" && (
                  <View style={[styles.actionsRow, { borderTopColor: c.border }]}>
                    <TouchableOpacity
                      onPress={() => cambiarEstado(r, "confirmada")}
                      style={[styles.actionBtn, { backgroundColor: c.positive + "18" }]}
                    >
                      <MaterialIcons name="check" size={16} color={c.positive} />
                      <Text style={[styles.actionBtnText, { color: c.positive }]}>Confirmar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => cambiarEstado(r, "aplazada")}
                      style={[styles.actionBtn, { backgroundColor: c.amber + "18" }]}
                    >
                      <MaterialIcons name="schedule" size={16} color={c.amber} />
                      <Text style={[styles.actionBtnText, { color: c.amber }]}>Aplazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => cambiarEstado(r, "negada")}
                      style={[styles.actionBtn, { backgroundColor: c.negative + "18" }]}
                    >
                      <MaterialIcons name="close" size={16} color={c.negative} />
                      <Text style={[styles.actionBtnText, { color: c.negative }]}>Negar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Botones para reservas confirmadas */}
                {r.estado === "confirmada" && (
                  <View style={styles.confirmadaRow}>
                    <TouchableOpacity
                      onPress={() => marcarCompletado(r)}
                      style={[styles.confirmadaBtn, { backgroundColor: c.positive + "18", borderColor: c.positive + "44" }]}
                    >
                      <MaterialIcons name="task-alt" size={16} color={c.positive} />
                      <Text style={[styles.confirmadaBtnText, { color: c.positive }]}>Realizado</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => marcarFallido(r)}
                      style={[styles.confirmadaBtn, { backgroundColor: c.negative + "18", borderColor: c.negative + "44" }]}
                    >
                      <MaterialIcons name="cancel" size={16} color={c.negative} />
                      <Text style={[styles.confirmadaBtnText, { color: c.negative }]}>Fallido</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  header: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20,
    paddingVertical: 16, borderBottomWidth: 1,
  },
  title:   { fontSize: 22, fontFamily: "Syne_700Bold" },
  addBtn:  {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, justifyContent: "center", alignItems: "center",
  },
  filterRow: {
    flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20,
  },
  filterBtn:  { paddingVertical: 12, paddingHorizontal: 16 },
  filterText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  scroll:     { padding: 20, gap: 12 },
  empty:      { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText:  { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  card:       { gap: 12 },
  cardTop:    { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  nameRow:    { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  clienteNombre: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  servicio:      { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium" },
  fechaRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  fechaText:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  actionsRow: {
    flexDirection: "row", gap: 8,
    paddingTop: 12, borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 4,
    paddingVertical: 8, borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  confirmadaRow: {
    flexDirection: "row", gap: 8,
  },
  confirmadaBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  confirmadaBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
});
