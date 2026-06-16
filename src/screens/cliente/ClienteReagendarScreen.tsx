import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import {
  collection, getDocs, query, where,
  doc, updateDoc, Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors }   from "../../hooks/useThemeColors";
import { useHorarioConfig } from "../../hooks/useHorarioConfig";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";
import { programarRecordatorio, cancelarRecordatorio } from "../../services/notifications";

LocaleConfig.locales["es"] = {
  monthNames: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  monthNamesShort: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
  dayNames: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
  dayNamesShort: ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],
};
LocaleConfig.defaultLocale = "es";

import { useRoute, RouteProp } from "@react-navigation/native";

type ReagendarParams = {
  ClienteReagendar: {
    reservaId: string;
    servicio:  string;
    peluqueroUid: string;
    peluqueroNombre: string;
  };
};

export function ClienteReagendarScreen() {
  const route = useRoute<RouteProp<ReagendarParams, "ClienteReagendar">>();
  const { reservaId, servicio, peluqueroUid, peluqueroNombre } = route.params;
  const c = useThemeColors();

  const [fecha,         setFecha]         = useState("");
  const [hora,          setHora]          = useState("");
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const { horas: horasConfig } = useHorarioConfig();

  const hoy     = new Date();
  const minDate = hoy.toISOString().split("T")[0];
  const maxDate = new Date(hoy.setDate(hoy.getDate() + 30)).toISOString().split("T")[0];

  useEffect(() => {
    if (!fecha || !peluqueroUid) return;
    // Query solo por peluqueroUid; filtrar fecha en JS para evitar índice compuesto
    getDocs(query(
      collection(db, "reservas"),
      where("peluqueroUid", "==", peluqueroUid),
    )).then(snap => {
      const ocupadas = snap.docs
        .filter(d => {
          const data = d.data();
          if (!["pendiente","confirmada"].includes(data.estado ?? "")) return false;
          const fechaRes: Date | null = data.fecha?.toDate?.() ?? null;
          if (!fechaRes) return false;
          const y = fechaRes.getFullYear();
          const m = String(fechaRes.getMonth() + 1).padStart(2, "0");
          const dd = String(fechaRes.getDate()).padStart(2, "0");
          return `${y}-${m}-${dd}` === fecha;
        })
        .map(d => d.data().hora as string);
      setHorasOcupadas(ocupadas);
    }).catch(() => {});
  }, [fecha]);

  const confirmar = async () => {
    if (!fecha || !hora) {
      Alert.alert("Faltan datos", "Selecciona fecha y hora.");
      return;
    }
    // Validate not in the past
    const nuevaFecha = new Date(fecha + "T" + hora);
    if (nuevaFecha <= new Date()) {
      Alert.alert("Hora no válida", "No puedes reagendar en una hora que ya pasó.");
      return;
    }
    setGuardando(true);
    try {
      await updateDoc(doc(db, "reservas", reservaId), {
        fecha:      Timestamp.fromDate(nuevaFecha),
        hora,
        estado:     "pendiente",
        updatedAt:  Timestamp.now(),
      });
      await cancelarRecordatorio(reservaId);
      await programarRecordatorio(reservaId, servicio, nuevaFecha, peluqueroNombre);
      Alert.alert("✅ Reagendado", `Tu cita quedó para el ${fecha} a las ${hora}.`);
    } catch {
      Alert.alert("Error", "No se pudo reagendar.");
    } finally { setGuardando(false); }
  };

  const esHoy = fecha === hoy.toISOString().split("T")[0];
  const horasDisponibles = horasConfig.filter(h => {
    if (horasOcupadas.includes(h)) return false;
    if (esHoy) {
      const [hh, mm] = h.split(":").map(Number);
      if (hh * 60 + mm <= hoy.getHours() * 60 + hoy.getMinutes()) return false;
    }
    return true;
  });

  return (
    <ScreenWrapper>
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
          key={c.mode}
          theme={{
            backgroundColor:           c.surface,
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
          style={{ backgroundColor: c.surface, borderRadius: 12 }}
        />

        {fecha && (
          <>
            <Text style={[styles.sectionLabel, { color: c.sub }]}>NUEVA HORA</Text>
            <View style={styles.horasGrid}>
              {horasConfig.map((h, i) => {
                const ocupada = horasOcupadas.includes(h);
                const sel     = hora === h;
                const [hh, mm] = h.split(":").map(Number);
                const pasada   = esHoy && (hh * 60 + mm) <= (hoy.getHours() * 60 + hoy.getMinutes());
                const noDisp   = ocupada || pasada;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => !noDisp && setHora(h)}
                    disabled={noDisp}
                    style={[
                      styles.horaBtn,
                      {
                        borderColor:     sel ? c.amber : ocupada ? c.negative + "66" : c.border,
                        backgroundColor: sel ? c.amber + "18" : ocupada ? c.negative + "11" : c.surface,
                        opacity:         pasada && !ocupada ? 0.35 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.horaText, { color: sel ? c.amber : ocupada ? c.negative : pasada ? c.sub : c.text }]}>
                      {h}
                    </Text>
                    {ocupada && <Text style={[styles.ocupadaText, { color: c.negative }]}>Ocupada</Text>}
                    {pasada && !ocupada && <Text style={[styles.ocupadaText, { color: c.sub }]}>Pasada</Text>}
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
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16 },
  infoCard: { gap: 4 },
  servicio:     { fontSize: 18, fontFamily: "Syne_700Bold" },
  peluquero:    { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  sectionLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 1.5 },
  horasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horaBtn: {
    width: "22%", borderWidth: 1, borderRadius: 8,
    padding: 8, alignItems: "center", gap: 2,
  },
  horaText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  ocupadaText: { fontSize: 9, fontFamily: "SpaceGrotesk_400Regular" },
  confirmarBtn: {
    height: 52, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginTop: 8,
  },
  confirmarBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
});
