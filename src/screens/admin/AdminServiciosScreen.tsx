import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, SafeAreaView,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
  Modal, Switch, RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../../hooks/useThemeColors";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import {
  Servicio, getAllServicios, crearServicio,
  actualizarServicio, eliminarServicio,
} from "../../services/serviciosService";

const EMPTY_FORM = { label: "", precio: "", duracion: "", activo: true, orden: 0 };

export function AdminServiciosScreen() {
  const c = useThemeColors();
  const [servicios,   setServicios]   = useState<Servicio[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [modalVisible,setModalVisible]= useState(false);
  const [editando,    setEditando]    = useState<Servicio | null>(null);
  const [guardando,   setGuardando]   = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    try {
      const data = await getAllServicios();
      setServicios(data);
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const abrirCrear = () => {
    setEditando(null);
    setForm({ ...EMPTY_FORM, orden: servicios.length });
    setModalVisible(true);
  };

  const abrirEditar = (s: Servicio) => {
    setEditando(s);
    setForm({
      label:    s.label,
      precio:   s.precio.toString(),
      duracion: s.duracion.toString(),
      activo:   s.activo,
      orden:    s.orden,
    });
    setModalVisible(true);
  };

  const confirmarEliminar = (s: Servicio) => {
    Alert.alert(
      "Eliminar servicio",
      `¿Eliminar "${s.label}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar", style: "destructive",
          onPress: async () => {
            try {
              await eliminarServicio(s.id);
              setServicios(prev => prev.filter(x => x.id !== s.id));
            } catch { Alert.alert("Error", "No se pudo eliminar."); }
          },
        },
      ]
    );
  };

  const guardar = async () => {
    if (!form.label.trim()) {
      Alert.alert("Error", "El nombre es obligatorio.");
      return;
    }
    const precio   = Number(form.precio);
    const duracion = Number(form.duracion);
    if (isNaN(precio) || precio <= 0) {
      Alert.alert("Error", "Ingresa un precio válido.");
      return;
    }
    if (isNaN(duracion) || duracion <= 0) {
      Alert.alert("Error", "Ingresa una duración válida en minutos.");
      return;
    }

    setGuardando(true);
    try {
      const data = {
        label:    form.label.trim(),
        precio,
        duracion,
        activo:   form.activo,
        orden:    form.orden,
      };

      if (editando) {
        await actualizarServicio(editando.id, data);
        setServicios(prev => prev.map(s => s.id === editando.id ? { ...s, ...data } : s));
      } else {
        const id = await crearServicio(data);
        setServicios(prev => [...prev, { id, ...data }]);
      }
      setModalVisible(false);
    } catch { Alert.alert("Error", "No se pudo guardar."); }
    finally { setGuardando(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <BackHeader title="Servicios" />

      {/* Subheader con botón agregar */}
      <View style={[styles.subHeader, { borderBottomColor: c.border }]}>
        <Text style={[styles.subLabel, { color: c.sub }]}>
          {servicios.filter(s => s.activo).length} servicios activos
        </Text>
        <TouchableOpacity
          onPress={abrirCrear}
          style={[styles.addBtn, { backgroundColor: c.amber }]}
        >
          <MaterialIcons name="add" size={20} color="#000" />
          <Text style={styles.addBtnText}>Nuevo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} />}
        >
          {servicios.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="content-cut" size={48} color={c.sub} />
              <Text style={[styles.emptyText, { color: c.sub }]}>
                No hay servicios. Crea el primero.
              </Text>
            </View>
          ) : (
            servicios.map((s, i) => (
              <ThemedCard key={i} style={[styles.card, !s.activo && { opacity: 0.5 }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.nombre, { color: c.text }]}>{s.label}</Text>
                    {!s.activo && <Text style={[styles.inactivoBadge, { color: c.sub, borderColor: c.border }]}>inactivo</Text>}
                  </View>
                  <View style={styles.cardMeta}>
                    <MaterialIcons name="attach-money" size={14} color={c.amber} />
                    <Text style={[styles.precio, { color: c.amber }]}>
                      ${s.precio.toLocaleString("es-CO")}
                    </Text>
                    <MaterialIcons name="schedule" size={14} color={c.sub} style={{ marginLeft: 8 }} />
                    <Text style={[styles.duracion, { color: c.sub }]}>{s.duracion} min</Text>
                  </View>
                </View>
                <View style={styles.acciones}>
                  <TouchableOpacity
                    onPress={() => abrirEditar(s)}
                    style={[styles.accionBtn, { backgroundColor: c.blue + "18" }]}
                  >
                    <MaterialIcons name="edit" size={16} color={c.blue} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmarEliminar(s)}
                    style={[styles.accionBtn, { backgroundColor: c.negative + "18" }]}
                  >
                    <MaterialIcons name="delete-outline" size={16} color={c.negative} />
                  </TouchableOpacity>
                </View>
              </ThemedCard>
            ))
          )}
        </ScrollView>
      )}

      {/* Modal crear/editar */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: c.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: c.text }]}>
                {editando ? "Editar servicio" : "Nuevo servicio"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={22} color={c.sub} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 14 }}>
              {[
                { key: "label",    label: "Nombre del servicio", placeholder: "Ej. Corte afro",   keyboard: "default" },
                { key: "precio",   label: "Precio (COP)",        placeholder: "Ej. 18000",         keyboard: "numeric" },
                { key: "duracion", label: "Duración (minutos)",  placeholder: "Ej. 30",            keyboard: "numeric" },
              ].map(f => (
                <View key={f.key} style={{ gap: 6 }}>
                  <Text style={[styles.inputLabel, { color: c.sub }]}>{f.label}</Text>
                  <TextInput
                    style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                    value={form[f.key as keyof typeof form]?.toString()}
                    onChangeText={val => setForm(prev => ({ ...prev, [f.key]: val }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={c.sub}
                    keyboardType={f.keyboard as any}
                    autoCapitalize={f.key === "label" ? "words" : "none"}
                  />
                </View>
              ))}

              <View style={styles.switchRow}>
                <Text style={[styles.inputLabel, { color: c.sub }]}>Servicio activo</Text>
                <Switch
                  value={form.activo}
                  onValueChange={val => setForm(prev => ({ ...prev, activo: val }))}
                  trackColor={{ false: c.border, true: c.amber + "66" }}
                  thumbColor={form.activo ? c.amber : c.sub}
                />
              </View>
            </ScrollView>

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
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1 },
  subHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  subLabel:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  addBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  scroll:  { padding: 20, gap: 10 },
  empty:   { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  card:    { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  nombre:  { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  inactivoBadge: {
    fontSize: 10, fontFamily: "SpaceGrotesk_500Medium",
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  cardMeta:  { flexDirection: "row", alignItems: "center" },
  precio:    { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  duracion:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  acciones:  { flexDirection: "row", gap: 8 },
  accionBtn: { width: 34, height: 34, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 20, fontFamily: "Syne_700Bold" },
  inputLabel: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  input: {
    height: 48, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15, fontFamily: "SpaceGrotesk_400Regular",
  },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1, height: 48, borderRadius: 10, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});
