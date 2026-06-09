import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  collection, getDocs, query, where, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
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
  peluqueroUid?:   string;
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

const ESTADO_ICON: Record<string, string> = {
  pendiente:  "schedule",
  confirmada: "event-available",
  aplazada:   "event-repeat",
  negada:     "event-busy",
  completada: "task-alt",
  fallida:    "cancel",
};

export function ClienteHistorialScreen() {
  const c = useThemeColors();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReservas = async () => {
    if (!user?.uid) return;
    try {
      const snap = await getDocs(query(
        collection(db, "reservas"),
        where("clienteUid", "==", user.uid),
        orderBy("fecha", "desc")
      ));
      setReservas(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Reserva));
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadReservas(); }, [user?.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReservas();
    setRefreshing(false);
  };

  const formatFecha = (ts: Timestamp) =>
    ts.toDate().toLocaleDateString("es-CO", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });

  // Group by month
  const grouped: Record<string, Reserva[]> = {};
  reservas.forEach(r => {
    const key = r.fecha.toDate().toLocaleDateString("es-CO", { month: "long", year: "numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  return (
    <ScreenWrapper>
      <BackHeader title="Mis citas" />

      {loading ? (
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      ) : reservas.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="event-busy" size={52} color={c.sub} />
          <Text style={[styles.emptyTitle, { color: c.text }]}>Sin historial aún</Text>
          <Text style={[styles.emptyDesc,  { color: c.sub  }]}>
            Tus citas aparecerán aquí una vez que agendes
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} />}>
          {Object.entries(grouped).map(([mes, citas]) => (
            <View key={mes} style={styles.grupo}>
              <Text style={[styles.mesLabel, { color: c.sub }]}>
                {mes.toUpperCase()}
              </Text>
              {citas.map((r, i) => (
                <ThemedCard key={i} style={styles.card}>
                  <View style={styles.cardLeft}>
                    <MaterialIcons
                      name={ESTADO_ICON[r.estado] as any ?? "event"}
                      size={22}
                      color={r.estado === "completada" ? c.positive :
                             r.estado === "fallida" || r.estado === "negada" ? c.negative :
                             r.estado === "confirmada" ? c.positive : c.amber}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.servicio, { color: c.text }]}>{r.servicio}</Text>
                    <Text style={[styles.fecha,    { color: c.sub  }]}>
                      {formatFecha(r.fecha)} · {r.hora}
                    </Text>
                    {r.precio && (
                      <Text style={[styles.precio, { color: c.amber }]}>
                        ${r.precio.toLocaleString("es-CO")}
                      </Text>
                    )}
                    {r.estado === "aplazada" && r.peluqueroUid && (
                      <TouchableOpacity
                        onPress={() => navigation.navigate("ClienteReagendar", {
                          reservaId:       r.id,
                          servicio:        r.servicio,
                          peluqueroUid:    r.peluqueroUid,
                          peluqueroNombre: r.peluqueroNombre ?? "Barbero",
                        })}
                        style={[styles.reagendarBtn, { borderColor: c.amber + "66", backgroundColor: c.amber + "18" }]}
                      >
                        <MaterialIcons name="event-repeat" size={14} color={c.amber} />
                        <Text style={[styles.reagendarBtnText, { color: c.amber }]}>Reagendar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TagChip label={r.estado} variant={ESTADO_CHIP[r.estado] ?? "default"} />
                </ThemedCard>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll:     { padding: 20, gap: 20 },
  empty:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "Syne_700Bold" },
  emptyDesc:  { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", textAlign: "center" },
  grupo:      { gap: 10 },
  mesLabel:   { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  card:       { flexDirection: "row", alignItems: "center", gap: 12 },
  cardLeft:   { width: 36, alignItems: "center" },
  servicio:   { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  fecha:      { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  precio:     { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  reagendarBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 4, paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8, borderWidth: 1, alignSelf: "flex-start",
  },
  reagendarBtnText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
});
