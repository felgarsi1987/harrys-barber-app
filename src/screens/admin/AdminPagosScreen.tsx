import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, getDocs, query, where,
  doc, addDoc, updateDoc, getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { notificarAbono, notificarEstadoPedido } from "../../services/notifications";
import { useThemeColors } from "../../hooks/useThemeColors";
import { FidelizacionBadge } from "../../components/ui/FidelizacionBadge";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { NumberText }     from "../../components/ui/NumberText";
import { TagChip }        from "../../components/ui/TagChip";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface ClienteConSaldo {
  uid:      string;
  nombre:   string;
  apellido: string;
  email:    string;
  saldo:    number;
  pushToken?: string;
}

interface Movimiento {
  id:          string;
  tipo:        "cargo" | "abono";
  descripcion: string;
  monto:       number;
  fecha:       Timestamp;
  clienteUid:  string;
}

interface PedidoCredito {
  id:            string;
  clienteUid:    string;
  clienteNombre: string;
  clienteEmail:  string;
  items:         { nombre: string; cantidad: number; precio: number }[];
  total:         number;
  estado:        string;
  createdAt:     Timestamp;
}

type Tab = "deudas" | "historial";

export function AdminPagosScreen() {
  const c = useThemeColors();

  const [clientes,     setClientes]     = useState<ClienteConSaldo[]>([]);
  const [movimientos,  setMovimientos]  = useState<Movimiento[]>([]);
  const [pedidos,      setPedidos]      = useState<PedidoCredito[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [tab,          setTab]          = useState<Tab>("deudas");
  const [modalVisible, setModalVisible] = useState(false);
  const [clienteSel,   setClienteSel]   = useState<ClienteConSaldo | null>(null);
  const [monto,        setMonto]        = useState("");
  const [descripcion,  setDescripcion]  = useState("");
  const [guardando,    setGuardando]    = useState(false);

  const loadData = async () => {
    try {
      const [clientesSnap, movSnap, pedidosSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "cliente"))),
        getDocs(query(collection(db, "movimientos"))),
        getDocs(query(
          collection(db, "pedidos"),
          where("estado", "==", "pendiente_credito")
        )),
      ]);

      const clientesData = clientesSnap.docs.map(d => d.data() as ClienteConSaldo);
      setClientes(clientesData.filter(c => (c.saldo ?? 0) > 0));
      setMovimientos(movSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Movimiento));
      setPedidos(pedidosSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PedidoCredito));
    } catch(e) { /* */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Notificar al cliente via Expo Push ────────────────────────────────────
  // notifications handled by notifications.ts service


  // ── Aprobar crédito ───────────────────────────────────────────────────────
  const aprobarCredito = async (pedido: PedidoCredito) => {
    Alert.alert(
      "Aprobar crédito",
      `¿Aprobar crédito de $${pedido.total.toLocaleString("es-CO")} a ${pedido.clienteNombre}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aprobar",
          onPress: async () => {
            try {
              // 1. Actualizar estado del pedido
              await updateDoc(doc(db, "pedidos", pedido.id), {
                estado: "aprobado", updatedAt: Timestamp.now(),
              });

              // 2. Registrar cargo en movimientos
              await addDoc(collection(db, "movimientos"), {
                clienteUid:  pedido.clienteUid,
                tipo:        "cargo",
                descripcion: `Crédito aprobado — ${pedido.items.map(i => `${i.nombre} x${i.cantidad}`).join(", ")}`,
                monto:       pedido.total,
                fecha:       Timestamp.now(),
              });

              // 3. Aumentar saldo del cliente
              const userRef  = doc(db, "users", pedido.clienteUid);
              const userSnap = await getDoc(userRef);
              const saldoActual = userSnap.exists() ? (userSnap.data().saldo ?? 0) : 0;
              await updateDoc(userRef, { saldo: saldoActual + pedido.total });

              // 4. Notificar al cliente
              await notificarCliente(
                pedido.clienteUid,
                "✅ Crédito aprobado",
                `Tu solicitud de crédito por $${pedido.total.toLocaleString("es-CO")} fue aprobada. Recuerda cancelar tu deuda pronto.`,
              );

              setPedidos(prev => prev.filter(p => p.id !== pedido.id));
              Alert.alert("✅ Aprobado", `Crédito de $${pedido.total.toLocaleString("es-CO")} registrado.`);
              loadData();
            } catch {
              Alert.alert("Error", "No se pudo aprobar.");
            }
          },
        },
      ]
    );
  };

  // ── Rechazar crédito ──────────────────────────────────────────────────────
  const rechazarCredito = async (pedido: PedidoCredito) => {
    Alert.alert(
      "Rechazar crédito",
      `¿Rechazar la solicitud de ${pedido.clienteNombre}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Rechazar",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "pedidos", pedido.id), {
                estado: "rechazado", updatedAt: Timestamp.now(),
              });

              await notificarCliente(
                pedido.clienteUid,
                "❌ Crédito no aprobado",
                `Tu solicitud de crédito por $${pedido.total.toLocaleString("es-CO")} no fue aprobada. Comunícate con nosotros para más información.`,
              );

              setPedidos(prev => prev.filter(p => p.id !== pedido.id));
              Alert.alert("Rechazado", "La solicitud fue rechazada.");
            } catch {
              Alert.alert("Error", "No se pudo rechazar.");
            }
          },
        },
      ]
    );
  };

  // ── Registrar abono ───────────────────────────────────────────────────────
  const abrirModalAbono = (cliente: ClienteConSaldo) => {
    setClienteSel(cliente);
    setMonto("");
    setDescripcion("");
    setModalVisible(true);
  };

  const registrarAbono = async () => {
    if (!clienteSel || !monto || isNaN(Number(monto))) {
      Alert.alert("Error", "Ingresa un monto válido.");
      return;
    }
    const montoNum = Number(monto);
    if (montoNum <= 0) { Alert.alert("Error", "El monto debe ser mayor a 0."); return; }

    setGuardando(true);
    try {
      await addDoc(collection(db, "movimientos"), {
        clienteUid:  clienteSel.uid,
        tipo:        "abono",
        descripcion: descripcion.trim() || "Abono registrado por admin",
        monto:       montoNum,
        fecha:       Timestamp.now(),
      });

      const nuevoSaldo = Math.max((clienteSel.saldo ?? 0) - montoNum, 0);
      await updateDoc(doc(db, "users", clienteSel.uid), { saldo: nuevoSaldo });

      // Notificar al cliente
      await notificarCliente(
        clienteSel.uid,
        "💰 Abono registrado",
        `Se registró un abono de $${montoNum.toLocaleString("es-CO")} a tu cuenta. ${nuevoSaldo > 0 ? `Saldo pendiente: $${nuevoSaldo.toLocaleString("es-CO")}` : "¡Tu cuenta está al día!"}`,
      );

      setModalVisible(false);
      Alert.alert("✅ Abono registrado", `$${montoNum.toLocaleString("es-CO")} abonado a ${clienteSel.nombre}.`);
      loadData();
    } catch {
      Alert.alert("Error", "No se pudo registrar el abono.");
    } finally { setGuardando(false); }
  };

  const totalDeuda  = clientes.reduce((acc, c) => acc + (c.saldo ?? 0), 0);
  const formatFecha = (ts: Timestamp) =>
    ts.toDate().toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: "deudas",      label: "Deudas" },
    { key: "historial",   label: "Historial" },
  ];

  return (
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Pagos y créditos</Text>
      </View>

      {/* KPI total deuda */}
      <ThemedCard style={styles.totalCard} elevated>
        <Text style={[styles.totalLabel, { color: c.sub }]}>TOTAL CRÉDITOS PENDIENTES</Text>
        <NumberText size={32} negative={totalDeuda > 0}>
          ${totalDeuda.toLocaleString("es-CO")}
        </NumberText>
        <Text style={[styles.totalDesc, { color: c.sub }]}>
          {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"} con deuda
          {pedidos.length > 0 && ` · ${pedidos.length} solicitud${pedidos.length > 1 ? "es" : ""} pendiente${pedidos.length > 1 ? "s" : ""}`}
        </Text>
      </ThemedCard>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: c.border }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tabBtn, tab === t.key && { borderBottomWidth: 2, borderBottomColor: c.amber }]}
          >
            <View style={styles.tabInner}>
              <Text style={[styles.tabText, { color: tab === t.key ? c.amber : c.sub }]}>
                {t.label}
              </Text>
              {!!t.badge && t.badge > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: c.amber }]}>
                  <Text style={styles.tabBadgeText}>{t.badge}</Text>
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

          {/* ── TAB DEUDAS ── */}
          {tab === "deudas" && (
            clientes.length === 0 ? (
              <View style={styles.empty}>
                <MaterialIcons name="check-circle-outline" size={48} color={c.positive} />
                <Text style={[styles.emptyText, { color: c.sub }]}>Todos los clientes están al día</Text>
              </View>
            ) : (
              clientes.map((cli, i) => (
                <ThemedCard key={i} style={styles.clienteCard}>
                  <View style={[styles.avatar, { backgroundColor: c.negative + "18" }]}>
                    <Text style={[styles.avatarText, { color: c.negative }]}>
                      {cli.nombre[0]}{cli.apellido?.[0] ?? ""}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.clienteNombre, { color: c.text }]}>
                      {cli.nombre} {cli.apellido}
                    </Text>
                    <Text style={[styles.clienteEmail, { color: c.sub }]}>{cli.email}</Text>
                    <NumberText size={16} negative>${cli.saldo.toLocaleString("es-CO")}</NumberText>
                  </View>
                  <View style={styles.acciones}>
                    <TouchableOpacity
                      onPress={() => abrirModalAbono(cli)}
                      style={[styles.accionBtn, { backgroundColor: c.positive + "18" }]}
                    >
                      <MaterialIcons name="add" size={16} color={c.positive} />
                      <Text style={[styles.accionText, { color: c.positive }]}>Abonar</Text>
                    </TouchableOpacity>
                  </View>
                </ThemedCard>
              ))
            )
          )}

          {/* ── TAB HISTORIAL ── */}
          {tab === "historial" && (
            movimientos.length === 0 ? (
              <View style={styles.empty}>
                <MaterialIcons name="receipt-long" size={48} color={c.sub} />
                <Text style={[styles.emptyText, { color: c.sub }]}>Sin movimientos</Text>
              </View>
            ) : (
              movimientos.map((m, i) => (
                <ThemedCard key={i} style={styles.movCard}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.movDesc,  { color: c.text }]}>{m.descripcion}</Text>
                    <Text style={[styles.movFecha, { color: c.sub  }]}>{formatFecha(m.fecha)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <NumberText size={15} negative={m.tipo === "cargo"} positive={m.tipo === "abono"}>
                      {m.tipo === "cargo" ? "-" : "+"}${m.monto.toLocaleString("es-CO")}
                    </NumberText>
                    <TagChip label={m.tipo} variant={m.tipo === "cargo" ? "danger" : "success"} />
                  </View>
                </ThemedCard>
              ))
            )
          )}

        </ScrollView>
      )}

      {/* Modal abono */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Registrar abono</Text>
            <Text style={[styles.modalCliente, { color: c.sub }]}>
              {clienteSel?.nombre} {clienteSel?.apellido}
            </Text>
            <Text style={[styles.modalDeuda, { color: c.negative }]}>
              Deuda: ${clienteSel?.saldo.toLocaleString("es-CO")}
            </Text>

            <View style={{ gap: 6 }}>
              <Text style={[styles.inputLabel, { color: c.sub }]}>Monto del abono</Text>
              <TextInput
                style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                value={monto}
                onChangeText={setMonto}
                placeholder="Ej. 20000"
                placeholderTextColor={c.sub}
                keyboardType="numeric"
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={[styles.inputLabel, { color: c.sub }]}>Descripción (opcional)</Text>
              <TextInput
                style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Ej. Pago en efectivo"
                placeholderTextColor={c.sub}
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.modalBtnText, { color: c.sub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={registrarAbono}
                style={[styles.modalBtn, { backgroundColor: c.positive, opacity: guardando ? 0.7 : 1 }]}
                disabled={guardando}
              >
                {guardando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={[styles.modalBtnText, { color: "#fff" }]}>Registrar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  totalCard: { margin: 20, alignItems: "center", gap: 6, paddingVertical: 24 },
  totalLabel:{ fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  totalDesc: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  tabs:    { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20 },
  tabBtn:  { paddingVertical: 12, paddingHorizontal: 12 },
  tabInner:{ flexDirection: "row", alignItems: "center", gap: 6 },
  tabText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  tabBadge:{
    minWidth: 18, height: 18, borderRadius: 9,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 4,
  },
  tabBadgeText: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  scroll:  { padding: 20, gap: 12 },
  empty:   { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },

  // Solicitudes
  solicitudCard:   { gap: 12 },
  solicitudHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  solicitudNombre: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  solicitudFecha:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  itemsBox: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  itemRow:   { flexDirection: "row", justifyContent: "space-between" },
  itemNombre:{ fontSize: 13, fontFamily: "SpaceGrotesk_500Medium" },
  itemPrecio:{ fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  solicitudBtns: { flexDirection: "row", gap: 10 },
  solicitudBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  solicitudBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },

  // Deudas
  clienteCard:   { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:        { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarText:    { fontSize: 16, fontFamily: "Syne_700Bold" },
  clienteNombre: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  clienteEmail:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  acciones:      { gap: 6 },
  accionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  accionText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },

  // Historial
  movCard:  { flexDirection: "row", alignItems: "center", gap: 12 },
  movDesc:  { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  movFecha: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard:    { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16 },
  modalTitle:   { fontSize: 20, fontFamily: "Syne_700Bold" },
  modalCliente: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  modalDeuda:   { fontSize: 16, fontFamily: "Syne_700Bold" },
  inputLabel:   { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  input: {
    height: 48, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15, fontFamily: "SpaceGrotesk_400Regular",
  },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1, height: 48, borderRadius: 10, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});
