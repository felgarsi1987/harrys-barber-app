import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, getDocs, query, where, orderBy,
  doc, updateDoc, Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

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

  const load = async () => {
    try {
      let q;
      if (mode === "cliente" && user?.uid) {
        q = query(collection(db,"pedidos"), where("clienteUid","==",user.uid), orderBy("createdAt","desc"));
      } else {
        q = query(collection(db,"pedidos"), orderBy("createdAt","desc"));
      }
      const snap = await getDocs(q);
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Pedido));
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

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
              setPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, estado: nuevoEstado } : p));
            } catch { Alert.alert("Error","No se pudo actualizar."); }
          },
        },
      ]
    );
  };

  const formatFecha = (ts: Timestamp) =>
    ts.toDate().toLocaleDateString("es-CO", { day:"numeric", month:"short", year:"numeric" });

  const pendientes = pedidos.filter(p => ["pendiente","pendiente_credito"].includes(p.estado));
  const historial  = pedidos.filter(p => !["pendiente","pendiente_credito"].includes(p.estado));
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
              <ThemedCard key={i} style={styles.card}>
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
                {mode === "admin" && ["pendiente","pendiente_credito"].includes(p.estado) && (
                  <View style={styles.acciones}>
                    <TouchableOpacity onPress={() => cambiarEstado(p,"rechazado")} style={[styles.accionBtn, { backgroundColor: c.negative+"18", borderColor: c.negative+"44" }]}>
                      <MaterialIcons name="close" size={15} color={c.negative} />
                      <Text style={[styles.accionText, { color: c.negative }]}>Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => cambiarEstado(p,"aprobado")} style={[styles.accionBtn, { backgroundColor: c.positive+"18", borderColor: c.positive+"44" }]}>
                      <MaterialIcons name="check" size={15} color={c.positive} />
                      <Text style={[styles.accionText, { color: c.positive }]}>Aprobar</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {mode === "admin" && p.estado === "aprobado" && (
                  <TouchableOpacity onPress={() => cambiarEstado(p,"entregado")} style={[styles.accionBtn, { borderColor: c.amber+"44", backgroundColor: c.amber+"18" }]}>
                    <MaterialIcons name="local-shipping" size={15} color={c.amber} />
                    <Text style={[styles.accionText, { color: c.amber }]}>Marcar entregado</Text>
                  </TouchableOpacity>
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
  total:      { fontSize:15, fontFamily:"SpaceGrotesk_600SemiBold" },
  itemsBox:   { borderRadius:8, borderWidth:1, paddingHorizontal:12, paddingVertical:8, gap:6 },
  itemRow:    { flexDirection:"row", justifyContent:"space-between" },
  itemNombre: { fontSize:13, fontFamily:"SpaceGrotesk_500Medium" },
  itemPrecio: { fontSize:12, fontFamily:"SpaceGrotesk_400Regular" },
  acciones:   { flexDirection:"row", gap:10 },
  accionBtn:  { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, paddingVertical:10, borderRadius:10, borderWidth:1 },
  accionText: { fontSize:13, fontFamily:"SpaceGrotesk_600SemiBold" },
});
