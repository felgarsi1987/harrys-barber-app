import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  TextInput, Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, getDocs, addDoc, updateDoc, doc, getDoc,
  query, where, Timestamp, increment,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";

interface Producto {
  id: string; nombre: string; precio: number; stock: number; categoria: string;
}
interface ItemCarrito extends Producto { cantidad: number; }
interface Cliente { uid: string; nombre: string; apellido: string; email?: string; saldo?: number; }

interface Props {
  visible: boolean;
  onClose: () => void;
  mode:    "admin" | "empleado" | "cliente";
}

export function NuevoPedidoModal({ visible, onClose, mode }: Props) {
  const c = useThemeColors();
  const { user } = useAuthStore();
  const esAdmin = mode === "admin";

  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes,  setClientes]  = useState<Cliente[]>([]);
  const [cargando,  setCargando]  = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [carrito,      setCarrito]      = useState<ItemCarrito[]>([]);
  const [tipoCliente,  setTipoCliente]  = useState<"casual" | "registrado">("casual");
  const [nombreCasual, setNombreCasual] = useState("");
  const [buscar,       setBuscar]       = useState("");
  const [clienteSel,   setClienteSel]   = useState<Cliente | null>(null);

  // Cargar productos + clientes al abrir
  useEffect(() => {
    if (!visible) return;
    setCargando(true);
    Promise.all([
      getDocs(collection(db, "inventario")),
      getDocs(query(collection(db, "users"), where("role", "==", "cliente"))),
    ])
      .then(([invSnap, cliSnap]) => {
        setProductos(invSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Producto));
        setClientes(cliSnap.docs.map(d => ({ uid: d.id, ...d.data() }) as Cliente));
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [visible]);

  const reset = () => {
    setCarrito([]); setTipoCliente("casual"); setNombreCasual("");
    setBuscar(""); setClienteSel(null);
  };

  const cerrar = () => { reset(); onClose(); };

  const agregar = (p: Producto) => {
    setCarrito(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) {
        if (ex.cantidad >= p.stock) return prev; // no exceder stock
        return prev.map(i => i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      if (p.stock <= 0) return prev;
      return [...prev, { ...p, cantidad: 1 }];
    });
  };

  const quitar = (id: string) => {
    setCarrito(prev => {
      const it = prev.find(i => i.id === id);
      if (!it) return prev;
      if (it.cantidad === 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  };

  const total = carrito.reduce((a, i) => a + i.precio * i.cantidad, 0);

  const clientesFiltrados = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return clientes.slice(0, 8);
    return clientes.filter(cl =>
      `${cl.nombre} ${cl.apellido} ${cl.email ?? ""}`.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [buscar, clientes]);

  // Crédito solo si: admin + cliente registrado seleccionado
  const puedeCredito = esAdmin && tipoCliente === "registrado" && !!clienteSel;

  const registrar = async (aCredito: boolean) => {
    if (carrito.length === 0) { Alert.alert("Carrito vacío", "Agrega al menos un producto."); return; }
    if (tipoCliente === "casual" && !nombreCasual.trim()) {
      Alert.alert("Falta el nombre", "Escribe el nombre del cliente casual."); return;
    }
    if (tipoCliente === "registrado" && !clienteSel) {
      Alert.alert("Falta el cliente", "Selecciona un cliente registrado."); return;
    }

    const clienteUid    = tipoCliente === "registrado" ? clienteSel!.uid : null;
    const clienteNombre = tipoCliente === "registrado"
      ? `${clienteSel!.nombre} ${clienteSel!.apellido}`
      : nombreCasual.trim();

    setGuardando(true);
    try {
      // 1. Crear el pedido ya aprobado (venta de mostrador)
      await addDoc(collection(db, "pedidos"), {
        clienteUid,
        clienteNombre,
        clienteEmail: tipoCliente === "registrado" ? (clienteSel!.email ?? null) : null,
        items: carrito.map(i => ({
          productoId: i.id, nombre: i.nombre, precio: i.precio,
          cantidad: i.cantidad, categoria: i.categoria,
        })),
        total,
        estado:        "aprobado",
        aCredito,
        mostrador:     true,
        registradoPor: { uid: user?.uid ?? null, nombre: user ? `${user.nombre} ${user.apellido}` : "—" },
        createdAt:     Timestamp.now(),
      });

      // 2. Descontar stock de cada producto
      await Promise.all(carrito.map(i =>
        updateDoc(doc(db, "inventario", i.id), { stock: increment(-i.cantidad) }).catch(() => {})
      ));

      // 3. Si es a crédito (cliente registrado): cargar saldo + movimiento
      if (aCredito && clienteUid) {
        try {
          const uRef = doc(db, "users", clienteUid);
          const uSnap = await getDoc(uRef);
          const saldoActual = uSnap.exists() ? (uSnap.data().saldo ?? 0) : 0;
          await updateDoc(uRef, { saldo: saldoActual + total });
          await addDoc(collection(db, "movimientos"), {
            clienteUid,
            tipo:        "cargo",
            descripcion: `Tienda (mostrador) — ${carrito.map(i => `${i.nombre} x${i.cantidad}`).join(", ")}`,
            monto:       total,
            fecha:       Timestamp.now(),
          });
        } catch {}
      }

      Alert.alert(
        "✅ Pedido registrado",
        `${clienteNombre} — $${total.toLocaleString("es-CO")}${aCredito ? " (a crédito)" : " (contado)"}`,
      );
      cerrar();
    } catch {
      Alert.alert("Error", "No se pudo registrar el pedido.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmar = () => {
    if (puedeCredito) {
      Alert.alert(
        "¿Cómo paga?",
        `Total: $${total.toLocaleString("es-CO")}`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "💳 A crédito", onPress: () => registrar(true) },
          { text: "💵 De contado", onPress: () => registrar(false) },
        ],
      );
    } else {
      registrar(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: c.text }]}>Nuevo pedido</Text>
              <TouchableOpacity onPress={cerrar} hitSlop={10}>
                <MaterialIcons name="close" size={24} color={c.sub} />
              </TouchableOpacity>
            </View>

            {cargando ? (
              <ActivityIndicator color={c.amber} style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }} contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>

                {/* ── Cliente ── */}
                <View style={{ gap: 8 }}>
                  <Text style={[styles.label, { color: c.sub }]}>CLIENTE</Text>
                  <View style={styles.segment}>
                    {([["casual","Casual"],["registrado","Registrado"]] as const).map(([k, l]) => (
                      <TouchableOpacity
                        key={k}
                        onPress={() => { setTipoCliente(k); setClienteSel(null); }}
                        style={[styles.segBtn, {
                          backgroundColor: tipoCliente === k ? c.amber : "transparent",
                          borderColor: tipoCliente === k ? c.amber : c.border,
                        }]}
                      >
                        <Text style={[styles.segTxt, { color: tipoCliente === k ? "#000" : c.sub }]}>{l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {tipoCliente === "casual" ? (
                    <TextInput
                      style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                      value={nombreCasual}
                      onChangeText={setNombreCasual}
                      placeholder="Nombre del cliente casual"
                      placeholderTextColor={c.sub}
                    />
                  ) : clienteSel ? (
                    <View style={[styles.selRow, { borderColor: c.amber, backgroundColor: c.amber + "12" }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.selNombre, { color: c.text }]}>{clienteSel.nombre} {clienteSel.apellido}</Text>
                        {(clienteSel.saldo ?? 0) > 0 && (
                          <Text style={[styles.selSaldo, { color: c.negative }]}>Deuda actual: ${(clienteSel.saldo ?? 0).toLocaleString("es-CO")}</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => setClienteSel(null)} hitSlop={8}>
                        <MaterialIcons name="close" size={18} color={c.sub} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ gap: 6 }}>
                      <TextInput
                        style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                        value={buscar}
                        onChangeText={setBuscar}
                        placeholder="Buscar cliente por nombre o correo"
                        placeholderTextColor={c.sub}
                      />
                      {clientesFiltrados.map(cl => (
                        <TouchableOpacity
                          key={cl.uid}
                          onPress={() => { setClienteSel(cl); setBuscar(""); }}
                          style={[styles.cliItem, { borderColor: c.border }]}
                        >
                          <Text style={[styles.cliNombre, { color: c.text }]}>{cl.nombre} {cl.apellido}</Text>
                          {(cl.saldo ?? 0) > 0 && (
                            <Text style={[styles.cliSaldo, { color: c.negative }]}>${(cl.saldo ?? 0).toLocaleString("es-CO")}</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                      {clientes.length === 0 && (
                        <Text style={[styles.hint, { color: c.sub }]}>No hay clientes registrados.</Text>
                      )}
                    </View>
                  )}
                </View>

                {/* ── Productos ── */}
                <View style={{ gap: 8 }}>
                  <Text style={[styles.label, { color: c.sub }]}>PRODUCTOS</Text>
                  {productos.length === 0 ? (
                    <Text style={[styles.hint, { color: c.sub }]}>Sin productos en inventario.</Text>
                  ) : productos.map(p => {
                    const enCarr = carrito.find(i => i.id === p.id);
                    const agotado = p.stock <= 0;
                    const topeStock = !!enCarr && enCarr.cantidad >= p.stock;
                    return (
                      <View key={p.id} style={[styles.prodRow, { borderColor: c.border, opacity: agotado ? 0.5 : 1 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.prodNombre, { color: c.text }]}>{p.nombre}</Text>
                          <Text style={[styles.prodMeta, { color: c.sub }]}>
                            ${p.precio.toLocaleString("es-CO")} · {agotado ? "Agotado" : `Stock ${p.stock}`}
                          </Text>
                        </View>
                        {enCarr ? (
                          <View style={styles.stepper}>
                            <TouchableOpacity onPress={() => quitar(p.id)} style={[styles.stepBtn, { borderColor: c.border }]}>
                              <MaterialIcons name="remove" size={16} color={c.text} />
                            </TouchableOpacity>
                            <Text style={[styles.stepNum, { color: c.text }]}>{enCarr.cantidad}</Text>
                            <TouchableOpacity
                              onPress={() => agregar(p)}
                              disabled={topeStock}
                              style={[styles.stepBtn, { borderColor: c.border, opacity: topeStock ? 0.4 : 1 }]}
                            >
                              <MaterialIcons name="add" size={16} color={c.text} />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => agregar(p)}
                            disabled={agotado}
                            style={[styles.addBtn, { backgroundColor: c.amber + "18", borderColor: c.amber + "44" }]}
                          >
                            <MaterialIcons name="add" size={16} color={c.amber} />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* ── Footer total + acción ── */}
            {!cargando && (
              <View style={[styles.footer, { borderTopColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.totalLabel, { color: c.sub }]}>TOTAL</Text>
                  <Text style={[styles.totalNum, { color: c.amber }]}>${total.toLocaleString("es-CO")}</Text>
                </View>
                <TouchableOpacity
                  onPress={confirmar}
                  disabled={guardando || carrito.length === 0}
                  style={[styles.registrarBtn, { backgroundColor: c.amber, opacity: guardando || carrito.length === 0 ? 0.5 : 1 }]}
                >
                  {guardando
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.registrarTxt}>Registrar pedido</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  card:      { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 14, maxHeight: "92%" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title:     { fontSize: 20, fontFamily: "Syne_700Bold" },
  label:     { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  segment:   { flexDirection: "row", gap: 8 },
  segBtn:    { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  segTxt:    { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  input:     { height: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  selRow:    { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 12 },
  selNombre: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  selSaldo:  { fontSize: 11, fontFamily: "SpaceGrotesk_500Medium", marginTop: 2 },
  cliItem:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  cliNombre: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  cliSaldo:  { fontSize: 12, fontFamily: "Inter_500Medium" },
  hint:      { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", paddingVertical: 4 },
  prodRow:   { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  prodNombre:{ fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  prodMeta:  { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  addBtn:    { width: 34, height: 34, borderRadius: 10, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  stepper:   { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn:   { width: 30, height: 30, borderRadius: 15, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  stepNum:   { fontSize: 15, fontFamily: "Inter_700Bold", minWidth: 16, textAlign: "center" },
  footer:    { flexDirection: "row", alignItems: "center", gap: 14, borderTopWidth: 1, paddingTop: 14 },
  totalLabel:{ fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  totalNum:  { fontSize: 22, fontFamily: "Inter_700Bold" },
  registrarBtn: { height: 50, borderRadius: 12, paddingHorizontal: 24, justifyContent: "center", alignItems: "center" },
  registrarTxt: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
});
