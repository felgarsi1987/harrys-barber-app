import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
  RefreshControl,
} from "react-native";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  collection, getDocs, addDoc, query, where,
  doc, updateDoc, getDoc, Timestamp, orderBy, onSnapshot,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";
import { SkeletonLoader } from "../../components/ui/SkeletonLoader";
import { PressableScale } from "../../components/ui/PressableScale";
import { notificarCambioEstado, notificarCancelacion } from "../../services/notifications";

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
  peluqueroUid?: string;
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
const DIAS_SEMANA_LARGO = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

export function EmpleadoAgendaScreen() {
  const c = useThemeColors();
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const [reservas,  setReservas]  = useState<Reserva[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [compacto,       setCompacto]       = useState(false);
  const [diaOffset,      setDiaOffset]      = useState(7);
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
              notificarCambioEstado(reserva.clienteUid, reserva.clienteNombre, reserva.servicio, "fallida", reserva.hora).catch(() => {});
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
  const esHoy = diaOffset === PAST_DAYS;

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
      notificarCambioEstado(reserva.clienteUid, reserva.clienteNombre, reserva.servicio, "completada", reserva.hora).catch(() => {});
      Alert.alert("✅ Listo", `${modalidad === "credito" ? "A crédito" : "De contado"}`);
    } catch { Alert.alert("Error", "No se pudo registrar."); }
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

  // Reservas del día seleccionado, en tiempo real (solo las del peluquero)
  useEffect(() => {
    setLoading(true);
    const inicio = new Date(fechaSeleccionada); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(fechaSeleccionada); fin.setHours(23, 59, 59, 999);
    const unsub = onSnapshot(
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
  }, [diaOffset, user?.uid]);

  const onRefresh = async () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 500); };

  // Pendientes en tiempo real
  const loadPendingAll = () => {};
  useEffect(() => {
    if (!user?.canApproveReservas) return;
    const unsub = onSnapshot(
      query(collection(db, "reservas"), where("estado", "==", "pendiente")),
      snap => setPendingAll(
        snap.docs.map(d => ({ id: d.id, ...d.data() }) as Reserva)
          .sort((a,b) => a.fecha.toMillis() - b.fecha.toMillis())
      ),
      () => {}
    );
    return () => unsub();
  }, [user?.canApproveReservas]);

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
              notificarCancelacion(reserva.clienteUid, reserva.clienteNombre, reserva.servicio, reserva.hora, "empleado").catch(() => {});
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
      notificarCambioEstado(reserva.clienteUid, reserva.clienteNombre, reserva.servicio, "confirmada", reserva.hora).catch(() => {});
    } catch {}
  };

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Mi agenda</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <PressableScale
            onPress={() => setCompacto(v => !v)}
            style={[styles.compactBtn, {
              borderColor:     compacto ? c.amber : c.border,
              backgroundColor: compacto ? c.amber + "18" : "transparent",
            }]}
          >
            <MaterialIcons name={compacto ? "view-list" : "view-agenda"} size={18} color={compacto ? c.amber : c.sub} />
          </PressableScale>
          <PressableScale
            onPress={() => navigation.navigate(user?.role === "admin" ? "AdminNuevaReserva" : "Nueva Cita")}
            style={[styles.agendarBtn, { backgroundColor: c.amber }]}
          >
            <MaterialIcons name="add" size={18} color="#000" />
            <Text style={styles.agendarBtnText}>Agendar</Text>
          </PressableScale>
        </View>
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

      {/* Navegador de día — flechas + fecha grande + Hoy */}
      <View style={[styles.dateNav, { borderBottomColor: c.border }]}>
        <PressableScale onPress={() => setDiaOffset(o => o - 1)} style={[styles.navArrow, { borderColor: c.border }]}>
          <MaterialIcons name="chevron-left" size={24} color={c.text} />
        </PressableScale>

        <PressableScale onPress={() => setDiaOffset(PAST_DAYS)} style={styles.dateCenter}>
          <Text style={[styles.dateWeekday, { color: esHoy ? c.amber : c.text }]}>
            {esHoy ? "HOY" : DIAS_SEMANA_LARGO[fechaSeleccionada.getDay()].toUpperCase()}
          </Text>
          <Text style={[styles.dateFull, { color: c.sub }]}>
            {fechaSeleccionada.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}
          </Text>
        </PressableScale>

        <PressableScale onPress={() => setDiaOffset(o => o + 1)} style={[styles.navArrow, { borderColor: c.border }]}>
          <MaterialIcons name="chevron-right" size={24} color={c.text} />
        </PressableScale>
      </View>

      {/* Resumen del día + atajo a Hoy */}
      <View style={[styles.resumenBar, { borderBottomColor: c.border }]}>
        <View style={styles.resumenChips}>
          <View style={[styles.resumenChip, { backgroundColor: c.positive + "18" }]}>
            <Text style={[styles.resumenChipNum, { color: c.positive }]}>
              {reservas.filter(r => r.estado === "confirmada").length}
            </Text>
            <Text style={[styles.resumenChipLbl, { color: c.positive }]}>confirmadas</Text>
          </View>
          <View style={[styles.resumenChip, { backgroundColor: c.amber + "18" }]}>
            <Text style={[styles.resumenChipNum, { color: c.amber }]}>
              {reservas.filter(r => r.estado === "pendiente").length}
            </Text>
            <Text style={[styles.resumenChipLbl, { color: c.amber }]}>pendientes</Text>
          </View>
        </View>
        {!esHoy && (
          <PressableScale onPress={() => setDiaOffset(PAST_DAYS)} style={[styles.hoyBtn, { backgroundColor: c.amber + "18", borderColor: c.amber + "44" }]}>
            <MaterialIcons name="today" size={14} color={c.amber} />
            <Text style={[styles.hoyBtnText, { color: c.amber }]}>Hoy</Text>
          </PressableScale>
        )}
      </View>

      {/* Lista */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <SkeletonLoader count={4} height={compacto ? 54 : 104} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} />}>
          {reservas.length === 0 ? (
            <Animated.View entering={FadeIn.duration(250)} style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: c.amber + "14" }]}>
                <MaterialIcons name="event-available" size={32} color={c.amber} />
              </View>
              <Text style={[styles.emptyTitle, { color: c.text }]}>Día libre</Text>
              <Text style={[styles.emptyText, { color: c.sub }]}>
                No tienes citas para este día.
              </Text>
              <PressableScale
                onPress={() => navigation.navigate(user?.role === "admin" ? "AdminNuevaReserva" : "Nueva Cita")}
                style={[styles.emptyCta, { backgroundColor: c.amber }]}
              >
                <MaterialIcons name="add" size={16} color="#000" />
                <Text style={styles.emptyCtaText}>Agendar una cita</Text>
              </PressableScale>
            </Animated.View>
          ) : (
            reservas.map((r, i) => compacto ? (
              <Animated.View key={r.id} entering={FadeIn.delay(i * 40).duration(250)}>
                <ThemedCard style={styles.reservaCardCompacta}>
                  <Text style={[styles.horaCompacta, { color: c.amber }]}>{r.hora}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clienteCompacto, { color: c.text }]} numberOfLines={1}>{r.clienteNombre}</Text>
                    <Text style={[styles.servicioCompacto, { color: c.sub }]} numberOfLines={1}>{r.servicio}</Text>
                  </View>
                  <TagChip label={r.estado} variant={ESTADO_CHIP[r.estado] ?? "default"} />
                </ThemedCard>
              </Animated.View>
            ) : (
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
                      <PressableScale
                        onPress={() => marcarCompletado(r)}
                        style={[styles.actPrimary, { backgroundColor: c.positive }]}
                      >
                        <MaterialIcons name="task-alt" size={15} color="#0B0B0B" />
                        <Text style={styles.actPrimaryText}>Realizado</Text>
                      </PressableScale>
                      <PressableScale
                        onPress={() => marcarFallido(r)}
                        style={[styles.actGhost, { borderColor: c.border }]}
                      >
                        <MaterialIcons name="event-busy" size={14} color={c.amber} />
                        <Text style={[styles.actGhostText, { color: c.amber }]}>Fallido</Text>
                      </PressableScale>
                      <PressableScale
                        onPress={() => cancelarReserva(r)}
                        style={[styles.actGhost, { borderColor: c.border }]}
                      >
                        <MaterialIcons name="cancel" size={14} color={c.negative} />
                        <Text style={[styles.actGhostText, { color: c.negative }]}>Cancelar</Text>
                      </PressableScale>
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
                      <PressableScale
                        onPress={() => aprobarReserva(r)}
                        style={[styles.actPrimary, { backgroundColor: c.positive }]}
                      >
                        <MaterialIcons name="check" size={15} color="#0B0B0B" />
                        <Text style={styles.actPrimaryText}>Confirmar</Text>
                      </PressableScale>
                      <PressableScale
                        onPress={async () => {
                          try {
                            await updateDoc(doc(db, "reservas", r.id), { estado: "cancelada", updatedAt: Timestamp.now() });
                            setPendingAll(prev => prev.filter(x => x.id !== r.id));
                            notificarCancelacion(r.clienteUid, r.clienteNombre, r.servicio, r.hora, "empleado").catch(() => {});
                          } catch { Alert.alert("Error", "No se pudo negar."); }
                        }}
                        style={[styles.actGhost, { borderColor: c.border }]}
                      >
                        <MaterialIcons name="close" size={14} color={c.negative} />
                        <Text style={[styles.actGhostText, { color: c.negative }]}>Negar</Text>
                      </PressableScale>
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
  dateNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  navArrow: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  dateCenter: { flex: 1, alignItems: "center", gap: 2 },
  dateWeekday: { fontSize: 17, fontFamily: "Syne_700Bold", letterSpacing: 1 },
  dateFull: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  resumenBar: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20,
    paddingVertical: 10, borderBottomWidth: 1,
  },
  hoyBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  hoyBtnText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  resumenChips: { flexDirection: "row", gap: 8 },
  resumenChip:  { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  resumenChipNum: { fontSize: 14, fontFamily: "Inter_700Bold" },
  resumenChipLbl: { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold" },
  scroll:     { padding: 20, gap: 10 },
  empty:      { alignItems: "center", marginTop: 56, gap: 8 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: "Syne_700Bold" },
  emptyText:  { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", textAlign: "center" },
  emptyCta:   { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, marginTop: 10 },
  emptyCtaText: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  reservaCard: { flexDirection: "row", gap: 16 },
  horaBlock: {
    justifyContent: "center", alignItems: "center",
    paddingRight: 16, borderRightWidth: 1, minWidth: 64,
  },
  hora:          { fontSize: 22, fontFamily: "Inter_700Bold" },
  clienteNombre: { fontSize: 18, fontFamily: "SpaceGrotesk_600SemiBold" },
  servicio:      { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  tagsRow:       { flexDirection: "row", gap: 6, marginTop: 4 },
  confirmadaRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  // Acción principal (Realizado / Confirmar) — sólida, destacada
  actPrimary: {
    flex: 1.4, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  actPrimaryText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold", color: "#0B0B0B" },
  // Acciones secundarias — ghost, menor peso visual
  actGhost: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  actGhostText: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  compactBtn: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  reservaCardCompacta: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  horaCompacta:    { fontSize: 15, fontFamily: "Inter_700Bold", minWidth: 48 },
  clienteCompacto: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  servicioCompacto:{ fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
});