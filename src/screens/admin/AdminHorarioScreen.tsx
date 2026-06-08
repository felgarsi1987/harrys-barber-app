import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, TouchableOpacity, Switch, Alert,
} from "react-native";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";

const DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

interface HorarioConfig {
  dias:     Record<string, boolean>;
  horaInicio: string;
  horaFin:    string;
  duracionTurno: number;
}

const DEFAULT: HorarioConfig = {
  dias:          { Lunes:true, Martes:true, Miércoles:true, Jueves:true, Viernes:true, Sábado:true, Domingo:false },
  horaInicio:    "08:00",
  horaFin:       "18:00",
  duracionTurno: 30,
};

export function AdminHorarioScreen() {
  const c = useThemeColors();
  const [config,  setConfig]  = useState<HorarioConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    getDoc(doc(db, "config", "horario")).then(snap => {
      if (snap.exists()) setConfig(snap.data() as HorarioConfig);
      setLoading(false);
    });
  }, []);

  const toggleDia = (dia: string) => {
    setConfig(prev => ({
      ...prev,
      dias: { ...prev.dias, [dia]: !prev.dias[dia] },
    }));
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Horario</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Días disponibles */}
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
                trackColor={{ false: c.border, true: c.blue + "66" }}
                thumbColor={config.dias[dia] ? c.blue : c.sub}
              />
            </View>
          ))}
        </ThemedCard>

        {/* Duración de turno */}
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

        {/* Botón guardar */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: c.blue, opacity: saving ? 0.7 : 1 }]}
          onPress={guardar}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Guardando..." : "Guardar horario"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  title:        { fontSize: 22, fontFamily: "Syne_700Bold" },
  scroll:       { padding: 20, gap: 16 },
  sectionLabel: { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  card:         { gap: 0, padding: 0, overflow: "hidden" },
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
  saveBtnText: { color: "#fff", fontFamily: "SpaceGrotesk_600SemiBold", fontSize: 15 },
});