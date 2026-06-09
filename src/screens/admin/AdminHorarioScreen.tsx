import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, TouchableOpacity, Switch,
  Alert, ActivityIndicator, Modal, TextInput,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BackHeader }    from "../../components/ui/BackHeader";
import {
  doc, getDoc, setDoc, getDocs,
  collection, query, where, updateDoc,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";

const DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

const TODAS_LAS_HORAS = [
  "06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30",
  "10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30","20:00",
];

interface HorarioConfig {
  dias:          Record<string, boolean>;
  horaInicio:    string;
  horaFin:       string;
  duracionTurno: number;
}

interface Peluquero {
  uid:              string;
  nombre:           string;
  apellido:         string;
  role:             string;
  disponibleAgenda: boolean;
  horasBloqueadas?: string[];
}

const DEFAULT: HorarioConfig = {
  dias: {
    Lunes: true, Martes: true, Miércoles: true,
    Jueves: true, Viernes: true, Sábado: true, Domingo: false,
  },
  horaInicio:    "08:00",
  horaFin:       "18:00",
  duracionTurno: 30,
};

export function AdminHorarioScreen() {
  const c = useThemeColors();
  const [config,        setConfig]        = useState<HorarioConfig>(DEFAULT);
  const [peluqueros,    setPeluqueros]    = useState<Peluquero[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [modalBloqueo,  setModalBloqueo]  = useState(false);
  const [peluqueroSel,  setPeluqueroSel]  = useState<Peluquero | null>(null);
  const [savingBloqueo, setSavingBloqueo] = useState(false);

  // Horas disponibles según rango configurado
  const horasDisponibles = TODAS_LAS_HORAS.filter(h => {
    const [hh, mm] = h.split(":").map(Number);
    const [hi, mi] = config.horaInicio.split(":").map(Number);
    const [hf, mf] = config.horaFin.split(":").map(Number);
    const mins    = hh * 60 + mm;
    const minsIni = hi * 60 + mi;
    const minsFin = hf * 60 + mf;
    return mins >= minsIni && mins < minsFin;
  });

  useEffect(() => {
    Promise.all([
      getDoc(doc(db, "config", "horario")).then(snap => {
        if (snap.exists()) setConfig(snap.data() as HorarioConfig);
      }),
      getDocs(query(
        collection(db, "users"),
        where("role", "in", ["admin", "empleado"])
      )).then(snap => {
        setPeluqueros(snap.docs.map(d => d.data() as Peluquero));
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const toggleDia = (dia: string) => {
    setConfig(prev => ({
      ...prev,
      dias: { ...prev.dias, [dia]: !prev.dias[dia] },
    }));
  };

  const togglePeluquero = async (peluquero: Peluquero) => {
    try {
      await updateDoc(doc(db, "users", peluquero.uid), {
        disponibleAgenda: !peluquero.disponibleAgenda,
      });
      setPeluqueros(prev =>
        prev.map(p => p.uid === peluquero.uid
          ? { ...p, disponibleAgenda: !p.disponibleAgenda } : p
        )
      );
    } catch {
      Alert.alert("Error", "No se pudo actualizar.");
    }
  };

  const abrirBloqueo = (peluquero: Peluquero) => {
    setPeluqueroSel({ ...peluquero });
    setModalBloqueo(true);
  };

  const toggleHoraBloqueada = (hora: string) => {
    if (!peluqueroSel) return;
    const bloqueadas = peluqueroSel.horasBloqueadas ?? [];
    const nuevas = bloqueadas.includes(hora)
      ? bloqueadas.filter(h => h !== hora)
      : [...bloqueadas, hora];
    setPeluqueroSel({ ...peluqueroSel, horasBloqueadas: nuevas });
  };

  const guardarBloqueo = async () => {
    if (!peluqueroSel) return;
    setSavingBloqueo(true);
    try {
      await updateDoc(doc(db, "users", peluqueroSel.uid), {
        horasBloqueadas: peluqueroSel.horasBloqueadas ?? [],
      });
      setPeluqueros(prev =>
        prev.map(p => p.uid === peluqueroSel.uid
          ? { ...p, horasBloqueadas: peluqueroSel.horasBloqueadas } : p
        )
      );
      setModalBloqueo(false);
      Alert.alert("✅ Guardado", "Turnos bloqueados actualizados.");
    } catch {
      Alert.alert("Error", "No se pudo guardar.");
    } finally { setSavingBloqueo(false); }
  };

  const guardar = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "config", "horario"), config);
      Alert.alert("✅ Guardado", "Horario actualizado correctamente.");
    } catch {
      Alert.alert("Error", "No se pudo guardar.");
    } finally { setSaving(false); }
  };

  if (loading) return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <BackHeader title="Horario" />

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── PELUQUEROS ── */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>DISPONIBILIDAD DE PELUQUEROS</Text>
        <ThemedCard style={styles.card}>
          {peluqueros.map((p, i) => (
            <View
              key={p.uid}
              style={[
                styles.peluqueroRow,
                i < peluqueros.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: c.amber + "22" }]}>
                <Text style={[styles.avatarText, { color: c.amber }]}>
                  {p.nombre[0]}{p.apellido[0]}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.peluqueroNombre, { color: c.text }]}>
                  {p.nombre} {p.apellido}
                </Text>
                <Text style={[styles.peluqueroRol, { color: c.sub }]}>
                  {p.role === "admin" ? "Dueño / Admin" : "Barbero"}
                </Text>
                {(p.horasBloqueadas?.length ?? 0) > 0 && (
                  <Text style={[styles.bloqueadasCount, { color: c.negative }]}>
                    {p.horasBloqueadas?.length} turno(s) bloqueado(s)
                  </Text>
                )}
              </View>
              <View style={styles.peluqueroAcciones}>
                <TouchableOpacity
                  onPress={() => abrirBloqueo(p)}
                  style={[styles.bloqueoBtn, { borderColor: c.border }]}
                >
                  <MaterialIcons name="block" size={16} color={c.sub} />
                </TouchableOpacity>
                <Switch
                  value={p.disponibleAgenda}
                  onValueChange={() => togglePeluquero(p)}
                  trackColor={{ false: c.border, true: c.amber + "66" }}
                  thumbColor={p.disponibleAgenda ? c.amber : c.sub}
                />
              </View>
            </View>
          ))}
        </ThemedCard>

        {/* ── RANGO DE HORAS ── */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>HORARIO DE ATENCIÓN</Text>
        <ThemedCard style={styles.rangoCard}>
          <View style={styles.rangoRow}>
            <View style={styles.rangoBlock}>
              <Text style={[styles.rangoLabel, { color: c.sub }]}>Hora inicio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.horasRangoRow}>
                  {TODAS_LAS_HORAS.slice(0, 16).map(hora => (
                    <TouchableOpacity
                      key={hora}
                      onPress={() => setConfig(prev => ({ ...prev, horaInicio: hora }))}
                      style={[
                        styles.horaRangoBtn,
                        {
                          borderColor:     config.horaInicio === hora ? c.amber : c.border,
                          backgroundColor: config.horaInicio === hora ? c.amber + "18" : c.surface,
                        },
                      ]}
                    >
                      <Text style={[styles.horaRangoText, {
                        color: config.horaInicio === hora ? c.amber : c.text,
                      }]}>
                        {hora}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={[styles.rangoDivider, { backgroundColor: c.border }]} />

            <View style={styles.rangoBlock}>
              <Text style={[styles.rangoLabel, { color: c.sub }]}>Hora fin</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.horasRangoRow}>
                  {TODAS_LAS_HORAS.slice(8).map(hora => (
                    <TouchableOpacity
                      key={hora}
                      onPress={() => setConfig(prev => ({ ...prev, horaFin: hora }))}
                      style={[
                        styles.horaRangoBtn,
                        {
                          borderColor:     config.horaFin === hora ? c.amber : c.border,
                          backgroundColor: config.horaFin === hora ? c.amber + "18" : c.surface,
                        },
                      ]}
                    >
                      <Text style={[styles.horaRangoText, {
                        color: config.horaFin === hora ? c.amber : c.text,
                      }]}>
                        {hora}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          <View style={[styles.rangoResumen, { backgroundColor: c.bg, borderColor: c.border }]}>
            <MaterialIcons name="schedule" size={16} color={c.amber} />
            <Text style={[styles.rangoResumenText, { color: c.text }]}>
              Atención de {config.horaInicio} a {config.horaFin}
            </Text>
          </View>
        </ThemedCard>

        {/* ── DÍAS ── */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>DÍAS DISPONIBLES</Text>
        <ThemedCard style={styles.card}>
          {DIAS.map((dia, i) => (
            <View
              key={dia}
              style={[
                styles.diaRow,
                i < DIAS.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
              ]}
            >
              <Text style={[styles.diaText, { color: c.text }]}>{dia}</Text>
              <Switch
                value={config.dias[dia] ?? false}
                onValueChange={() => toggleDia(dia)}
                trackColor={{ false: c.border, true: c.amber + "66" }}
                thumbColor={config.dias[dia] ? c.amber : c.sub}
              />
            </View>
          ))}
        </ThemedCard>

        {/* ── DURACIÓN TURNO ── */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>DURACIÓN DE TURNO</Text>
        <ThemedCard style={styles.card}>
          <View style={styles.turnoRow}>
            {[15, 30, 45, 60].map(min => (
              <TouchableOpacity
                key={min}
                onPress={() => setConfig(prev => ({ ...prev, duracionTurno: min }))}
                style={[
                  styles.turnoBtn,
                  {
                    backgroundColor: config.duracionTurno === min ? c.blue : c.bg,
                    borderColor:     config.duracionTurno === min ? c.blue : c.border,
                  },
                ]}
              >
                <Text style={{
                  color:      config.duracionTurno === min ? "#fff" : c.text,
                  fontFamily: "SpaceGrotesk_600SemiBold",
                  fontSize:   13,
                }}>
                  {min} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ThemedCard>

        {/* ── GUARDAR ── */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: c.amber, opacity: saving ? 0.7 : 1 }]}
          onPress={guardar}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── MODAL BLOQUEO DE TURNOS ── */}
      <Modal visible={modalBloqueo} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: c.surface }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: c.text }]}>
                  Bloquear turnos
                </Text>
                <Text style={[styles.modalSub, { color: c.sub }]}>
                  {peluqueroSel?.nombre} {peluqueroSel?.apellido}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalBloqueo(false)}>
                <MaterialIcons name="close" size={22} color={c.sub} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalDesc, { color: c.sub }]}>
              Toca las horas que quieres bloquear para este peluquero.
            </Text>

            <ScrollView style={{ maxHeight: 280 }}>
              <View style={styles.horasGrid}>
                {horasDisponibles.map((hora, i) => {
                  const bloqueada = peluqueroSel?.horasBloqueadas?.includes(hora);
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => toggleHoraBloqueada(hora)}
                      style={[
                        styles.horaBloqueadaBtn,
                        {
                          borderColor:     bloqueada ? c.negative : c.border,
                          backgroundColor: bloqueada ? c.negative + "18" : c.bg,
                        },
                      ]}
                    >
                      <Text style={[styles.horaBloqueadaText, {
                        color: bloqueada ? c.negative : c.text,
                      }]}>
                        {hora}
                      </Text>
                      {bloqueada && (
                        <MaterialIcons name="block" size={10} color={c.negative} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {(peluqueroSel?.horasBloqueadas?.length ?? 0) > 0 && (
              <Text style={[styles.bloqueadasResumen, { color: c.negative }]}>
                {peluqueroSel?.horasBloqueadas?.length} turno(s) bloqueado(s): {peluqueroSel?.horasBloqueadas?.join(", ")}
              </Text>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setModalBloqueo(false)}
                style={[styles.modalBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.modalBtnText, { color: c.sub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={guardarBloqueo}
                style={[styles.modalBtn, { backgroundColor: c.amber, opacity: savingBloqueo ? 0.7 : 1 }]}
                disabled={savingBloqueo}
              >
                {savingBloqueo
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
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  scroll: { padding: 20, gap: 16 },
  sectionLabel:    { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  card:            { gap: 0, padding: 0, overflow: "hidden" },
  peluqueroRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
  },
  avatarText:       { fontSize: 14, fontFamily: "Syne_700Bold" },
  peluqueroNombre:  { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  peluqueroRol:     { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  bloqueadasCount:  { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", marginTop: 2 },
  peluqueroAcciones:{ flexDirection: "row", alignItems: "center", gap: 8 },
  bloqueoBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, justifyContent: "center", alignItems: "center",
  },
  rangoCard:   { gap: 12 },
  rangoRow:    { gap: 12 },
  rangoBlock:  { gap: 8 },
  rangoLabel:  { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 1 },
  horasRangoRow: { flexDirection: "row", gap: 6 },
  horaRangoBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  horaRangoText:  { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  rangoDivider:   { height: 1 },
  rangoResumen: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 10, borderRadius: 8, borderWidth: 1,
  },
  rangoResumenText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium" },
  diaRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 16, paddingVertical: 14,
  },
  diaText:  { fontSize: 15, fontFamily: "SpaceGrotesk_500Medium" },
  turnoRow: { flexDirection: "row", gap: 10, padding: 16, flexWrap: "wrap" },
  turnoBtn: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  saveBtn: {
    height: 52, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  saveBtnText: { color: "#000", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15 },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 14,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  modalTitle:  { fontSize: 20, fontFamily: "Syne_700Bold" },
  modalSub:    { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  modalDesc:   { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  horasGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 4 },
  horaBloqueadaBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
  },
  horaBloqueadaText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  bloqueadasResumen: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: {
    flex: 1, height: 48, borderRadius: 10, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});