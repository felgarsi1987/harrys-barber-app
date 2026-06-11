import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, getDocs, query, where, Timestamp,
} from "firebase/firestore";
import { db }             from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface Reserva {
  id:              string;
  servicio:        string;
  precio?:         number;
  hora:            string;
  fecha:           Timestamp;
  estado:          string;
  peluqueroNombre?: string;
}

const ESTADO_CHIP: Record<string, any> = {
  pendiente:  "warning",
  confirmada: "success",
  aplazada:   "info",
  negada:     "danger",
  completada: "default",
  fallida:    "danger",
};

type Tab = "activas" | "historial";

export function ClienteHistorialScreen() {
  const c = useThemeColors();
  const { user } = useAuthStore();
  const [reservas,   setReservas]   = useState<Reserva[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState<Tab>("activas");

  const load = async () => {
    if (!user?.uid) { setLoading(false); return; }
    try {
      const snap = await getDocs(query(
        collection(db, "reservas"),
        where("clienteUid", "==", user.uid)
      ));
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Reserva)
        .sort((a, b) => b.fecha.toMillis() - a.fecha.toMillis());
      setReservas(data);
    } catch(e) { /* */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user?.uid]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const formatFecha = (ts: Timestamp) =>
    ts.toDate().toLocaleDateString("es-CO", {
      weekday: "short", day: "numeric", month: "short",
    });

  const activas   = reservas.filter(r => ["pendiente","confirmada","aplazada"].includes(r.estado));
  const historial = reservas.filter(r => ["completada","fallida","negada"].includes(r.estado));
  const mostrar   = tab === "activas" ? activas : historial;

  return (
    <ScreenWrapper keyboard={false}>
      <BackHeader title="Mis citas" />

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: c.border }]}>
        {([
          { key: "activas",   label: "Activas",   count: activas.length },
          { key: "historial", label: "Historial",  count: historial.length },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tabBtn, tab === t.key && { borderBottomWidth: 2, borderBottomColor: c.amber }]}
          >
            <View style={styles.tabInner}>
              <Text style={[styles.tabText, { color: tab === t.key ? c.amber : c.sub }]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={[styles.badge, { backgroundColor: tab === t.key ? c.amber : c.border }]}>
                  <Text style={[styles.badgeText, { color: tab === t.key ? "#000" : c.sub }]}>{t.count}</Text>
                </View>
              )}
            </View>
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
          {mostrar.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="event-note" size={48} color={c.sub} />
              <Text style={[styles.emptyText, { color: c.sub }]}>
                {tab === "activas" ? "No tienes citas activas" : "Sin historial de citas"}
              </Text>
            </View>
          ) : (
            mostrar.map((r, i) => (
              <ThemedCard key={i} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.servicio, { color: c.text }]}>{r.servicio}</Text>
                    {r.peluqueroNombre && (
                      <Text style={[styles.peluquero, { color: c.sub }]}>
                        Barbero: {r.peluqueroNombre}
                      </Text>
                    )}
                    <View style={styles.fechaRow}>
                      <MaterialIcons name="event" size={13} color={c.sub} />
                      <Text style={[styles.fecha, { color: c.sub }]}>
                        {formatFecha(r.fecha)} — {r.hora}
                      </Text>
                    </View>
                    {r.precio ? (
                      <Text style={[styles.precio, { color: c.amber }]}>
                        ${r.precio.toLocaleString("es-CO")}
                      </Text>
                    ) : null}
                  </View>
                  <TagChip label={r.estado} variant={ESTADO_CHIP[r.estado] ?? "default"} />
                </View>
              </ThemedCard>
            ))
          )}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  tabs:      { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20 },
  tabBtn:    { paddingVertical: 12, paddingHorizontal: 16 },
  tabInner:  { flexDirection: "row", alignItems: "center", gap: 6 },
  tabText:   { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  badge:     { minWidth: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold" },
  scroll:    { padding: 20, gap: 12 },
  empty:     { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  card:      { gap: 8 },
  cardHeader:{ flexDirection: "row", alignItems: "flex-start", gap: 12 },
  servicio:  { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  peluquero: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  fechaRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  fecha:     { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  precio:    { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
});
