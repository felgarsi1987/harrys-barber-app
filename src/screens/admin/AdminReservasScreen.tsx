import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
  RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  collection, getDocs, addDoc, query, orderBy,
  doc, updateDoc, getDoc, Timestamp, where,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { notificarCambioEstado, cancelarRecordatorio } from "../../services/notifications";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface Reserva {
  id:              string;
  clienteNombre:   string;
  clienteEmail:    string;
  clienteUid?:     string;
  servicio:        string;
  precio?:         number;
  fecha:           Timestamp;
  hora:            string;
  estado:          "pendiente" | "confirmada" | "aplazada" | "negada" | "completada" | "fallida";
  noRegistrado?:   boolean;
  peluqueroUid?:   string;
  peluqueroNombre?: string;
  modalidadPago?:  string;
}

interface Empleado {
  uid:     string;
  nombre:  string;
  apellido:string;
}

const ESTADO_CHIP: Record<string, any> = {
  pendiente:  "warning",
  confirmada: "success",
  aplazada:   "info",
  negada:     "danger",
  completada: "default",
  fallida:    "danger",
};

type DiaFilter    = "ayer" | "hoy" | "manana" | "todos";
type EstadoFilter = "todas" | "pendiente" | "confirmada";

export function AdminReservasScreen() {
  const c          = useThemeColors();
  const navigation = useNavigation<any>();
  const { user }   = useAuthStore();

  const [reservas,     setReservas]     = useState<Reserva[]>([]);
  const [empleados,    setEmpleados]    = useState<Empleado[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [diaFilter,    setDiaFilter]    = useState<DiaFilter>("hoy");
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todas");
  const [empleadoFil,  setEmpleadoFil]  = useState<string>("todos");

  const loadEmpleados = async () => {
    const snap = await getDocs(query(
      collection(db, "users"),
      where("role", "in", ["empleado", "admin"])
    ));
    setEmpleados(snap.docs.map(d => d.data() as Empleado));
  };

  const loadReservas = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "reservas"), orderBy("fecha", "asc"))
      );
      setReservas(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Reserva));
    } catch(e) { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadEmpleados();
    loadReservas();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReservas();
    setRefreshing(false);
  };

  const getDateRange = (filter: DiaFilter) => {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (filter === "ayer")   { const d = new Date(today); d.setDate(d.getDate()-1); return { start: d, end: today }; }
    if (filter === "hoy")    { const e = new Date(today); e.setDate(e.getDate()+1); return { start: today, end: e }; }
    if (filter === "manana") { const s = new Date(today); s.setDate(s.getDate()+1); const e = new Date(s); e.setDate(e.getDate()+1); return { start: s, end: e }; }
    return null;
  };

  const filtered = reservas.filter(r => {
    const rDate = r.fecha.toDate();
    const range = getDateRange(diaFilter);
    if (range && (rDate < range.start || rDate >= range.end)) return false;
    if (estadoFilter !== "todas" && r.estado !== estadoFilter) return false;
    if (empleadoFil !== "todos" && r.peluqueroUid !== empleadoFil) return false;
    return true;
  });

  const cambiarEstado = async (reserva: Reserva, nuevoEstado: Reserva["estado"]) => {
    const labels: Record<string,string> = { confirmada:"Confirmar", aplazada:"Aplazar", negada:"Negar" };
    Alert.alert(`${labels[nuevoEstado]} reserva`, `¿${labels[nuevoEstado]} la cita de ${reserva.clienteNombre}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: labels[nuevoEstado],
        style: nuevoEstado === "negada" ? "destructive" : "default",
        onPress: async () => {
          try {
            await updateDoc(doc(db,"reservas",reserva.id), { estado: nuevoEstado, updatedAt: Timestamp.now() });
            setReservas(prev => prev.map(r => r.id === reserva.id ? { ...r, estado: nuevoEstado } : r));
            notificarCambioEstado(reserva.clienteUid, reserva.clienteNombre, reserva.servicio, nuevoEstado, reserva.hora);
            if (nuevoEstado === "negada" || nuevoEstado === "aplazada") cancelarRecordatorio(reserva.id);
          } catch { Alert.alert("Error","No se pudo actualizar."); }
        },
      },
    ]);
  };

  const marcarCompletado = async (reserva: Reserva) => {
    const esRegistrado = !!reserva.clienteUid && !reserva.noRegistrado;
    const opciones: any[] = [
      { text: "Cancelar", style: "cancel" },
      { text: "💵 De contado", onPress: () => completarConModalidad(reserva, "contado") },
    ];
    if (esRegistrado) opciones.push({ text: "💳 A crédito", onPress: () => completarConModalidad(reserva, "credito") });
    Alert.alert("¿Cómo se pagó?", `${reserva.clienteNombre} — ${reserva.servicio}`, opciones);
  };

  const completarConModalidad = async (reserva: Reserva, modalidad: "contado" | "credito") => {
    try {
      const ahora = Timestamp.now();
      await updateDoc(doc(db,"reservas",reserva.id), { estado:"completada", fechaCompletado:ahora, updatedAt:ahora, modalidadPago:modalidad });
      await addDoc(collection(db,"servicios_realizados"), {
        reservaId: reserva.id, clienteNombre: reserva.clienteNombre, clienteUid: reserva.clienteUid ?? null,
        peluqueroUid: reserva.peluqueroUid ?? null, peluqueroNombre: reserva.peluqueroNombre ?? null,
        servicio: reserva.servicio, precio: reserva.precio ?? 0, fecha: ahora, estado: "completado", modalidadPago: modalidad,
      });
      if (modalidad === "credito" && reserva.clienteUid) {
        const uRef  = doc(db,"users",reserva.clienteUid);
        const uSnap = await getDoc(uRef);
        const sal   = uSnap.exists() ? (uSnap.data().saldo ?? 0) : 0;
        await updateDoc(uRef, { saldo: sal + (reserva.precio ?? 0) });
        await addDoc(collection(db,"movimientos"), {
          clienteUid: reserva.clienteUid, tipo:"cargo",
          descripcion:`Servicio: ${reserva.servicio}`, monto: reserva.precio ?? 0, fecha: ahora,
        });
      }
      setReservas(prev => prev.map(r => r.id === reserva.id ? { ...r, estado:"completada" } : r));
      notificarCambioEstado(reserva.clienteUid, reserva.clienteNombre, reserva.servicio, "completada", reserva.hora);
      Alert.alert("✅ Registrado", `${modalidad === "credito" ? "A crédito" : "De contado"}`);
    } catch(e) { Alert.alert("Error","No se pudo registrar."); }
  };

  const marcarFallido = async (reserva: Reserva) => {
    Alert.alert("¿Servicio fallido?", `¿Marcar como fallido el servicio de ${reserva.clienteNombre}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Marcar fallido", style:"destructive", onPress: async () => {
        try {
          await updateDoc(doc(db,"reservas",reserva.id), { estado:"fallida", updatedAt:Timestamp.now() });
          setReservas(prev => prev.map(r => r.id === reserva.id ? { ...r, estado:"fallida" as any } : r));
          notificarCambioEstado(reserva.clienteUid, reserva.clienteNombre, reserva.servicio, "fallida", reserva.hora);
        } catch { Alert.alert("Error","No se pudo actualizar."); }
      }},
    ]);
  };

  const formatFecha = (ts: Timestamp) =>
    ts.toDate().toLocaleDateString("es-CO", { weekday:"short", day:"numeric", month:"short" });

  const DIA_OPTS: { key: DiaFilter; label: string }[] = [
    { key:"ayer",   label:"Ayer"   },
    { key:"hoy",    label:"Hoy"    },
    { key:"manana", label:"Mañana" },
    { key:"todos",  label:"Todos"  },
  ];

  return (
    <ScreenWrapper keyboard={false}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Reservas</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("AdminNuevaReserva")}
          style={[styles.addBtn, { borderColor: c.border }]}
        >
          <MaterialIcons name="add" size={20} color={c.text} />
        </TouchableOpacity>
      </View>

      {/* Filtro día */}
      <View style={[styles.filterRow, { borderBottomColor: c.border }]}>
        {DIA_OPTS.map(o => (
          <TouchableOpacity
            key={o.key}
            onPress={() => setDiaFilter(o.key)}
            style={[styles.filterBtn, diaFilter===o.key && { borderBottomWidth:2, borderBottomColor:c.amber }]}
          >
            <Text style={[styles.filterText, { color: diaFilter===o.key ? c.amber : c.sub }]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtro estado */}
      <View style={[styles.estadoRow, { borderBottomColor: c.border }]}>
        {(["todas","pendiente","confirmada"] as const).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setEstadoFilter(f)}
            style={[styles.estadoBtn, estadoFilter===f && { backgroundColor: c.amber+"22", borderColor: c.amber }]}
          >
            <Text style={[styles.estadoText, { color: estadoFilter===f ? c.amber : c.sub }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtro peluquero */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.barberoScroll, { borderBottomColor: c.border }]}>
        <TouchableOpacity
          onPress={() => setEmpleadoFil("todos")}
          style={[styles.barberoBtn, empleadoFil==="todos" && { backgroundColor: c.amber+"22", borderColor: c.amber }]}
        >
          <Text style={[styles.barberoText, { color: empleadoFil==="todos" ? c.amber : c.sub }]}>Todos</Text>
        </TouchableOpacity>
        {/* Admin as peluquero */}
        {user && (
          <TouchableOpacity
            onPress={() => setEmpleadoFil(user.uid)}
            style={[styles.barberoBtn, empleadoFil===user.uid && { backgroundColor: c.amber+"22", borderColor: c.amber }]}
          >
            <Text style={[styles.barberoText, { color: empleadoFil===user.uid ? c.amber : c.sub }]}>
              Yo ({user.nombre})
            </Text>
          </TouchableOpacity>
        )}
        {empleados.filter(e => e.uid !== user?.uid).map((emp, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setEmpleadoFil(emp.uid)}
            style={[styles.barberoBtn, empleadoFil===emp.uid && { backgroundColor: c.amber+"22", borderColor: c.amber }]}
          >
            <Text style={[styles.barberoText, { color: empleadoFil===emp.uid ? c.amber : c.sub }]}>
              {emp.nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
                <View style={styles.cardTop}>
                  <View style={{ flex:1, gap:4 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.clienteNombre, { color: c.text }]}>{r.clienteNombre}</Text>
                      {r.noRegistrado && <TagChip label="Sin registro" variant="default" />}
                    </View>
                    <Text style={[styles.servicio, { color: c.amber }]}>
                      {r.servicio}{r.precio ? `  ·  $${r.precio.toLocaleString("es-CO")}` : ""}
                    </Text>
                    {r.peluqueroNombre && (
                      <Text style={[styles.peluquero, { color: c.sub }]}>
                        <MaterialIcons name="content-cut" size={11} /> {r.peluqueroNombre}
                      </Text>
                    )}
                  </View>
                  <TagChip label={r.estado} variant={ESTADO_CHIP[r.estado]} />
                </View>

                <View style={styles.fechaRow}>
                  <MaterialIcons name="event" size={14} color={c.sub} />
                  <Text style={[styles.fechaText, { color: c.sub }]}>{formatFecha(r.fecha)} — {r.hora}</Text>
                </View>

                {r.estado === "pendiente" && (
                  <View style={[styles.actionsRow, { borderTopColor: c.border }]}>
                    <TouchableOpacity onPress={() => cambiarEstado(r,"confirmada")} style={[styles.actionBtn, { backgroundColor: c.positive+"18" }]}>
                      <MaterialIcons name="check" size={16} color={c.positive} />
                      <Text style={[styles.actionBtnText, { color: c.positive }]}>Confirmar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => cambiarEstado(r,"aplazada")} style={[styles.actionBtn, { backgroundColor: c.amber+"18" }]}>
                      <MaterialIcons name="schedule" size={16} color={c.amber} />
                      <Text style={[styles.actionBtnText, { color: c.amber }]}>Aplazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => cambiarEstado(r,"negada")} style={[styles.actionBtn, { backgroundColor: c.negative+"18" }]}>
                      <MaterialIcons name="close" size={16} color={c.negative} />
                      <Text style={[styles.actionBtnText, { color: c.negative }]}>Negar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {r.estado === "confirmada" && (
                  <View style={styles.confirmadaRow}>
                    <TouchableOpacity onPress={() => marcarCompletado(r)} style={[styles.confirmadaBtn, { backgroundColor: c.positive+"18", borderColor: c.positive+"44" }]}>
                      <MaterialIcons name="task-alt" size={16} color={c.positive} />
                      <Text style={[styles.confirmadaBtnText, { color: c.positive }]}>Realizado</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => marcarFallido(r)} style={[styles.confirmadaBtn, { backgroundColor: c.negative+"18", borderColor: c.negative+"44" }]}>
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
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:      { flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingHorizontal:20, paddingVertical:16, borderBottomWidth:1 },
  title:       { fontSize:22, fontFamily:"Syne_700Bold" },
  addBtn:      { width:36, height:36, borderRadius:18, borderWidth:1, justifyContent:"center", alignItems:"center" },
  filterRow:   { flexDirection:"row", borderBottomWidth:1, paddingHorizontal:20 },
  filterBtn:   { paddingVertical:10, paddingHorizontal:14 },
  filterText:  { fontSize:13, fontFamily:"SpaceGrotesk_600SemiBold" },
  estadoRow:   { flexDirection:"row", gap:8, paddingHorizontal:16, paddingVertical:8, borderBottomWidth:1 },
  estadoBtn:   { paddingHorizontal:12, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:"transparent" },
  estadoText:  { fontSize:12, fontFamily:"SpaceGrotesk_600SemiBold" },
  barberoScroll:{ borderBottomWidth:1, paddingVertical:8, paddingHorizontal:16 },
  barberoBtn:  { paddingHorizontal:12, paddingVertical:5, borderRadius:20, borderWidth:1, borderColor:"transparent", marginRight:8 },
  barberoText: { fontSize:12, fontFamily:"SpaceGrotesk_500Medium" },
  scroll:      { padding:20, gap:12 },
  empty:       { alignItems:"center", marginTop:60, gap:12 },
  emptyText:   { fontSize:14, fontFamily:"SpaceGrotesk_400Regular" },
  card:        { gap:12 },
  cardTop:     { flexDirection:"row", alignItems:"flex-start", gap:12 },
  nameRow:     { flexDirection:"row", alignItems:"center", gap:8, flexWrap:"wrap" },
  clienteNombre:{ fontSize:15, fontFamily:"SpaceGrotesk_600SemiBold" },
  servicio:    { fontSize:13, fontFamily:"SpaceGrotesk_500Medium" },
  peluquero:   { fontSize:11, fontFamily:"SpaceGrotesk_400Regular" },
  fechaRow:    { flexDirection:"row", alignItems:"center", gap:6 },
  fechaText:   { fontSize:12, fontFamily:"SpaceGrotesk_400Regular" },
  actionsRow:  { flexDirection:"row", gap:8, paddingTop:12, borderTopWidth:1 },
  actionBtn:   { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:4, paddingVertical:8, borderRadius:8 },
  actionBtnText:{ fontSize:12, fontFamily:"SpaceGrotesk_600SemiBold" },
  confirmadaRow:{ flexDirection:"row", gap:8 },
  confirmadaBtn:{ flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, paddingVertical:10, borderRadius:10, borderWidth:1 },
  confirmadaBtnText:{ fontSize:13, fontFamily:"SpaceGrotesk_600SemiBold" },
});
