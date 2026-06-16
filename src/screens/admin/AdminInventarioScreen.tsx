import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BackHeader }    from "../../components/ui/BackHeader";
import {
  collection, addDoc, updateDoc,
  deleteDoc, doc, Timestamp, onSnapshot,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { NumberText }     from "../../components/ui/NumberText";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface Producto {
  id:        string;
  nombre:    string;
  categoria: string;
  stock:     number;
  stockMin:  number;
  precio:    number;
}

const CATEGORIAS = ["Bebidas", "Comestibles", "Otros"];

const EMPTY_FORM = {
  nombre: "", categoria: "Bebidas",
  stock: "", stockMin: "3", precio: "",
};

export function AdminInventarioScreen() {
  const c = useThemeColors();
  const [productos,    setProductos]    = useState<Producto[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editando,     setEditando]     = useState<Producto | null>(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [guardando,    setGuardando]    = useState(false);
  const [filtroCateg,  setFiltroCateg]  = useState("todos");

  const loadProductos = async () => { /* recarga automática vía onSnapshot */ };

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "inventario"),
      snap => { setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Producto)); setLoading(false); },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const abrirModal = (producto?: Producto) => {
    if (producto) {
      setEditando(producto);
      setForm({
        nombre:    producto.nombre,
        categoria: producto.categoria,
        stock:     producto.stock.toString(),
        stockMin:  (producto.stockMin ?? 3).toString(),
        precio:    producto.precio.toString(),
      });
    } else {
      setEditando(null);
      setForm(EMPTY_FORM);
    }
    setModalVisible(true);
  };

  const guardar = async () => {
    if (!form.nombre || !form.stock || !form.precio) {
      Alert.alert("Error", "Completa todos los campos.");
      return;
    }
    setGuardando(true);
    try {
      const data = {
        nombre:    form.nombre.trim(),
        categoria: form.categoria,
        stock:     Number(form.stock),
        stockMin:  Number(form.stockMin),
        precio:    Number(form.precio),
        updatedAt: Timestamp.now(),
      };
      if (editando) {
        await updateDoc(doc(db, "inventario", editando.id), data);
      } else {
        await addDoc(collection(db, "inventario"), {
          ...data, createdAt: Timestamp.now(),
        });
      }
      setModalVisible(false);
      loadProductos();
    } catch {
      Alert.alert("Error", "No se pudo guardar.");
    } finally { setGuardando(false); }
  };

  const eliminar = (producto: Producto) => {
    Alert.alert(
      "Eliminar producto",
      `¿Eliminar "${producto.nombre}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar", style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "inventario", producto.id));
            loadProductos();
          },
        },
      ]
    );
  };

  const getStockColor = (stock: number, min: number) => {
    if (stock === 0)  return c.negative;
    if (stock <= min) return c.amber;
    return c.positive;
  };

  const getBarWidth = (stock: number, min: number): number => {
    const max = Math.max(stock, min * 3, 10);
    return Math.min((stock / max) * 100, 100);
  };

  return (
    <ScreenWrapper scrollable>
      <BackHeader title="Inventario" />
      <View style={[styles.subHeader, { borderBottomColor: c.border }]}>
        <TouchableOpacity
          onPress={() => abrirModal()}
          style={[styles.addBtn, { backgroundColor: c.amber }]}
        >
          <MaterialIcons name="add" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Filtro categoría */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ paddingHorizontal: 16, paddingVertical: 8 }}
        contentContainerStyle={{ gap: 8 }}>
        {["todos", "Bebidas", "Comestibles", "Otros"].map(cat => (
          <TouchableOpacity key={cat} onPress={() => setFiltroCateg(cat)}
            style={{
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
              borderWidth: 1,
              borderColor: filtroCateg === cat ? c.amber : c.border,
              backgroundColor: filtroCateg === cat ? c.amber + "22" : "transparent",
            }}>
            <Text style={{ fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold",
              color: filtroCateg === cat ? c.amber : c.sub }}>
              {cat === "todos" ? "Todos" : cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {productos.filter(p => filtroCateg === "todos" || p.categoria === filtroCateg).length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="inventory-2" size={48} color={c.sub} />
              <Text style={[styles.emptyText, { color: c.sub }]}>
                Sin productos. Agrega el primero.
              </Text>
            </View>
          ) : (
            productos.filter(p => filtroCateg === "todos" || p.categoria === filtroCateg).map((p, i) => {
              const min   = p.stockMin ?? 3;
              const color = getStockColor(p.stock, min);
              const barW  = getBarWidth(p.stock, min);
              return (
                <ThemedCard key={i} style={styles.productoCard}>
                  <View style={styles.productoTop}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.productoNombre, { color: c.text }]}>
                        {p.nombre}
                      </Text>
                      <Text style={[styles.productoCategoria, { color: c.sub }]}>
                        {p.categoria}
                      </Text>
                      <NumberText size={14} positive>
                        ${p.precio.toLocaleString("es-CO")}
                      </NumberText>
                    </View>
                    <View style={styles.stockCol}>
                      <Text style={[styles.stockNum, { color }]}>{p.stock}</Text>
                      <Text style={[styles.stockUnits, { color: c.sub }]}>unid.</Text>
                    </View>
                    <View style={styles.botonesCol}>
                      <TouchableOpacity
                        onPress={() => abrirModal(p)}
                        style={[styles.iconBtn, { borderColor: c.border }]}
                      >
                        <MaterialIcons name="edit" size={16} color={c.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => eliminar(p)}
                        style={[styles.iconBtn, { borderColor: c.border }]}
                      >
                        <MaterialIcons name="delete-outline" size={16} color={c.negative} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.barTrack, { backgroundColor: c.border }]}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${barW}%` as any, backgroundColor: color },
                      ]}
                    />
                  </View>
                </ThemedCard>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal crear/editar */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={[styles.modalCard, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {editando ? "Editar producto" : "Nuevo producto"}
            </Text>

            {[
              { key: "nombre",   label: "Nombre",      placeholder: "Ej. Agua 500ml", keyboard: "default" },
              { key: "stock",    label: "Stock actual", placeholder: "Ej. 24",         keyboard: "numeric" },
              { key: "stockMin", label: "Stock mínimo", placeholder: "Ej. 5",          keyboard: "numeric" },
              { key: "precio",   label: "Precio",       placeholder: "Ej. 2000",       keyboard: "numeric" },
            ].map(f => (
              <View key={f.key} style={{ gap: 4 }}>
                <Text style={[styles.inputLabel, { color: c.sub }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                  value={form[f.key as keyof typeof form]}
                  onChangeText={val => setForm(prev => ({ ...prev, [f.key]: val }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={c.sub}
                  keyboardType={f.keyboard as any}
                />
              </View>
            ))}

            {/* Categoría */}
            <View style={{ gap: 4 }}>
              <Text style={[styles.inputLabel, { color: c.sub }]}>Categoría</Text>
              <View style={styles.categoriasRow}>
                {CATEGORIAS.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setForm(prev => ({ ...prev, categoria: cat }))}
                    style={[
                      styles.categoriaBtn,
                      {
                        borderColor:     form.categoria === cat ? c.amber : c.border,
                        backgroundColor: form.categoria === cat ? c.amber + "18" : c.bg,
                      },
                    ]}
                  >
                    <Text style={[styles.categoriaBtnText, {
                      color: form.categoria === cat ? c.amber : c.text,
                    }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.modalBtnText, { color: c.sub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={guardar}
                style={[styles.modalBtn, { backgroundColor: c.amber, opacity: guardando ? 0.7 : 1 }]}
                disabled={guardando}
              >
                {guardando
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={[styles.modalBtnText, { color: "#000" }]}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  subHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20,
    paddingVertical: 16, borderBottomWidth: 1,
  },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
  },
  scroll:  { padding: 20, gap: 12 },
  empty:   { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  productoCard:      { gap: 10 },
  productoTop:       { flexDirection: "row", alignItems: "center", gap: 12 },
  productoNombre:    { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  productoCategoria: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  stockCol:   { alignItems: "center", minWidth: 40 },
  stockNum:   { fontSize: 22, fontFamily: "Syne_700Bold" },
  stockUnits: { fontSize: 10, fontFamily: "SpaceGrotesk_400Regular" },
  botonesCol: { gap: 6 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, justifyContent: "center", alignItems: "center",
  },
  barTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  barFill:  { height: 4, borderRadius: 2 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 14,
  },
  modalTitle:  { fontSize: 20, fontFamily: "Syne_700Bold" },
  inputLabel:  { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  input: {
    height: 46, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 14,
    fontFamily: "SpaceGrotesk_400Regular",
  },
  categoriasRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoriaBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  categoriaBtnText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1, height: 48, borderRadius: 10, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});