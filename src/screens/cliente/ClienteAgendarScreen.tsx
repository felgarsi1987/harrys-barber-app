import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Calendar, LocaleConfig } from "react-native-calendars";
import {
  collection, getDocs, addDoc, query,
  where, Timestamp, doc, getDoc,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";

LocaleConfig.locales["es"] = {
  monthNames: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  monthNamesShort: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
  dayNames: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
  dayNamesShort: ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],
};
LocaleConfig.defaultLocale = "es";

const SERVICIOS = [
  { label: "Corte clásico",    precio: 15000, duracion: 30 },
  { label: "Corte + Barba",    precio: 22000, duracion: 45 },
  { label: "Barba",            precio: 10000, duracion: 20 },
  { label: "Tratamiento",      precio: 20000, duracion: 40 },
];

const HORAS = ["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
               "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"];

export function ClienteAgendarScreen() {
  const c = useThemeColors();
  const { user } = useAuthStore();

  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [horaSeleccionada,  setHoraSeleccionada]  = useState("");
  const [servicioSel,       setServicioSel]        = useState(0);
  const [horasOcupadas,     setHorasOcupadas]      = useState<string[]>([]);
  const [guardando,         setGuardando]           = useState(false);

  const hoy     = new Date();
  const maxDate = new Date(hoy);
  maxDate.setDate(maxDate.getDate() + 30);

  const minDateStr = hoy.toISOString().split("T")[0];
  const maxDateStr = maxDate.toISOString().split("T")[0];

  useEffect(() => {
    if (!fechaSeleccionada) return;
    const fecha = new Date(fechaSeleccionada + "T00:00:00");
    const fechaFin = new Date(fechaSeleccionada + "T23:59:59");
    getDocs(query(
      collection(db, "reservas"),
      where("fecha", ">=", Timestamp.fromDate(fecha)),
      where("fecha", "<=", Timestamp.fromDate(fechaFin)),
      where("estado", "in", ["pendiente","confirmada"])
    )).then(snap => {
      setHorasOcupadas(snap.docs.map(d => d.data().hora));
    }).catch(console.log);
  }, [fechaSeleccionada]);

  const confirmarReserva = async () => {
    if (!fechaSeleccionada || !horaSeleccionada) {
      Alert.alert("Faltan datos", "Selecciona fecha y hora.");
      return;
    }
    setGuardando(true);
    try {
      const servicio = SERVICIOS[servicioSel];
      const fecha    = new Date(fechaSeleccionada + "T" + horaSeleccionada);
      await addDoc(collection(db, "reservas"), {
        clienteUid:    user?.uid,
        clienteNombre: `${user?.nombre} ${user?.apellido}`,
        clienteEmail:  user?.email,
        servicio:      servicio.label,
        precio:        servicio.precio,
        fecha:         Timestamp.fromDate(fecha),
        hora:          horaSeleccionada,
        estado:        "pendiente",
        noRegistrado:  false,
        createdAt:     Timestamp.now(),
      });
      Alert.alert("✅ Reserva enviada", "El admin confirmará tu cita pronto.");
      setFechaSeleccionada("");
      setHoraSeleccionada("");
    } catch(e) {
      Alert.alert("Error", "No se pudo crear la reserva.");
    } finally { setGuardando(false); }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Agendar cita</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Servicio */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>SERVICIO</Text>
        <View style={styles.serviciosRow}>
          {SERVICIOS.map((s, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setServicioSel(i)}
              style={[
                styles.servicioBtn,
                {
                  borderColor:     servicioSel === i ? c.amber : c.border,
                  backgroundColor: servicioSel === i ? c.amber + "18" : c.surface,
                },
              ]}
            >
              <Text style={[styles.servicioLabel, {
                color: servicioSel === i ? c.amber : c.text,
              }]}>
                {s.label}
              </Text>
              <Text style={[styles.servicioPrecio, { color: c.sub }]}>
                ${s.precio.toLocaleString("es-CO")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Calendario */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>FECHA</Text>
        <Calendar
          minDate={minDateStr}
          maxDate={maxDateStr}
          onDayPress={(day: any) => {
            setFechaSeleccionada(day.dateString);
            setHoraSeleccionada("");
          }}
          markedDates={{
            [fechaSeleccionada]: { selected: true, selectedColor: c.amber },
          }}
          theme={{
            backgroundColor:         c.surface,
            calendarBackground:      c.surface,
            textSectionTitleColor:   c.sub,
            selectedDayBackgroundColor: c.amber,
            selectedDayTextColor:    "#000",
            todayTextColor:          c.amber,
            dayTextColor:            c.text,
            textDisabledColor:       c.border,
            arrowColor:              c.amber,
            monthTextColor:          c.text,
            textDayFontFamily:       "SpaceGrotesk_500Medium",
            textMonthFontFamily:     "Syne_700Bold",
            textDayHeaderFontFamily: "SpaceGrotesk_600SemiBold",
          }}
          style={[styles.calendar, { backgroundColor: c.surface, borderColor: c.border }]}
        />

        {/* Horas */}
        {fechaSeleccionada && (
          <>
            <Text style={[styles.sectionLabel, { color: c.sub }]}>HORA</Text>
            <View style={styles.horasGrid}>
              {HORAS.map((hora, i) => {
                const ocupada = horasOcupadas.includes(hora);
                const seleccionada = horaSeleccionada === hora;
                return (
                  <TouchableOpacity
                    key={i}
                    disabled={ocupada}
                    onPress={() => setHoraSeleccionada(hora)}
                    style={[
                      styles.horaBtn,
                      {
                        borderColor: seleccionada ? c.amber
                                   : ocupada      ? c.border
                                   : c.border,
                        backgroundColor: seleccionada ? c.amber + "18"
                                       : ocupada      ? c.surface
                                       : c.surface,
                        opacity: ocupada ? 0.4 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.horaText, {
                      color: seleccionada ? c.amber : c.text,
                    }]}>
                      {hora}
                    </Text>
                    {ocupada && (
                      <Text style={[styles.ocupadaText, { color: c.sub }]}>
                        Ocupada
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Resumen */}
        {fechaSeleccionada && horaSeleccionada && (
          <View style={[styles.resumen, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.resumenTitle, { color: c.text }]}>Resumen</Text>
            <View style={styles.resumenRow}>
              <Text style={[styles.resumenLabel, { color: c.sub }]}>Servicio</Text>
              <Text style={[styles.resumenVal,   { color: c.text }]}>
                {SERVICIOS[servicioSel].label}
              </Text>
            </View>
            <View style={styles.resumenRow}>
              <Text style={[styles.resumenLabel, { color: c.sub }]}>Fecha</Text>
              <Text style={[styles.resumenVal,   { color: c.text }]}>{fechaSeleccionada}</Text>
            </View>
            <View style={styles.resumenRow}>
              <Text style={[styles.resumenLabel, { color: c.sub }]}>Hora</Text>
              <Text style={[styles.resumenVal,   { color: c.text }]}>{horaSeleccionada}</Text>
            </View>
            <View style={styles.resumenRow}>
              <Text style={[styles.resumenLabel, { color: c.sub }]}>Precio</Text>
              <Text style={[styles.resumenVal,   { color: c.amber }]}>
                ${SERVICIOS[servicioSel].precio.toLocaleString("es-CO")}
              </Text>
            </View>
          </View>
        )}

        {/* Botón confirmar */}
        <TouchableOpacity
          style={[
            styles.confirmarBtn,
            {
              backgroundColor: fechaSeleccionada && horaSeleccionada ? c.amber : c.surface,
              borderColor: c.border,
              opacity: guardando ? 0.7 : 1,
            },
          ]}
          onPress={confirmarReserva}
          disabled={guardando || !fechaSeleccionada || !horaSeleccionada}
        >
          {guardando
            ? <ActivityIndicator color="#000" />
            : <Text style={[styles.confirmarText, {
                color: fechaSeleccionada && horaSeleccionada ? "#000" : c.sub,
              }]}>
                Confirmar reserva
              </Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  scroll: { padding: 20, gap: 16 },
  sectionLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  serviciosRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  servicioBtn: {
    width: "47.5%", borderWidth: 1, borderRadius: 12, padding: 12, gap: 4,
  },
  servicioLabel:  { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  servicioPrecio: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  calendar:       { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  horasGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horaBtn: {
    width: "22%", borderWidth: 1, borderRadius: 8,
    padding: 8, alignItems: "center", gap: 2,
  },
  horaText:    { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  ocupadaText: { fontSize: 9,  fontFamily: "SpaceGrotesk_400Regular" },
  resumen: {
    borderWidth: 1, borderRadius: 12, padding: 16, gap: 10,
  },
  resumenTitle: { fontSize: 15, fontFamily: "Syne_700Bold", marginBottom: 4 },
  resumenRow:   { flexDirection: "row", justifyContent: "space-between" },
  resumenLabel: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  resumenVal:   { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  confirmarBtn: {
    height: 52, borderRadius: 12, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  confirmarText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});