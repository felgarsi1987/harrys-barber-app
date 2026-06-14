import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Calendar, LocaleConfig } from "react-native-calendars";
import {
  collection, getDocs, addDoc, getDoc, query,
  where, Timestamp, doc,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { programarRecordatorio } from "../../services/notifications";
import { getServicios, Servicio } from "../../services/serviciosService";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useGuestStore }  from "../../store/guestStore";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

LocaleConfig.locales["es"] = {
  monthNames: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  monthNamesShort: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
  dayNames: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
  dayNamesShort: ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],
};
LocaleConfig.defaultLocale = "es";

// Servicios se cargan de Firestore via serviciosService

interface Peluquero {
  uid:              string;
  nombre:           string;
  apellido:         string;
  role:             string;
  disponibleAgenda: boolean;
  horasBloqueadas?: string[];
}

export function ClienteAgendarScreen() {
  const c = useThemeColors();
  const { user } = useAuthStore();
  const guest = useGuestStore(s => s.guest);
  const nombreCliente = user ? `${user.nombre} ${user.apellido}` : guest ? `${guest.nombre} ${guest.apellido}` : "";

  const [servicios,          setServicios]          = useState<Servicio[]>([]);
  const [peluqueros,        setPeluqueros]        = useState<Peluquero[]>([]);
  const [peluqueroSel,      setPeluqueroSel]      = useState<Peluquero | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [horaSeleccionada,  setHoraSeleccionada]  = useState("");
  const [servicioSel,       setServicioSel]        = useState(0);
  const [horasOcupadas,     setHorasOcupadas]      = useState<string[]>([]);
  const [horasConfig,       setHorasConfig]        = useState<string[]>([]);
  const [guardando,         setGuardando]          = useState(false);
  const [loadingPeluqueros, setLoadingPeluqueros]  = useState(true);

  const hoy     = new Date();
  const maxDate = new Date(hoy);
  maxDate.setDate(maxDate.getDate() + 30);
  const minDateStr = hoy.toISOString().split("T")[0];
  const maxDateStr = maxDate.toISOString().split("T")[0];

  // Cargar peluqueros disponibles y config de horario
  useEffect(() => {
    // Small delay to ensure anonymous auth is confirmed before Firestore queries
    const timer = setTimeout(() => {
    Promise.all([
      // Servicios desde Firestore
      getServicios().then(data => setServicios(data)),

      // Cargar todos los empleados y admin, filtrar disponibles en JS
      getDocs(query(
        collection(db, "users"),
        where("role", "in", ["admin", "empleado"]),
      )).then(snap => {
        const data = snap.docs
          .map(d => d.data() as Peluquero)
          .filter(p => p.disponibleAgenda === true || p.disponibleAgenda === undefined);
        setPeluqueros(data);
      }).catch(() => {}),

      // Config de horario para saber rango de horas
      getDocs(query(collection(db, "config"))).then(snap => {
        const horarioDoc = snap.docs.find(d => d.id === "horario");
        if (horarioDoc) {
          const data = horarioDoc.data();
          const horaInicio = data.horaInicio ?? "08:00";
          const horaFin    = data.horaFin    ?? "18:00";
          const duracion   = data.duracionTurno ?? 30;

          // Generar horas según rango y duración
          const horas: string[] = [];
          const [hi, mi] = horaInicio.split(":").map(Number);
          const [hf, mf] = horaFin.split(":").map(Number);
          let mins = hi * 60 + mi;
          const finMins = hf * 60 + mf;
          while (mins < finMins) {
            const h = Math.floor(mins / 60).toString().padStart(2, "0");
            const m = (mins % 60).toString().padStart(2, "0");
            horas.push(`${h}:${m}`);
            mins += duracion;
          }
          setHorasConfig(horas);
        } else {
          // Default si no hay config
          setHorasConfig([
            "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
            "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30",
          ]);
        }
      }),
    ]).catch(() => {})
    .finally(() => setLoadingPeluqueros(false));
    }, 1000); // wait for anonymous auth to fully initialize
    return () => clearTimeout(timer);
  }, []);

  // Cargar horas ocupadas + bloqueadas del peluquero en la fecha
  useEffect(() => {
    if (!fechaSeleccionada || !peluqueroSel) return;
    const fecha    = new Date(fechaSeleccionada + "T00:00:00");
    const fechaFin = new Date(fechaSeleccionada + "T23:59:59");
    getDocs(query(
      collection(db, "reservas"),
      where("peluqueroUid", "==", peluqueroSel.uid),
      where("fecha", ">=", Timestamp.fromDate(fecha)),
      where("fecha", "<=", Timestamp.fromDate(fechaFin)),
    )).then(snap => {
      // Block all active reservations (pending or confirmed), free cancelled ones
      const reservadas = snap.docs
        .filter(d => !["cancelada","fallida","completada"].includes(d.data().estado ?? ""))
        .map(d => d.data().hora);
      const bloqueadas = peluqueroSel.horasBloqueadas ?? [];
      setHorasOcupadas([...reservadas, ...bloqueadas]);
    }).catch(() => {});
  }, [fechaSeleccionada, peluqueroSel]);

  const confirmarReserva = async () => {
    if (!peluqueroSel) {
      Alert.alert("Selecciona un peluquero", "Elige quién te atenderá.");
      return;
    }
    if (!fechaSeleccionada || !horaSeleccionada) {
      Alert.alert("Faltan datos", "Selecciona fecha y hora.");
      return;
    }
    setGuardando(true);
    try {
      if (!servicios.length) return;
      // Validar que la fecha/hora no haya pasado
      const fechaHora = new Date(fechaSeleccionada + "T" + horaSeleccionada);
      if (fechaHora <= new Date()) {
        Alert.alert("Hora no disponible", "No puedes agendar en una hora que ya pasó.");
        return;
      }
      const servicio = servicios[servicioSel];
      const fecha    = new Date(fechaSeleccionada + "T" + horaSeleccionada);
      // Check autoConfirmar setting
      let estadoInicial = "pendiente";
      try {
        const cfg = await getDoc(doc(db, "horario", "config"));
        if (cfg.exists() && cfg.data().autoConfirmar) estadoInicial = "confirmada";
      } catch {}

      const docRef = await addDoc(collection(db, "reservas"), {
        clienteUid:      user?.uid,
        clienteNombre:   `${user?.nombre} ${user?.apellido}`,
        clienteEmail:    user?.email,
        peluqueroUid:    peluqueroSel.uid,
        peluqueroNombre: `${peluqueroSel.nombre} ${peluqueroSel.apellido}`,
        servicio:        servicio.label,
        precio:          servicio.precio,
        fecha:           Timestamp.fromDate(fecha),
        hora:            horaSeleccionada,
        // Check if admin has autoConfirmar enabled
        estado: estadoInicial,
        noRegistrado:    false,
        createdAt:       Timestamp.now(),
      });
      // Programar recordatorio 1h antes
      programarRecordatorio(
        docRef.id,
        servicio.label,
        fecha,
        `${peluqueroSel.nombre} ${peluqueroSel.apellido}`
      );
      Alert.alert(
        "✅ Reserva enviada",
        `Tu cita con ${peluqueroSel.nombre} fue enviada. El admin la confirmará pronto.`
      );
      setFechaSeleccionada("");
      setHoraSeleccionada("");
      setPeluqueroSel(null);
    } catch {
      Alert.alert("Error", "No se pudo crear la reserva.");
    } finally { setGuardando(false); }
  };

  return (
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Agendar cita</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Paso 1 — Peluquero */}
        <View style={styles.pasoHeader}>
          <View style={[styles.pasoBadge, { backgroundColor: c.amber }]}>
            <Text style={styles.pasoNum}>1</Text>
          </View>
          <Text style={[styles.pasoLabel, { color: c.text }]}>Elige tu peluquero</Text>
        </View>

        {loadingPeluqueros ? (
          <ActivityIndicator color={c.amber} />
        ) : peluqueros.length === 0 ? (
          <ThemedCard style={styles.emptyCard}>
            <MaterialIcons name="person-off" size={32} color={c.sub} />
            <Text style={[styles.emptyText, { color: c.sub }]}>
              No hay peluqueros disponibles
            </Text>
          </ThemedCard>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.peluquerosRow}>
              {peluqueros.map((p, i) => {
                const seleccionado = peluqueroSel?.uid === p.uid;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      setPeluqueroSel(p);
                      setFechaSeleccionada("");
                      setHoraSeleccionada("");
                    }}
                    style={[
                      styles.peluqueroCard,
                      {
                        borderColor:     seleccionado ? c.amber : c.border,
                        backgroundColor: seleccionado ? c.amber + "18" : c.surface,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.peluqueroAvatar, {
                      backgroundColor: seleccionado ? c.amber : c.bg,
                      borderColor:     seleccionado ? c.amber : c.border,
                    }]}>
                      <Text style={[styles.peluqueroAvatarText, {
                        color: seleccionado ? "#000" : c.text,
                      }]}>
                        {p.nombre[0]}{p.apellido[0]}
                      </Text>
                    </View>
                    <Text style={[styles.peluqueroNombre, {
                      color: seleccionado ? c.amber : c.text,
                    }]}>
                      {p.nombre}
                    </Text>
                    <Text style={[styles.peluqueroRol, { color: c.sub }]}>
                      {p.role === "admin" ? "Dueño" : "Barbero"}
                    </Text>
                    {seleccionado && (
                      <MaterialIcons name="check-circle" size={16} color={c.amber} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Paso 2 — Servicio */}
        <View style={styles.pasoHeader}>
          <View style={[styles.pasoBadge, {
            backgroundColor: peluqueroSel ? c.amber : c.border,
          }]}>
            <Text style={styles.pasoNum}>2</Text>
          </View>
          <Text style={[styles.pasoLabel, { color: c.text }]}>Elige el servicio</Text>
        </View>

        <View style={styles.serviciosRow}>
          {servicios.map((s, i) => (
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

        {/* Paso 3 — Fecha */}
        <View style={styles.pasoHeader}>
          <View style={[styles.pasoBadge, {
            backgroundColor: peluqueroSel ? c.amber : c.border,
          }]}>
            <Text style={styles.pasoNum}>3</Text>
          </View>
          <Text style={[styles.pasoLabel, { color: c.text }]}>Elige la fecha</Text>
        </View>

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
            backgroundColor:            c.surface,
            calendarBackground:         c.surface,
            textSectionTitleColor:      c.sub,
            selectedDayBackgroundColor: c.amber,
            selectedDayTextColor:       "#000",
            todayTextColor:             c.amber,
            dayTextColor:               c.text,
            textDisabledColor:          c.border,
            arrowColor:                 c.amber,
            monthTextColor:             c.text,
            textDayFontFamily:          "SpaceGrotesk_500Medium",
            textMonthFontFamily:        "Syne_700Bold",
            textDayHeaderFontFamily:    "SpaceGrotesk_600SemiBold",
          }}
          style={[styles.calendar, { backgroundColor: c.surface, borderColor: c.border }]}
        />

        {/* Paso 4 — Hora */}
        {fechaSeleccionada && (
          <>
            <View style={styles.pasoHeader}>
              <View style={[styles.pasoBadge, { backgroundColor: c.amber }]}>
                <Text style={styles.pasoNum}>4</Text>
              </View>
              <Text style={[styles.pasoLabel, { color: c.text }]}>Elige la hora</Text>
            </View>
            <View style={styles.horasGrid}>
              {horasConfig.map((hora, i) => {
                const ocupada     = horasOcupadas.includes(hora);
                const seleccionada = horaSeleccionada === hora;
                // Block past hours when today is selected
                const hoy = new Date();
                const esHoy = fechaSeleccionada === hoy.toISOString().split("T")[0];
                const [hh, mm] = hora.split(":").map(Number);
                const pasada = esHoy && (hh * 60 + mm) <= (hoy.getHours() * 60 + hoy.getMinutes());
                const noDisponible = ocupada || pasada;
                return (
                  <TouchableOpacity
                    key={i}
                    disabled={noDisponible}
                    onPress={() => setHoraSeleccionada(hora)}
                    style={[
                      styles.horaBtn,
                      {
                        borderColor:     seleccionada ? c.amber : noDisponible ? c.border : c.border,
                        backgroundColor: seleccionada ? c.amber + "18" : c.surface,
                        opacity:         noDisponible ? 0.35 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.horaText, {
                      color: seleccionada ? c.amber : noDisponible ? c.sub : c.text,
                    }]}>
                      {hora}
                    </Text>
                    {ocupada && (
                      <Text style={[styles.ocupadaText, { color: c.negative }]}>Ocupada</Text>
                    )}
                    {pasada && !ocupada && (
                      <Text style={[styles.ocupadaText, { color: c.sub }]}>Pasada</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Resumen */}
        {peluqueroSel && fechaSeleccionada && horaSeleccionada && (
          <ThemedCard style={styles.resumen}>
            <Text style={[styles.resumenTitle, { color: c.text }]}>Resumen</Text>
            {[
              { label: "Peluquero", value: `${peluqueroSel.nombre} ${peluqueroSel.apellido}` },
              { label: "Servicio",  value: servicios[servicioSel].label },
              { label: "Fecha",     value: fechaSeleccionada },
              { label: "Hora",      value: horaSeleccionada },
              { label: "Precio",    value: `$${servicios[servicioSel].precio.toLocaleString("es-CO")}`, amber: true },
            ].map((row, i) => (
              <View key={i} style={styles.resumenRow}>
                <Text style={[styles.resumenLabel, { color: c.sub }]}>{row.label}</Text>
                <Text style={[styles.resumenVal, {
                  color: (row as any).amber ? c.amber : c.text,
                }]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </ThemedCard>
        )}

        {/* Botón confirmar */}
        <TouchableOpacity
          style={[
            styles.confirmarBtn,
            {
              backgroundColor: peluqueroSel && fechaSeleccionada && horaSeleccionada
                ? c.amber : c.surface,
              borderColor: c.border,
              opacity: guardando ? 0.7 : 1,
            },
          ]}
          onPress={confirmarReserva}
          disabled={guardando || !peluqueroSel || !fechaSeleccionada || !horaSeleccionada}
        >
          {guardando
            ? <ActivityIndicator color="#000" />
            : <Text style={[styles.confirmarText, {
                color: peluqueroSel && fechaSeleccionada && horaSeleccionada
                  ? "#000" : c.sub,
              }]}>
                Confirmar reserva
              </Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  scroll: { padding: 20, gap: 16 },
  pasoHeader:  { flexDirection: "row", alignItems: "center", gap: 10 },
  pasoBadge: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  pasoNum:   { fontSize: 12, fontFamily: "Syne_700Bold", color: "#000" },
  pasoLabel: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  emptyCard: { alignItems: "center", gap: 10, paddingVertical: 24 },
  emptyText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  peluquerosRow: { flexDirection: "row", gap: 12, paddingVertical: 4 },
  peluqueroCard: {
    alignItems: "center", gap: 6, padding: 14,
    borderRadius: 14, borderWidth: 1, minWidth: 90,
  },
  peluqueroAvatar: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1, justifyContent: "center", alignItems: "center",
  },
  peluqueroAvatarText: { fontSize: 18, fontFamily: "Syne_700Bold" },
  peluqueroNombre:     { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  peluqueroRol:        { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  serviciosRow:   { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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
  resumen: { gap: 10 },
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