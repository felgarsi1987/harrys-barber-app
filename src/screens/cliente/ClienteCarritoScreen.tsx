import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { collection, getDocs, addDoc, Timestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { NumberText }     from "../../components/ui/NumberText";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface Producto {
  id:        string;
  nombre:    string;
  precio:    number;
  stock:     number;
  categoria: string;
}

interface ItemCarrito extends Producto {
  cantidad: number;
}

export function ClienteCarritoScreen() {
  const c = useThemeColors();
  const { user } = useAuthStore();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito,   setCarrito]   = useState<ItemCarrito[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [enviando,  setEnviando]  = useState(false);

  useEffect(() => {
    getDocs(collection(db, "inventario"))
      .then(snap => {
        setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Producto));
      })
      .finally(() => setLoading(false));
  }, []);

  const agregar = (producto: Producto) => {
    setCarrito(prev => {
      const existe = prev.find(i => i.id === producto.id);
      if (existe) return prev.map(i => i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { ...producto, cantidad: 1 }];
    });
  };

  const quitar = (id: string) => {
    setCarrito(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      if (item.cantidad === 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  };

  const total = carrito.reduce((acc, i) => acc + i.precio * i.cantidad, 0);

  const enviarPedido = async (aCredito: boolean) => {
    if (carrito.length === 0) {
      Alert.alert("Carrito vacío", "Agrega productos.");
      return;
    }
    setEnviando(true);
    try {
      await addDoc(collection(db, "pedidos"), {
        clienteUid:    user?.uid,
        clienteNombre: `${user?.nombre} ${user?.apellido}`,
        clienteEmail:  user?.email ?? null,
        items: carrito.map(i => ({
          productoId: i.id,
          nombre:     i.nombre,
          precio:     i.precio,
          cantidad:   i.cantidad,
        })),
        total,
        estado:    aCredito ? "pendiente_credito" : "pendiente",
        aCredito,
        createdAt: Timestamp.now(),
      });

      setCarrito([]);
      Alert.alert(
        "✅ Pedido enviado",
        aCredito
          ? "Tu solicitud de crédito fue enviada. El administrador la revisará y recibirás una notificación con la respuesta."
          : "Tu pedido fue enviado. El admin lo aprobará pronto."
      );
    } catch {
      Alert.alert("Error", "No se pudo enviar el pedido.");
    } finally { setEnviando(false); }
  };

  const confirmarPedido = () => {
    Alert.alert(
      "¿Cómo pagas?",
      `Total: $${total.toLocaleString("es-CO")}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "💳 A crédito",
          onPress: () => enviarPedido(true),
        },
        {
          text: "💵 De contado",
          onPress: () => enviarPedido(false),
        },
      ]
    );
  };

  return (
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Tienda</Text>
        {carrito.length > 0 && (
          <View style={[styles.badge, { backgroundColor: c.amber }]}>
            <Text style={styles.badgeText}>{carrito.length}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionLabel, { color: c.sub }]}>PRODUCTOS</Text>

        {loading ? (
          <ActivityIndicator color={c.amber} />
        ) : productos.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="inventory-2" size={48} color={c.sub} />
            <Text style={[styles.emptyText, { color: c.sub }]}>Sin productos</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {productos.map((p, i) => {
              const enCarrito = carrito.find(ci => ci.id === p.id);
              return (
                <ThemedCard key={i} style={styles.productoCard}>
                  <Text style={[styles.productoNombre,   { color: c.text }]}>{p.nombre}</Text>
                  <Text style={[styles.productoCategoria,{ color: c.sub  }]}>{p.categoria}</Text>
                  <NumberText size={16} positive>
                    ${p.precio.toLocaleString("es-CO")}
                  </NumberText>
                  <View style={styles.productoActions}>
                    {enCarrito ? (
                      <View style={styles.cantRow}>
                        <TouchableOpacity
                          onPress={() => quitar(p.id)}
                          style={[styles.cantBtn, { borderColor: c.border }]}
                        >
                          <MaterialIcons name="remove" size={16} color={c.text} />
                        </TouchableOpacity>
                        <Text style={[styles.cant, { color: c.text }]}>
                          {enCarrito.cantidad}
                        </Text>
                        <TouchableOpacity
                          onPress={() => agregar(p)}
                          style={[styles.cantBtn, { borderColor: c.border }]}
                        >
                          <MaterialIcons name="add" size={16} color={c.text} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => agregar(p)}
                        style={[styles.addBtn, { backgroundColor: c.amber + "18", borderColor: c.amber + "44" }]}
                      >
                        <MaterialIcons name="add-shopping-cart" size={16} color={c.amber} />
                        <Text style={[styles.addBtnText, { color: c.amber }]}>Agregar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ThemedCard>
              );
            })}
          </View>
        )}

        {carrito.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: c.sub }]}>MI CARRITO</Text>
            <ThemedCard style={styles.carritoCard}>
              {carrito.map((item, i) => (
                <View
                  key={i}
                  style={[
                    styles.carritoItem,
                    i < carrito.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
                  ]}
                >
                  <Text style={[styles.itemNombre, { color: c.text }]}>
                    {item.nombre} x{item.cantidad}
                  </Text>
                  <NumberText size={14}>
                    ${(item.precio * item.cantidad).toLocaleString("es-CO")}
                  </NumberText>
                </View>
              ))}
              <View style={[styles.totalRow, { borderTopColor: c.border }]}>
                <Text style={[styles.totalLabel, { color: c.sub }]}>TOTAL</Text>
                <NumberText size={20} positive>
                  ${total.toLocaleString("es-CO")}
                </NumberText>
              </View>
            </ThemedCard>

            <TouchableOpacity
              style={[styles.enviarBtn, { backgroundColor: c.amber, opacity: enviando ? 0.7 : 1 }]}
              onPress={confirmarPedido}
              disabled={enviando}
            >
              {enviando
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.enviarBtnText}>Enviar pedido</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, gap: 8,
  },
  title:        { fontSize: 22, fontFamily: "Syne_700Bold", flex: 1 },
  badge: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: "center", alignItems: "center",
  },
  badgeText:    { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  scroll:       { padding: 20, gap: 16 },
  sectionLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  empty:        { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyText:    { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  grid:         { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  productoCard: { width: "47.5%", gap: 6 },
  productoNombre:    { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  productoCategoria: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  productoActions:   { marginTop: 4 },
  cantRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cantBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, justifyContent: "center", alignItems: "center",
  },
  cant:    { fontSize: 15, fontFamily: "Syne_700Bold" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  addBtnText:   { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  carritoCard:  { gap: 0, padding: 0, overflow: "hidden" },
  carritoItem: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 14,
  },
  itemNombre: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", padding: 14, borderTopWidth: 1,
  },
  totalLabel:   { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  enviarBtn: {
    height: 52, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  enviarBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
});