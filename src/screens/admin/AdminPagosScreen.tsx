import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, getDocs, query, where,
  doc, addDoc, updateDoc, Timestamp, orderBy,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { NumberText }     from "../../components/ui/NumberText";
import { TagChip }        from "../../components/ui/TagChip";

interface ClienteConSaldo {
  uid:      string;
  nombre:   string;
  apellido: string;
  email:    string;
  saldo:    number;
}

interface Movimiento {
  id:          string;
  tipo:        "cargo" | "abono";
  descripcion: string;
  monto:       number;
  fecha:       Timestamp;
  clienteUid:  string;
}

export function AdminPagosScreen() {
  const c = useThemeColors();
  const [clientes,     setClientes]     = useState<ClienteConSaldo[]>([]);
  const [movimientos,  setMovimientos]  = useState<Movimiento[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [clienteSel,   setClienteSel]   = useState<ClienteConSaldo | null>(null);
  const [monto,        setMonto]        = useState("");
  const [descripcion,  setDescripcion]  = useState("");
  const [guardando,    setGuardando]    = useState(false);
  const [tab,          setTab]          = useState<"deudas" | "historial">("deudas");

  const loadData = async () => {
    try {
      // Clientes con saldo
      const clientesSnap = await getDocs(
        query(collection(db, "users"), where("role", "==", "cliente"))
      );
      const clientesData = clientesSnap.docs.map(d => d.data() as ClienteConSaldo);
      setClientes(clientesData.filter(c => (c.saldo ?? 0) > 0));

      // Historial de movimientos
      const movSnap = await getDocs(
        query(collection(db, "movimientos"), orderBy("fecha", "desc"))
      );
      setMovimientos(movSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Movimiento));
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const abrirModal = (cliente: ClienteConSaldo) => {
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
    if (montoNum <= 0) {
      Alert.alert("Error", "El monto debe ser mayor a 0.");
      return;
    }
    setGuardando(true);
    try {
      // Registrar movimiento
      await addDoc(collection(db, "movimientos"), {
        clienteUid:  clienteSel.uid,
        tipo:        "abono",
        descripcion: descripcion.trim() || "Abono registrado por admin",
        monto:       montoNum,
        fecha:       Timestamp.now(),
      });

      // Actualizar saldo del cliente
      const nuevoSaldo = Math.max((clienteSel.saldo ?? 0) - montoNum, 0);
      await updateDoc(doc(db, "users", clienteSel.uid), { saldo: nuevoSaldo });

      setModalVisible(false);
      Alert.alert("✅ Abono registrado", `$${montoNum.toLocaleString("es-CO")} abonado a ${clienteSel.nombre}.`);
      loadData();
    } catch {
      Alert.alert("Error", "No se pudo registrar el abono.");
    } finally { setGuardando(false); }
  };

  const enviarRecordatorio = (cliente: ClienteConSaldo) => {
    Alert.alert(
      "Recordatorio de pago",
      `¿Enviar notificación de pago a ${cliente.nombre}?\nDeuda: $${cliente.saldo.toLocaleString("es-CO")}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: async () => {
            try {
              await addDoc(collection(db, "notificaciones"), {
                clienteUid: cliente.uid,
                tipo:       "recordatorio_pago",
                mensaje:    `Tienes una deuda pendiente de $${cliente.saldo.toLocaleString("es-CO")}. Por favor comunícate con nosotros.`,
                fecha:      Timestamp.now(),
                leida:      false,
              });
              Alert.alert("✅ Enviado", "Recordatorio enviado.");
            } catch {
              Alert.alert("Error", "No se pudo enviar.");
            }
          },
        },
      ]
    );
  };

  const totalDeuda = clientes.reduce((acc, c) => acc + (c.saldo ?? 0), 0);

  const formatFecha = (ts: Timestamp) =>
    ts.toDate().toLocaleDateString("es-CO", {
      day: "numeric", month: "short", year: "numeric",
    });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Pagos y créditos</Text>
      </View>

      {/* Total deuda */}
      <ThemedCard style={styles.totalCard} elevated>
        <Text style={[styles.totalLabel, { color: c.sub }]}>TOTAL CRÉDITOS PENDIENTES</Text>
        <NumberText size={32} negative={totalDeuda > 0}>
          ${totalDeuda.toLocaleString("es-CO")}
        </NumberText>
        <Text style={[styles.totalDesc, { color: c.sub }]}>
          {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"} con deuda
        </Text>
      </ThemedCard>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: c.border }]}>
        {(["deudas", "historial"] as const).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabBtn,
              tab === t && { borderBottomWidth: 2, borderBottomColor: c.amber },
            ]}
          >
            <Text style={[styles.tabText, { color: tab === t ? c.amber : c.sub }]}>
              {t === "deudas" ? "Deudas" : "Historial"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {tab === "deudas" ? (
            clientes.length === 0 ? (
              <View style={styles.empty}>
                <MaterialIcons name="check-circle-outline" size={48} color={c.positive} />
                <Text style={[styles.emptyText, { color: c.sub }]}>
                  Todos los clientes están al día
                </Text>
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
                    <NumberText size={16} negative>
                      ${cli.saldo.toLocaleString("es-CO")}
                    </NumberText>
                  </View>
                  <View style={styles.acciones}>
                    <TouchableOpacity
                      onPress={() => abrirModal(cli)}
                      style={[styles.accionBtn, { backgroundColor: c.positive + "18" }]}
                    >
                      <MaterialIcons name="add" size={16} color={c.positive} />
                      <Text style={[styles.accionText, { color: c.positive }]}>Abonar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => enviarRecordatorio(cli)}
                      style={[styles.accionBtn, { backgroundColor: c.amber + "18" }]}
                    >
                      <MaterialIcons name="notifications" size={16} color={c.amber} />
                    </TouchableOpacity>
                  </View>
                </ThemedCard>
              ))
            )
          ) : (
            movimientos.length === 0 ? (
              <View style={styles.empty}>
                <MaterialIcons name="receipt-long" size={48} color={c.sub} />
                <Text style={[styles.emptyText, { color: c.sub }]}>Sin movimientos</Text>
              </View>
            ) : (
              movimientos.map((m, i) => (
                <ThemedCard key={i} style={styles.movCard}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.movDesc, { color: c.text }]}>{m.descripcion}</Text>
                    <Text style={[styles.movFecha, { color: c.sub }]}>{formatFecha(m.fecha)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <NumberText
                      size={15}
                      negative={m.tipo === "cargo"}
                      positive={m.tipo === "abono"}
                    >
                      {m.tipo === "cargo" ? "-" : "+"}${m.monto.toLocaleString("es-CO")}
                    </NumberText>
                    <TagChip
                      label={m.tipo}
                      variant={m.tipo === "cargo" ? "danger" : "success"}
                    />
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
            <Text style={[styles.modalTitle, { color: c.text }]}>
              Registrar abono
            </Text>
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  totalCard: {
    margin: 20, alignItems: "center", gap: 6, paddingVertical: 24,
  },
  totalLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  totalDesc:  { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  tabs: {
    flexDirection: "row", borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tabBtn:  { paddingVertical: 12, paddingHorizontal: 16 },
  tabText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  scroll:  { padding: 20, gap: 10 },
  empty:   { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  clienteCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
  },
  avatarText:    { fontSize: 16, fontFamily: "Syne_700Bold" },
  clienteNombre: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  clienteEmail:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  acciones:      { gap: 6 },
  accionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  accionText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  movCard:    { flexDirection: "row", alignItems: "center", gap: 12 },
  movDesc:    { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  movFecha:   { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 16,
  },
  modalTitle:   { fontSize: 20, fontFamily: "Syne_700Bold" },
  modalCliente: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  modalDeuda:   { fontSize: 16, fontFamily: "Syne_700Bold" },
  inputLabel:   { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  input: {
    height: 48, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15,
    fontFamily: "SpaceGrotesk_400Regular",
  },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1, height: 48, borderRadius: 10, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});