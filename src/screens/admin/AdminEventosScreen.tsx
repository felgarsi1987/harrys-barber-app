import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, Switch,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, Timestamp, orderBy, query,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";

interface Evento {
  id:          string;
  titulo:      string;
  descripcion: string;
  fecha:       string;
  activo:      boolean;
  createdAt:   Timestamp;
}

const EMPTY_FORM = { titulo: "", descripcion: "", fecha: "", activo: true };

export function AdminEventosScreen() {
  const c = useThemeColors();
  const [eventos,      setEventos]      = useState<Evento[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editando,     setEditando]     = useState<Evento | null>(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [guardando,    setGuardando]    = useState(false);

  const loadEventos = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "eventos"), orderBy("createdAt", "desc"))
      );
      setEventos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Evento));
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadEventos(); }, []);

  const abrirModal = (evento?: Evento) => {
    if (evento) {
      setEditando(evento);
      setForm({
        titulo:      evento.titulo,
        descripcion: evento.descripcion,
        fecha:       evento.fecha,
        activo:      evento.activo,
      });
    } else {
      setEditando(null);
      setForm(EMPTY_FORM);
    }
    setModalVisible(true);
  };

  const guardar = async () => {
    if (!form.titulo || !form.descripcion) {
      Alert.alert("Error", "Titulo y descripcion son requeridos.");
      return;
    }
    setGuardando(true);
    try {
      const data = {
        titulo:      form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        fecha:       form.fecha.trim(),
        activo:      form.activo,
        updatedAt:   Timestamp.now(),
      };
      if (editando) {
        await updateDoc(doc(db, "eventos", editando.id), data);
      } else {
        await addDoc(collection(db, "eventos"), {
          ...data, createdAt: Timestamp.now(),
        });
      }
      setModalVisible(false);
      loadEventos();
    } catch {
      Alert.alert("Error", "No se pudo guardar.");
    } finally { setGuardando(false); }
  };

  const toggleActivo = async (evento: Evento) => {
    try {
      await updateDoc(doc(db, "eventos", evento.id), { activo: !evento.activo });
      setEventos(prev =>
        prev.map(e => e.id === evento.id ? { ...e, activo: !e.activo } : e)
      );
    } catch {
      Alert.alert("Error", "No se pudo actualizar.");
    }
  };

  const eliminar = (evento: Evento) => {
    Alert.alert(
      "Eliminar evento",
      `¿Eliminar "${evento.titulo}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar", style: "destructive",
          onPress: async () => {
            await deleteDoc(doc(db, "eventos", evento.id));
            loadEventos();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Eventos</Text>
        <TouchableOpacity
          onPress={() => abrirModal()}
          style={[styles.addBtn, { backgroundColor: c.amber }]}
        >
          <MaterialIcons name="add" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {eventos.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="campaign" size={48} color={c.sub} />
              <Text style={[styles.emptyText, { color: c.sub }]}>
                Sin eventos. Crea el primero.
              </Text>
            </View>
          ) : (
            eventos.map((e, i) => (
              <ThemedCard key={i} style={styles.eventoCard}>
                <View style={styles.eventoTop}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.eventoTitulo, { color: c.text }]}>
                      {e.titulo}
                    </Text>
                    <Text style={[styles.eventoDesc, { color: c.sub }]}>
                      {e.descripcion}
                    </Text>
                    {e.fecha ? (
                      <Text style={[styles.eventoFecha, { color: c.amber }]}>
                        {e.fecha}
                      </Text>
                    ) : null}
                  </View>
                  <TagChip
                    label={e.activo ? "Activo" : "Inactivo"}
                    variant={e.activo ? "success" : "default"}
                  />
                </View>

                <View style={[styles.eventoFooter, { borderTopColor: c.border }]}>
                  <View style={styles.toggleRow}>
                    <Text style={[styles.toggleLabel, { color: c.sub }]}>
                      {e.activo ? "Visible en home" : "Oculto"}
                    </Text>
                    <Switch
                      value={e.activo}
                      onValueChange={() => toggleActivo(e)}
                      trackColor={{ false: c.border, true: c.amber + "66" }}
                      thumbColor={e.activo ? c.amber : c.sub}
                    />
                  </View>
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      onPress={() => abrirModal(e)}
                      style={[styles.footerBtn, { borderColor: c.border }]}
                    >
                      <MaterialIcons name="edit" size={16} color={c.text} />
                      <Text style={[styles.footerBtnText, { color: c.text }]}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => eliminar(e)}
                      style={[styles.footerBtn, { borderColor: c.negative + "44" }]}
                    >
                      <MaterialIcons name="delete-outline" size={16} color={c.negative} />
                      <Text style={[styles.footerBtnText, { color: c.negative }]}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ThemedCard>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {editando ? "Editar evento" : "Nuevo evento"}
            </Text>

            {[
              { key: "titulo",      label: "Titulo",      placeholder: "Ej. Descuento del 20%" },
              { key: "descripcion", label: "Descripcion", placeholder: "Descripcion del evento" },
              { key: "fecha",       label: "Fecha",       placeholder: "Ej. 15 de junio 2026" },
            ].map(f => (
              <View key={f.key} style={{ gap: 4 }}>
                <Text style={[styles.inputLabel, { color: c.sub }]}>{f.label}</Text>
                <TextInput
                  style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                  value={form[f.key as keyof typeof form] as string}
                  onChangeText={val => setForm(prev => ({ ...prev, [f.key]: val }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={c.sub}
                  multiline={f.key === "descripcion"}
                  numberOfLines={f.key === "descripcion" ? 3 : 1}
                />
              </View>
            ))}

            <View style={styles.activoRow}>
              <Text style={[styles.activoLabel, { color: c.text }]}>Mostrar en home</Text>
              <Switch
                value={form.activo}
                onValueChange={val => setForm(prev => ({ ...prev, activo: val }))}
                trackColor={{ false: c.border, true: c.amber + "66" }}
                thumbColor={form.activo ? c.amber : c.sub}
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
  safe:   { flex: 1 },
  header: {
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
  eventoCard:    { gap: 12 },
  eventoTop:     { flexDirection: "row", gap: 12 },
  eventoTitulo:  { fontSize: 16, fontFamily: "Syne_700Bold" },
  eventoDesc:    { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  eventoFecha:   { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  eventoFooter:  { borderTopWidth: 1, paddingTop: 12, gap: 10 },
  toggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  toggleLabel: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  btnRow:      { flexDirection: "row", gap: 10 },
  footerBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  footerBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 14,
  },
  modalTitle:  { fontSize: 20, fontFamily: "Syne_700Bold" },
  inputLabel:  { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  input: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular", minHeight: 46,
  },
  activoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  activoLabel: { fontSize: 15, fontFamily: "SpaceGrotesk_500Medium" },
  modalBtns:   { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1, height: 48, borderRadius: 10, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});