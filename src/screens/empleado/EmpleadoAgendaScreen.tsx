import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
  RefreshControl,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  collection, getDocs, addDoc, query, where,
  doc, updateDoc, getDoc, Timestamp, orderBy,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

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
  const { user } = useAuthStore();
  const [reservas,  setReservas]  = useState<Reserva[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [diaOffset,      setDiaOffset]      = useState(7);
  const diasScrollRef = useRef<ScrollView>(null);
  const [tab,            setTab]            = useState<"agenda" | "Pendientes">("agenda");
  const [pendingAll,     setPendingAll]     = useState<Reserva[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

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

  const PAST_DAYS = 7;
  const fechaSeleccionada = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (diaOffset - PAST_DAYS));
    return d;
  })();

  const marcarCompletado = async (reserva: Reserva) => {
    const esRegistrado = !!reserva.clienteUid && !reserva.noRegistrado;
    const opciones: any[] = [
      { text: "Cancelar", style: "cancel" },
      { text: "💵 De contado", onPress: () => completarConModalidad(reserva, "contado") },
    ];
    if (esRegistrado) {
      opciones.push({ text: "💳 A crédito", onPress: () => completarConModalidad(reserva, "credito") });
    }
    Alert.alert("¿Cómo se pagó?", `${reserva.clienteNombre} — ${reserva.servicio}`, opciones);
  };

  const completarConModalidad = async (reserva: Reserva, modalidad: "contado" | "credito") => {
    try {
      const ahora = Timestamp.now();
      await updateDoc(doc(db, "reservas", reserva.id), {
        estado: "completada", fechaCompletado: ahora, updatedAt: ahora, modalidadPago: modalidad,
      });
      await addDoc(collection(db, "servicios_realizados"), {
        reservaId: reserva.id, clienteNombre: reserva.clienteNombre,
        clienteUid: reserva.clienteUid ?? null,
        peluqueroUid: user?.uid ?? null,
        peluqueroNombre: user ? `${user.nombre} ${user.apellido}` : null,
        servicio: reserva.servicio, precio: reserva.precio ?? 0,
        fecha: ahora, estado: "aprobado", modalidadPago: modalidad,
      });
      if (modalidad === "credito" && reserva.clienteUid) {
        const userRef  = doc(db, "users", reserva.clienteUid);
        const userSnap = await getDoc(userRef);
        const saldo = userSnap.exists() ? (userSnap.data().saldo ?? 0) : 0;
        await updateDoc(userRef, { saldo: saldo + (reserva.precio ?? 0) });
        await addDoc(collection(db, "movimientos"), {
          clienteUid: reserva.clienteUid, tipo: "cargo",
          descripcion: `Servicio: ${reserva.servicio}`,
          monto: reserva.precio ?? 0, fecha: ahora,
        });
      }
      setReservas(prev => prev.map(r => r.id === reserva.id ? { ...r, estado: "completada" } : r));
      Alert.alert("✅ Listo", `${modalidad === "credito" ? "A crédito" : "De contado"}`);
    } catch { Alert.alert("Error", "No se pudo registrar."); }
  };

  const fechaStr = fechaSeleccionada.toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long",
  }).toUpperCase();

  const loadReservas = async () => {
    const inicio = new Date(fechaSeleccionada);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(fechaSeleccionada);
    fin.setHours(23, 59, 59, 999);
    try {
      const snap = await getDocs(query(
        collection(db, "reservas"),
        where("fecha", ">=", Timestamp.fromDate(inicio)),
        where("fecha", "<=", Timestamp.fromDate(fin)),
        orderBy("fecha", "asc")
      ));
      const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Reserva);
      setReservas(todas.filter(r => r.peluqueroUid === user?.uid));
    } catch(e) { /* */ }
    finally { setLoading(false); }
  };

  // Auto-cancelar reservas pendientes cuya hora ya pasó
  useEffect(() => {
    const cancelarVencidas = async () => {
      const ahora = new Date();
      try {
        const snap = await getDocs(query(
          collection(db, "reservas"),
          where("estado", "==", "pendiente"),
          where("fecha", "<", Timestamp.fromDate(ahora)),
        ));
        await Promise.all(snap.docs.map(d =>
          updateDoc(doc(db, "reservas", d.id), { estado: "cancelada", updatedAt: Timestamp.now() })
        ));
      } catch {}
    };
    cancelarVencidas();
  }, []);

  useEffect(() => {
    setLoading(true);
    loadReservas();
  }, [diaOffset]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReservas();
    setRefreshing(false);
  };

  const loadPendingAll = async () => {
    setLoadingPending(true);
    try {
      const snap = await getDocs(query(
        collection(db, "reservas"),
        where("estado", "==", "pendiente")
      ));
      setPendingAll(snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Reserva)
        .sort((a,b) => a.fecha.toMillis() - b.fecha.toMillis())
      );
    } catch {}
    finally { setLoadingPending(false); }
  };

  const cancelarReserva = async (reserva: Reserva) => {
    Alert.alert(
      "¿Cancelar cita?",
      `¿Cancelar la cita de ${reserva.clienteNombre}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Cancelar cita", style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "reservas", reserva.id), {
                estado: "cancelada", updatedAt: Timestamp.now(),
              });
              setReservas(prev =>
                prev.map(r => r.id === reserva.id ? { ...r, estado: "cancelada" } : r)
              );
            } catch { Alert.alert("Error", "No se pudo cancelar."); }
          },
        },
      ]
    );
  };

  const aprobarReserva = async (reserva: Reserva) => {
    try {
      await updateDoc(doc(db, "reservas", reserva.id), { estado: "confirmada", updatedAt: Timestamp.now() });
      setPendingAll(prev => prev.filter(r => r.id !== reserva.id));
    } catch {}
  };

  const dias = Array.from({ length: 15 }, (_, i) => {  // 7 past + today + 7 future
    const d = new Date();
    d.setDate(d.getDate() - 7 + i);
    return d;
  });

  return (
    <ScreenWrapper>
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

      {/* Tabs */}
      <View style={[styles.tabsRow, { borderBottomColor: c.border }]}>
        {(["agenda", ...(user?.canApproveReservas ? ["Pendientes"] : [])] as const).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => {
              setTab(t as any);
              if (t === "Pendientes") loadPendingAll();
            }}
            style={[styles.tabBtn, tab === t && { borderBottomWidth: 2, borderBottomColor: c.amber }]}
          >
            <Text style={[styles.tabText, {
              color: tab === t ? c.amber : c.sub,
              fontFamily: tab === t ? "SpaceGrotesk_600SemiBold" : "SpaceGrotesk_400Regular",
            }]}>
              {t === "agenda" ? "Agenda" : `Pendientes${pendingAll.length > 0 ? ` (${pendingAll.length})` : ""}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TAB AGENDA ── */}
      {tab === "agenda" && (<>

      {/* Selector de días */}
      <ScrollView
        ref={diasScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.diasRow, { borderBottomColor: c.border }]}
        onLayout={() => {
          // Scroll para centrar "hoy" (índice 7 de 15 días, ~80px por día)
          diasScrollRef.current?.scrollTo({ x: 7 * 80 - 80, animated: false });
        }}
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
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} />}>
          {reservas.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="event-busy" size={48} color={c.sub} />
              <Text style={[styles.emptyText, { color: c.sub }]}>
                Sin citas para este día
              </Text>
            </View>
          ) : (
            reservas.map((r, i) => (
              <Animated.View key={r.id} entering={FadeInDown.delay(i * 60).duration(350)}>
              <ThemedCard
                style={styles.reservaCard}
                accent
                accentColor={
                  r.estado === "confirmada" ? c.positive :
                  r.estado === "pendiente"  ? c.amber :
                  r.estado === "completada" ? c.blue :
                  r.estado === "fallida" || r.estado === "cancelada" ? c.negative :
                  c.border
                }
              >
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
                        style={[styles.confirmadaBtn, { backgroundColor: c.amber + "18", borderColor: c.amber + "44" }]}
                      >
                        <MaterialIcons name="event-busy" size={14} color={c.amber} />
                        <Text style={[styles.confirmadaBtnText, { color: c.amber }]}>Fallido</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => cancelarReserva(r)}
                        style={[styles.confirmadaBtn, { backgroundColor: c.negative + "18", borderColor: c.negative + "44" }]}
                      >
                        <MaterialIcons name="cancel" size={14} color={c.negative} />
                        <Text style={[styles.confirmadaBtnText, { color: c.negative }]}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </ThemedCard>
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}

      </>)}

      {/* ── TAB PENDIENTES ── */}
      {tab === "Pendientes" && (
        loadingPending ? (
          <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            {pendingAll.length === 0 ? (
              <View style={styles.empty}>
                <MaterialIcons name="check-circle-outline" size={48} color={c.sub} />
                <Text style={[styles.emptyText, { color: c.sub }]}>Sin reservas pendientes</Text>
              </View>
            ) : (
              pendingAll.map((r, i) => (
                <Animated.View key={r.id} entering={FadeInDown.delay(i * 60).duration(350)}>
                <ThemedCard style={styles.reservaCard}>
                  <View style={[styles.horaBlock, { borderRightColor: c.border }]}>
                    <Text style={[styles.hora, { color: c.amber }]}>{r.hora}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.clienteNombre, { color: c.text }]}>{r.clienteNombre}</Text>
                    <Text style={[styles.servicio, { color: c.sub }]}>{r.servicio}</Text>
                    <Text style={[styles.servicio, { color: c.sub }]}>
                      {r.fecha?.toDate?.().toLocaleDateString("es-CO", {
                        weekday: "short", day: "numeric", month: "short",
                      })}
                    </Text>
                    <View style={styles.confirmadaRow}>
                      <TouchableOpacity
                        onPress={() => aprobarReserva(r)}
                        style={[styles.confirmadaBtn, { backgroundColor: c.positive + "18", borderColor: c.positive + "44" }]}
                      >
                        <MaterialIcons name="check" size={14} color={c.positive} />
                        <Text style={[styles.confirmadaBtnText, { color: c.positive }]}>Confirmar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            await updateDoc(doc(db, "reservas", r.id), { estado: "cancelada", updatedAt: Timestamp.now() });
                            setPendingAll(prev => prev.filter(x => x.id !== r.id));
                          } catch { Alert.alert("Error", "No se pudo negar."); }
                        }}
                        style={[styles.confirmadaBtn, { backgroundColor: c.negative + "18", borderColor: c.negative + "44" }]}
                      >
                        <MaterialIcons name="close" size={14} color={c.negative} />
                        <Text style={[styles.confirmadaBtnText, { color: c.negative }]}>Negar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ThemedCard>
                </Animated.View>
              ))
            )}
          </ScrollView>
        )
      )}

    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  agendarBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  agendarBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  tabsRow: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20 },
  tabBtn:  { paddingVertical: 12, paddingHorizontal: 16 },
  tabText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  diaHist: { fontSize: 10, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
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
  reservaCard: { flexDirection: "row", gap: 16 },
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
  confirmadaBtnText: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
});