import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, RefreshControl,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, query, where,
  doc, updateDoc, getDoc, addDoc, Timestamp, onSnapshot,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { notificarEstadoPedido } from "../../services/notifications";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";
import { PressableScale } from "../../components/ui/PressableScale";
import { NuevoPedidoModal } from "./NuevoPedidoModal";

interface Pedido {
  id:            string;
  clienteUid?:   string;
  clienteNombre: string;
  items:         { nombre: string; cantidad: number; precio: number }[];
  total:         number;
  estado:        string;
  aCredito:      boolean;
  createdAt:     Timestamp;
}

const ESTADO_CHIP: Record<string, any> = {
  pendiente:         "warning",
  pendiente_credito: "warning",
  aprobado:          "success",
  rechazado:         "danger",
  entregado:         "default",
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente:         "Pendiente",
  pendiente_credito: "Crédito pendiente",
  aprobado:          "Aprobado",
  rechazado:         "Rechazado",
  entregado:         "Entregado",
};

interface Props {
  mode: "admin" | "empleado" | "cliente";
  showBackHeader?: boolean;
}

export function PedidosScreen({ mode, showBackHeader = true }: Props) {
  const c = useThemeColors();
  const { user } = useAuthStore();
  const [pedidos,    setPedidos]    = useState<Pedido[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState<"pendientes"|"historial">("pendientes");
  const [filtroCateg, setFiltroCateg] = useState<string>("todos");
  const [fechaFil,   setFechaFil]   = useState<"hoy"|"7dias"|"todos">("todos");
  const [nuevoVisible, setNuevoVisible] = useState(false);

  const load = async () => { /* recarga automática vía onSnapshot */ };

  useEffect(() => {
    const q = mode === "cliente" && user?.uid
      ? query(collection(db, "pedidos"), where("clienteUid", "==", user.uid))
      : query(collection(db, "pedidos"));
    const unsub = onSnapshot(
      q,
      snap => { setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Pedido)); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, [mode, user?.uid]);

  const onRefresh = async () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 500); };

  const cambiarEstado = async (pedido: Pedido, nuevoEstado: string) => {
    const labels: Record<string,string> = { aprobado:"Aprobar", rechazado:"Rechazar", entregado:"Marcar entregado" };
    Alert.alert(
      `${labels[nuevoEstado]} pedido`,
      `${pedido.clienteNombre} — $${pedido.total.toLocaleString("es-CO")}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: labels[nuevoEstado],
          style: nuevoEstado === "rechazado" ? "destructive" : "default",
          onPress: async () => {
            try {
              await updateDoc(doc(db,"pedidos",pedido.id), { estado: nuevoEstado, updatedAt: Timestamp.now() });

              // Si se aprueba un pedido a crédito, cargar el saldo del cliente
              if (nuevoEstado === "aprobado" && pedido.estado === "pendiente_credito" && pedido.clienteUid) {
                try {
                  const userRef  = doc(db, "users", pedido.clienteUid);
                  const userSnap = await getDoc(userRef);
                  const saldoActual = userSnap.exists() ? (userSnap.data().saldo ?? 0) : 0;
                  await updateDoc(userRef, { saldo: saldoActual + pedido.total });
                  await addDoc(collection(db, "movimientos"), {
                    clienteUid:  pedido.clienteUid,
                    tipo:        "cargo",
                    descripcion: `Tienda — ${pedido.items.map(i => `${i.nombre} x${i.cantidad}`).join(", ")}`,
                    monto:       pedido.total,
                    fecha:       Timestamp.now(),
                  });
                } catch {}
              }

              // Notificar al cliente del cambio de estado
              if (pedido.clienteUid && ["aprobado","rechazado","entregado"].includes(nuevoEstado)) {
                notificarEstadoPedido(pedido.clienteUid, nuevoEstado as any, pedido.total).catch(() => {});
              }
            } catch { Alert.alert("Error","No se pudo actualizar."); }
          },
        },
      ]
    );
  };

  const formatFecha = (ts: Timestamp) =>
    ts.toDate().toLocaleDateString("es-CO", { day:"numeric", month:"short", year:"numeric" });

  const enRangoFecha = (ts?: Timestamp) => {
    if (fechaFil === "todos" || !ts?.toDate) return true;
    const f = ts.toDate();
    const ahora = new Date();
    if (fechaFil === "hoy") {
      return f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth() && f.getDate() === ahora.getDate();
    }
    const d = new Date(ahora); d.setDate(ahora.getDate() - 7);
    return f >= d;
  };

  const pedidosFiltrados = pedidos
    .filter(p => filtroCateg === "todos" || p.items?.some((i: any) =>
      i.categoria === filtroCateg || i.nombre?.toLowerCase().includes(filtroCateg.toLowerCase())))
    .filter(p => enRangoFecha(p.createdAt));
  const pendientes = pedidosFiltrados.filter(p => ["pendiente","pendiente_credito"].includes(p.estado));
  const historial  = pedidosFiltrados.filter(p => !["pendiente","pendiente_credito"].includes(p.estado));
  const mostrar    = tab === "pendientes" ? pendientes : historial;

  return (
    <ScreenWrapper>
      {showBackHeader && <BackHeader title={mode === "cliente" ? "Mis pedidos" : "Pedidos"} />}

      <View style={[styles.tabs, { borderBottomColor: c.border }]}>
        {([
          { key:"pendientes", label:"Pendientes", count: pendientes.length },
          { key:"historial",  label:"Historial",  count: historial.length },
        ] as const).map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tabBtn, tab===t.key && { borderBottomWidth:2, borderBottomColor:c.amber }]}
          >
            <View style={styles.tabInner}>
              <Text style={[styles.tabText, { color: tab===t.key ? c.amber : c.sub }]}>{t.label}</Text>
              {t.count > 0 && (
                <View style={[styles.badge, { backgroundColor: tab===t.key ? c.amber : c.border }]}>
                  <Text style={[styles.badgeText, { color: tab===t.key ? "#000" : c.sub }]}>{t.count}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtro de fecha */}
      <View style={[styles.fechaRow, { borderBottomColor: c.border }]}>
        <MaterialIcons name="event" size={15} color={c.sub} />
        {([["todos","Todas"],["hoy","Hoy"],["7dias","7 días"]] as const).map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setFechaFil(k)}
            style={[styles.fechaChip, fechaFil===k && { backgroundColor: c.amber+"22", borderColor: c.amber }]}>
            <Text style={[styles.categTxt, { color: fechaFil===k ? c.amber : c.sub }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtro categoría - solo para admin/empleado */}
      {mode !== "cliente" && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={[styles.categRow, { borderBottomColor: c.border }]}>
          {["todos","Bebidas","Comestibles","Otros"].map(cat => (
            <TouchableOpacity key={cat} onPress={() => setFiltroCateg(cat)}
              style={[styles.categBtn, filtroCateg===cat && { backgroundColor: c.amber+"22", borderColor: c.amber }]}>
              <Text style={[styles.categTxt, { color: filtroCateg===cat ? c.amber : c.sub }]}>
                {cat === "todos" ? "Todos" : cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} />}
        >
          {mostrar.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="receipt-long" size={48} color={c.sub} />
              <Text style={[styles.emptyText, { color: c.sub }]}>
                {tab==="pendientes" ? "Sin pedidos pendientes" : "Sin historial"}
              </Text>
            </View>
          ) : (
            mostrar.map((p, i) => (
              <Animated.View key={i} entering={FadeIn.delay(Math.min(i * 25, 200)).duration(200)}>
              <ThemedCard style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex:1, gap:2 }}>
                    {mode !== "cliente" && (
                      <Text style={[styles.clienteNombre, { color: c.text }]}>{p.clienteNombre}</Text>
                    )}
                    <Text style={[styles.fecha, { color: c.sub }]}>{formatFecha(p.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems:"flex-end", gap:4 }}>
                    <Text style={[styles.total, { color: c.amber }]}>${p.total.toLocaleString("es-CO")}</Text>
                    <TagChip label={ESTADO_LABEL[p.estado]??p.estado} variant={ESTADO_CHIP[p.estado]??"default"} />
                  </View>
                </View>
                <View style={[styles.itemsBox, { borderColor: c.border, backgroundColor: c.bg }]}>
                  {p.items?.map((item, j) => (
                    <View key={j} style={styles.itemRow}>
                      <Text style={[styles.itemNombre, { color: c.text }]}>{item.nombre} x{item.cantidad}</Text>
                      <Text style={[styles.itemPrecio, { color: c.sub }]}>${(item.precio*item.cantidad).toLocaleString("es-CO")}</Text>
                    </View>
                  ))}
                </View>
                {p.aCredito && <TagChip label="A crédito" variant="warning" />}
                {(mode === "admin" || (mode === "empleado" && user?.canApproveOrders)) && ["pendiente","pendiente_credito"].includes(p.estado) && (
                  <View style={styles.acciones}>
                    <PressableScale onPress={() => cambiarEstado(p,"rechazado")} style={[styles.accionBtnGhost, { borderColor: c.border }]}>
                      <MaterialIcons name="close" size={15} color={c.negative} />
                      <Text style={[styles.accionText, { color: c.negative }]}>Rechazar</Text>
                    </PressableScale>
                    <PressableScale onPress={() => cambiarEstado(p,"aprobado")} style={[styles.accionBtnPrimary, { backgroundColor: c.positive }]}>
                      <MaterialIcons name="check" size={15} color="#0B0B0B" />
                      <Text style={[styles.accionText, { color: "#0B0B0B" }]}>Aprobar</Text>
                    </PressableScale>
                  </View>
                )}
              </ThemedCard>
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}

      {/* FAB nuevo pedido de mostrador (admin/empleado) */}
      {mode !== "cliente" && (
        <TouchableOpacity
          onPress={() => setNuevoVisible(true)}
          activeOpacity={0.85}
          style={[styles.fab, { backgroundColor: c.amber }]}
        >
          <MaterialIcons name="add-shopping-cart" size={22} color="#000" />
          <Text style={styles.fabText}>Nuevo pedido</Text>
        </TouchableOpacity>
      )}

      <NuevoPedidoModal mode={mode} visible={nuevoVisible} onClose={() => setNuevoVisible(false)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  categRow: { borderBottomWidth: 1, paddingVertical: 8, paddingHorizontal: 16 },
  categBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "transparent", marginRight: 8 },
  categTxt: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  fechaRow:  { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1 },
  fechaChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "transparent" },
  tabs:       { flexDirection:"row", borderBottomWidth:1, paddingHorizontal:20 },
  tabBtn:     { paddingVertical:12, paddingHorizontal:12 },
  tabInner:   { flexDirection:"row", alignItems:"center", gap:6 },
  tabText:    { fontSize:13, fontFamily:"SpaceGrotesk_600SemiBold" },
  badge:      { minWidth:18, height:18, borderRadius:9, justifyContent:"center", alignItems:"center", paddingHorizontal:4 },
  badgeText:  { fontSize:10, fontFamily:"SpaceGrotesk_600SemiBold" },
  scroll:     { padding:20, gap:12 },
  empty:      { alignItems:"center", marginTop:60, gap:12 },
  emptyText:  { fontSize:14, fontFamily:"SpaceGrotesk_400Regular" },
  card:       { gap:10 },
  cardHeader: { flexDirection:"row", alignItems:"flex-start", gap:8 },
  clienteNombre: { fontSize:15, fontFamily:"SpaceGrotesk_600SemiBold" },
  fecha:      { fontSize:12, fontFamily:"SpaceGrotesk_400Regular" },
  total:      { fontSize:15, fontFamily:"Inter_600SemiBold" },
  itemsBox:   { borderRadius:8, borderWidth:1, paddingHorizontal:12, paddingVertical:8, gap:6 },
  itemRow:    { flexDirection:"row", justifyContent:"space-between" },
  itemNombre: { fontSize:13, fontFamily:"SpaceGrotesk_500Medium" },
  itemPrecio: { fontSize:12, fontFamily:"Inter_500Medium" },
  acciones:   { flexDirection:"row", gap:10 },
  accionBtn:  { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, paddingVertical:10, borderRadius:10, borderWidth:1 },
  accionBtnGhost:   { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, paddingVertical:11, borderRadius:10, borderWidth:1 },
  accionBtnPrimary: { flex:1.3, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, paddingVertical:11, borderRadius:10 },
  accionText: { fontSize:13, fontFamily:"SpaceGrotesk_600SemiBold" },
  fab: {
    position:"absolute", right:20, bottom:24,
    flexDirection:"row", alignItems:"center", gap:8,
    paddingHorizontal:18, height:52, borderRadius:26,
    shadowColor:"#000", shadowOpacity:0.25, shadowRadius:8, shadowOffset:{ width:0, height:4 }, elevation:6,
  },
  fabText: { fontSize:14, fontFamily:"SpaceGrotesk_600SemiBold", color:"#000" },
});
