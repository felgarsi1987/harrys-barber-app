import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Modal, Switch, Image,
} from "react-native";
import { MaterialIcons }  from "@expo/vector-icons";
import * as ImagePicker   from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import {
  collection, getDocs, addDoc, updateDoc,
  deleteDoc, doc, Timestamp, orderBy, query, getDocs as gd,
} from "firebase/firestore";
import { db, storage }    from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { Calendar, LocaleConfig } from "react-native-calendars";

LocaleConfig.locales["es"] = {
  monthNames: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  monthNamesShort: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
  dayNames: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
  dayNamesShort: ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],
};
LocaleConfig.defaultLocale = "es";

interface Evento {
  id:          string;
  titulo:      string;
  descripcion: string;
  fecha:       string;
  activo:      boolean;
  imageUrl?:   string;
}

const EMPTY_FORM = { titulo: "", descripcion: "", fecha: "", activo: true };

export function AdminEventosScreen() {
  const c = useThemeColors();
  const [eventos,       setEventos]       = useState<Evento[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [guardando,     setGuardando]     = useState(false);
  const [showCalendar,  setShowCalendar]  = useState(false);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [editando,      setEditando]      = useState<Evento | null>(null);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [imageUri,      setImageUri]      = useState<string | null>(null);
  const [uploadingImg,  setUploadingImg]  = useState(false);

  useEffect(() => { loadEventos(); }, []);

  const loadEventos = async () => {
    try {
      const snap = await getDocs(
        query(collection(db, "eventos"), orderBy("createdAt", "desc"))
      );
      setEventos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Evento));
    } catch {}
    finally { setLoading(false); }
  };

  const abrirModal = (evento?: Evento) => {
    if (evento) {
      setEditando(evento);
      setForm({ titulo: evento.titulo, descripcion: evento.descripcion, fecha: evento.fecha, activo: evento.activo });
      setImageUri(evento.imageUrl ?? null);
    } else {
      setEditando(null);
      setForm(EMPTY_FORM);
      setImageUri(null);
    }
    setShowCalendar(false);
    setModalVisible(true);
  };

  // ── Seleccionar imagen ───────────────────────────────────────────────────
  const seleccionarImagen = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a la cámara.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const elegirImagen = () => {
    Alert.alert("Agregar imagen", "¿De dónde quieres elegir la imagen?", [
      { text: "Cancelar",  style: "cancel" },
      { text: "📷 Cámara", onPress: tomarFoto },
      { text: "🖼️ Galería", onPress: seleccionarImagen },
    ]);
  };

  // ── Subir imagen a Firebase Storage ─────────────────────────────────────
  const uploadImagen = async (uri: string, eventoId: string): Promise<string> => {
    const response = await fetch(uri);
    const blob     = await response.blob();
    const imgRef   = ref(storage, `eventos/${eventoId}_${Date.now()}.jpg`);
    await uploadBytes(imgRef, blob);
    return await getDownloadURL(imgRef);
  };

  // ── Guardar evento ───────────────────────────────────────────────────────
  const guardar = async () => {
    if (!form.titulo.trim() || !form.descripcion.trim() || !form.fecha) {
      Alert.alert("Faltan datos", "Completa título, descripción y fecha.");
      return;
    }
    setGuardando(true);
    try {
      let imageUrl = editando?.imageUrl ?? null;

      // Si hay nueva imagen local, subirla primero
      if (imageUri && !imageUri.startsWith("http")) {
        setUploadingImg(true);
        const tempId = editando?.id ?? `temp_${Date.now()}`;
        imageUrl = await uploadImagen(imageUri, tempId);
        setUploadingImg(false);
      } else if (!imageUri) {
        imageUrl = null; // imagen eliminada
      }

      if (editando) {
        await updateDoc(doc(db, "eventos", editando.id), {
          ...form,
          imageUrl: imageUrl ?? null,
          updatedAt: Timestamp.now(),
        });
        setEventos(prev => prev.map(e =>
          e.id === editando.id ? { ...e, ...form, imageUrl: imageUrl ?? undefined } : e
        ));
      } else {
        const docRef = await addDoc(collection(db, "eventos"), {
          ...form,
          imageUrl: null,
          createdAt: Timestamp.now(),
        });
        // Si hay imagen, subirla con el ID real del documento
        if (imageUri) {
          setUploadingImg(true);
          const url = await uploadImagen(imageUri, docRef.id);
          await updateDoc(docRef, { imageUrl: url });
          imageUrl = url;
          setUploadingImg(false);
        }
        setEventos(prev => [
          { id: docRef.id, ...form, imageUrl: imageUrl ?? undefined },
          ...prev,
        ]);

        // Notificar a todos los clientes si el evento está activo
        if (form.activo) {
          notificarTodosLosClientes(form.titulo, form.descripcion);
        }
      }
      setModalVisible(false);
    } catch(e: any) {
      Alert.alert("Error", "No se pudo guardar el evento.");
    } finally {
      setGuardando(false);
      setUploadingImg(false);
    }
  };

  // ── Notificar a todos los clientes ───────────────────────────────────────
  const notificarTodosLosClientes = async (titulo: string, descripcion: string) => {
    try {
      const snap = await getDocs(
        query(collection(db, "users"), ...[])
      );
      const tokens: string[] = [];
      snap.docs.forEach(d => {
        const pushToken = d.data().pushToken;
        if (pushToken) tokens.push(pushToken);
      });

      if (tokens.length === 0) return;

      // Enviar en lotes de 100 (límite de Expo Push API)
      for (let i = 0; i < tokens.length; i += 100) {
        const batch = tokens.slice(i, i + 100).map(token => ({
          to:        token,
          title:     `🎉 ${titulo}`,
          body:      descripcion,
          sound:     "default",
          channelId: "reservas",
          data:      { tipo: "evento" },
        }));
        await fetch("https://exp.host/--/api/v2/push/send", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(batch),
        });
      }
    } catch {}
  };

  const toggleActivo = async (evento: Evento) => {
    try {
      await updateDoc(doc(db, "eventos", evento.id), { activo: !evento.activo });
      setEventos(prev => prev.map(e =>
        e.id === evento.id ? { ...e, activo: !e.activo } : e
      ));
      // Notificar al activar
      if (!evento.activo) {
        notificarTodosLosClientes(evento.titulo, evento.descripcion);
      }
    } catch {}
  };

  const eliminar = (evento: Evento) => {
    Alert.alert("¿Eliminar evento?", evento.titulo, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "eventos", evento.id));
            setEventos(prev => prev.filter(e => e.id !== evento.id));
          } catch {}
        },
      },
    ]);
  };

  const formatFecha = (f: string) => {
    if (!f) return "";
    return new Date(f + "T12:00:00").toLocaleDateString("es-CO", {
      day: "numeric", month: "long", year: "numeric",
    });
  };

  return (
    <ScreenWrapper keyboard={false}>
      <BackHeader title="Eventos y publicidad" />

      <ScrollView contentContainerStyle={styles.scroll}>

        <TouchableOpacity
          onPress={() => abrirModal()}
          style={[styles.addBtn, { backgroundColor: c.amber }]}
        >
          <MaterialIcons name="add" size={18} color="#000" />
          <Text style={styles.addBtnText}>Nuevo evento</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
        ) : eventos.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="campaign" size={48} color={c.sub} />
            <Text style={[styles.emptyText, { color: c.sub }]}>Sin eventos creados</Text>
          </View>
        ) : (
          eventos.map((e, i) => (
            <ThemedCard key={i} style={styles.eventoCard}>
              {/* Imagen del evento */}
              {e.imageUrl ? (
                <Image source={{ uri: e.imageUrl }} style={styles.eventoImg} resizeMode="cover" />
              ) : (
                <View style={[styles.eventoImgPlaceholder, { backgroundColor: c.border }]}>
                  <MaterialIcons name="image" size={24} color={c.sub} />
                </View>
              )}

              <View style={styles.eventoContent}>
                <View style={styles.eventoTop}>
                  <Text style={[styles.eventoTag, { color: c.amber }]}>EVENTO</Text>
                  <TagChip label={e.activo ? "Activo" : "Inactivo"} variant={e.activo ? "success" : "default"} />
                </View>
                <Text style={[styles.eventoTitulo, { color: c.text }]}>{e.titulo}</Text>
                <Text style={[styles.eventoDesc, { color: c.sub }]} numberOfLines={2}>{e.descripcion}</Text>
                {e.fecha ? (
                  <View style={styles.fechaRow}>
                    <MaterialIcons name="event" size={13} color={c.sub} />
                    <Text style={[styles.eventoFecha, { color: c.sub }]}>{formatFecha(e.fecha)}</Text>
                  </View>
                ) : null}

                <View style={styles.eventoActions}>
                  <TouchableOpacity
                    onPress={() => abrirModal(e)}
                    style={[styles.actionBtn, { borderColor: c.border }]}
                  >
                    <MaterialIcons name="edit" size={15} color={c.text} />
                    <Text style={[styles.actionBtnText, { color: c.text }]}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => toggleActivo(e)}
                    style={[styles.actionBtn, { borderColor: e.activo ? c.amber : c.border }]}
                  >
                    <MaterialIcons name={e.activo ? "visibility-off" : "visibility"} size={15} color={e.activo ? c.amber : c.sub} />
                    <Text style={[styles.actionBtnText, { color: e.activo ? c.amber : c.sub }]}>
                      {e.activo ? "Desactivar" : "Activar"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => notificarTodosLosClientes(e.titulo, e.descripcion)}
                    style={[styles.actionBtn, { borderColor: c.blue }]}
                  >
                    <MaterialIcons name="notifications" size={15} color={c.blue} />
                    <Text style={[styles.actionBtnText, { color: c.blue }]}>Notificar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => eliminar(e)} style={[styles.actionBtn, { borderColor: c.negative + "44" }]}>
                    <MaterialIcons name="delete" size={15} color={c.negative} />
                  </TouchableOpacity>
                </View>
              </View>
            </ThemedCard>
          ))
        )}
      </ScrollView>

      {/* Modal crear/editar */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {editando ? "Editar evento" : "Nuevo evento"}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 14 }}>

              {/* Imagen */}
              <View style={{ gap: 8 }}>
                <Text style={[styles.inputLabel, { color: c.sub }]}>IMAGEN DEL EVENTO</Text>
                {imageUri ? (
                  <View style={{ gap: 8 }}>
                    <Image source={{ uri: imageUri }} style={styles.previewImg} resizeMode="cover" />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity onPress={elegirImagen} style={[styles.imgBtn, { borderColor: c.border }]}>
                        <MaterialIcons name="edit" size={14} color={c.text} />
                        <Text style={[styles.imgBtnText, { color: c.text }]}>Cambiar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setImageUri(null)} style={[styles.imgBtn, { borderColor: c.negative + "44" }]}>
                        <MaterialIcons name="delete" size={14} color={c.negative} />
                        <Text style={[styles.imgBtnText, { color: c.negative }]}>Quitar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={elegirImagen}
                    style={[styles.imgPlaceholder, { borderColor: c.border, backgroundColor: c.bg }]}
                  >
                    <MaterialIcons name="add-photo-alternate" size={32} color={c.sub} />
                    <Text style={[styles.imgPlaceholderText, { color: c.sub }]}>
                      Toca para agregar imagen
                    </Text>
                    <Text style={[styles.imgPlaceholderSub, { color: c.sub }]}>
                      Cámara o galería · 16:9
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Campos de texto */}
              {[
                { key: "titulo",      label: "TÍTULO",       placeholder: "Ej. Descuento del 20%" },
                { key: "descripcion", label: "DESCRIPCIÓN",  placeholder: "Descripción del evento", multi: true },
              ].map(f => (
                <View key={f.key} style={{ gap: 4 }}>
                  <Text style={[styles.inputLabel, { color: c.sub }]}>{f.label}</Text>
                  <TextInput
                    style={[styles.input, { color: c.text, backgroundColor: c.bg, borderColor: c.border },
                      f.multi && { height: 80, textAlignVertical: "top", paddingTop: 10 }
                    ]}
                    value={form[f.key as keyof typeof form] as string}
                    onChangeText={val => setForm(prev => ({ ...prev, [f.key]: val }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={c.sub}
                    multiline={!!f.multi}
                    numberOfLines={f.multi ? 3 : 1}
                  />
                </View>
              ))}

              {/* Fecha */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.inputLabel, { color: c.sub }]}>FECHA DEL EVENTO</Text>
                <TouchableOpacity
                  onPress={() => setShowCalendar(!showCalendar)}
                  style={[styles.fechaBtn, { borderColor: form.fecha ? c.amber : c.border, backgroundColor: c.bg }]}
                >
                  <MaterialIcons name="calendar-today" size={16} color={form.fecha ? c.amber : c.sub} />
                  <Text style={[styles.fechaBtnText, { color: form.fecha ? c.text : c.sub }]}>
                    {form.fecha ? formatFecha(form.fecha) : "Seleccionar fecha"}
                  </Text>
                  <MaterialIcons name={showCalendar ? "expand-less" : "expand-more"} size={18} color={c.sub} />
                </TouchableOpacity>
                {showCalendar && (
                  <Calendar
                    minDate={new Date().toISOString().split("T")[0]}
                    onDayPress={day => {
                      setForm(prev => ({ ...prev, fecha: day.dateString }));
                      setShowCalendar(false);
                    }}
                    markedDates={form.fecha ? { [form.fecha]: { selected: true, selectedColor: c.amber } } : {}}
                    theme={{
                      backgroundColor: c.bg, calendarBackground: c.surface,
                      textSectionTitleColor: c.sub,
                      selectedDayBackgroundColor: c.amber, selectedDayTextColor: "#000",
                      todayTextColor: c.amber, dayTextColor: c.text,
                      textDisabledColor: c.border, arrowColor: c.amber, monthTextColor: c.text,
                      textDayFontFamily: "SpaceGrotesk_500Medium",
                      textMonthFontFamily: "Syne_700Bold",
                      textDayHeaderFontFamily: "SpaceGrotesk_400Regular",
                    }}
                    style={{ borderRadius: 12, overflow: "hidden" }}
                  />
                )}
              </View>

              {/* Toggle activo */}
              <View style={styles.activoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activoLabel, { color: c.text }]}>Mostrar en home</Text>
                  <Text style={[styles.activoSub, { color: c.sub }]}>Visible para todos los usuarios</Text>
                </View>
                <Switch
                  value={form.activo}
                  onValueChange={val => setForm(prev => ({ ...prev, activo: val }))}
                  trackColor={{ false: c.border, true: c.amber + "66" }}
                  thumbColor={form.activo ? c.amber : c.sub}
                />
              </View>

            </ScrollView>

            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.modalBtn, { borderColor: c.border }]}>
                <Text style={[styles.modalBtnText, { color: c.sub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={guardar}
                disabled={guardando}
                style={[styles.modalBtn, { backgroundColor: c.amber }]}
              >
                {guardando ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <ActivityIndicator color="#000" size="small" />
                    <Text style={[styles.modalBtnText, { color: "#000" }]}>
                      {uploadingImg ? "Subiendo imagen..." : "Guardando..."}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#000" }]}>
                    {editando ? "Guardar" : "Crear y notificar"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll:       { padding: 20, gap: 14 },
  addBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 12 },
  addBtnText:   { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  empty:        { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText:    { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  eventoCard:   { padding: 0, overflow: "hidden", gap: 0 },
  eventoImg:    { width: "100%", height: 140 },
  eventoImgPlaceholder: { width: "100%", height: 80, justifyContent: "center", alignItems: "center" },
  eventoContent:{ padding: 14, gap: 8 },
  eventoTop:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eventoTag:    { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  eventoTitulo: { fontSize: 16, fontFamily: "Syne_700Bold" },
  eventoDesc:   { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", lineHeight: 18 },
  fechaRow:     { flexDirection: "row", alignItems: "center", gap: 6 },
  eventoFecha:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  eventoActions:{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 },
  actionBtn:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actionBtnText:{ fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard:    { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16, maxHeight: "90%" },
  modalTitle:   { fontSize: 20, fontFamily: "Syne_700Bold" },
  inputLabel:   { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  input:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  imgPlaceholder:{ height: 120, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 12, justifyContent: "center", alignItems: "center", gap: 6 },
  imgPlaceholderText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium" },
  imgPlaceholderSub:  { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  previewImg:   { width: "100%", height: 140, borderRadius: 10 },
  imgBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 36, borderWidth: 1, borderRadius: 8 },
  imgBtnText:   { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
  fechaBtn:     { flexDirection: "row", alignItems: "center", gap: 8, height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14 },
  fechaBtnText: { flex: 1, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  activoRow:    { flexDirection: "row", alignItems: "center", gap: 12 },
  activoLabel:  { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  activoSub:    { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  modalBtns:    { flexDirection: "row", gap: 10 },
  modalBtn:     { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  modalBtnText: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
});
