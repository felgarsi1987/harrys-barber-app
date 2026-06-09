import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import {
  collection, getDocs, query, where,
  doc, updateDoc, Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { programarRecordatorio, cancelarRecordatorio } from "../../services/notifications";

LocaleConfig.locales["es"] = {
  monthNames: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  monthNamesShort: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
  dayNames: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
  dayNamesShort: ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],
};
LocaleConfig.defaultLocale = "es";

interface Props {
  route: {
    params: {
      reservaId: string;
      servicio:  string;
      peluqueroUid: string;
      peluqueroNombre: string;
    };
  };
}

export function ClienteReagendarScreen({ route }: Props) {
  const { reservaId, servicio, peluqueroUid, peluqueroNombre } = route.params;
  const c = useThemeColors();

  const [fecha,         setFecha]         = useState("");
  const [hora,          setHora]          = useState("");
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const [horasConfig,   setHorasConfig]   = useState<string[]>([
    "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
    "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30",
  ]);
  const [guardando, setGuardando] = useState(false);

  const hoy     = new Date();
  const minDate = hoy.toISOString().split("T")[0];
  const maxDate = new Date(hoy.setDate(hoy.getDate() + 30)).toISOString().split("T")[0];

  useEffect(() => {
    if (!fecha || !peluqueroUid) return;
    const inicio = new Date(fecha + "T00:00:00");
    const fin    = new Date(fecha + "T23:59:59");
    getDocs(query(
      collection(db, "reservas"),
      where("peluqueroUid", "==", peluqueroUid),
      where("fecha", ">=", Timestamp.fromDate(inicio)),
      where("fecha", "<=", Timestamp.fromDate(fin)),
      where("estado", "in", ["pendiente","confirmada"])
    )).then(snap => {
      setHorasOcupadas(snap.docs.map(d => d.data().hora));
    }).catch(console.log);
  }, [fecha]);

  const confirmar = async () => {
    if (!fecha || !hora) {
      Alert.alert("Faltan datos", "Selecciona fecha y hora.");
      return;
    }
    setGuardando(true);
    try {
      const nuevaFecha = new Date(fecha + "T" + hora);
      await updateDoc(doc(db, "reservas", reservaId), {
        fecha:      Timestamp.fromDate(nuevaFecha),
        hora,
        estado:     "pendiente",
        updatedAt:  Timestamp.now(),
      });
      // Cancelar recordatorio anterior y programar nuevo
      await cancelarRecordatorio(reservaId);
      await programarRecordatorio(reservaId, servicio, nuevaFecha, peluqueroNombre);
      Alert.alert("✅ Reagendado", `Tu cita quedó para el ${fecha} a las ${hora}.`);
    } catch {
      Alert.alert("Error", "No se pudo reagendar.");
    } finally { setGuardando(false); }
  };

  const horasDisponibles = horasConfig.filter(h => !horasOcupadas.includes(h));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <BackHeader title="Reagendar cita" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedCard style={styles.infoCard}>
          <Text style={[styles.servicio, { color: c.text }]}>{servicio}</Text>
          <Text style={[styles.peluquero, { color: c.sub }]}>con {peluqueroNombre}</Text>
        </ThemedCard>

        <Text style={[styles.sectionLabel, { color: c.sub }]}>NUEVA FECHA</Text>
        <Calendar
          minDate={minDate}
          maxDate={maxDate}
          onDayPress={d => { setFecha(d.dateString); setHora(""); }}
          markedDates={fecha ? { [fecha]: { selected: true, selectedColor: c.amber } } : {}}
          theme={{
            backgroundColor:           c.bg,
            calendarBackground:        c.surface,
            textSectionTitleColor:     c.sub,
            selectedDayBackgroundColor: c.amber,
            selectedDayTextColor:      "#000",
            todayTextColor:            c.amber,
            dayTextColor:              c.text,
            textDisabledColor:         c.border,
            arrowColor:                c.amber,
            monthTextColor:            c.text,
            textDayFontFamily:         "SpaceGrotesk_500Medium",
            textMonthFontFamily:       "Syne_700Bold",
            textDayHeaderFontFamily:   "SpaceGrotesk_400Regular",
            textDayFontSize:           14,
            textMonthFontSize:         16,
          }}
          style={{ borderRadius: 12 }}
        />

        {fecha && (
          <>
            <Text style={[styles.sectionLabel, { color: c.sub }]}>NUEVA HORA</Text>
            <View style={styles.horasGrid}>
              {horasConfig.map((h, i) => {
                const ocupada = horasOcupadas.includes(h);
                const sel     = hora === h;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => !ocupada && setHora(h)}
                    disabled={ocupada}
                    style={[
                      styles.horaBtn,
                      {
                        borderColor:     sel ? c.amber : ocupada ? c.border : c.border,
                        backgroundColor: sel ? c.amber + "18" : ocupada ? c.border + "40" : c.surface,
                        opacity:         ocupada ? 0.4 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.horaText, { color: sel ? c.amber : ocupada ? c.sub : c.text }]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {fecha && hora && (
          <TouchableOpacity
            style={[styles.confirmarBtn, { backgroundColor: c.amber, opacity: guardando ? 0.7 : 1 }]}
            onPress={confirmar}
            disabled={guardando}
          >
            {guardando
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.confirmarBtnText}>Confirmar reagenda</Text>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  infoCard: { gap: 4 },
  servicio:     { fontSize: 18, fontFamily: "Syne_700Bold" },
  peluquero:    { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  sectionLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  horasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horaBtn: {
    width: "22%", borderWidth: 1, borderRadius: 8,
    padding: 8, alignItems: "center",
  },
  horaText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  confirmarBtn: {
    height: 52, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginTop: 8,
  },
  confirmarBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
});
