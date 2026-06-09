import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Calendar, LocaleConfig } from "react-native-calendars";
import {
  collection, addDoc, getDocs, query,
  where, Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors }    from "../../hooks/useThemeColors";
import { BackHeader }         from "../../components/ui/BackHeader";
import { ThemedCard }         from "../../components/ui/ThemedCard";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";
import { getServicios, Servicio } from "../../services/serviciosService";
import { notificarCambioEstado } from "../../services/notifications";
import * as Notifications from "expo-notifications";

LocaleConfig.locales["es"] = {
  monthNames: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  monthNamesShort: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
  dayNames: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
  dayNamesShort: ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],
};
LocaleConfig.defaultLocale = "es";

interface Empleado {
  uid:     string;
  nombre:  string;
  apellido: string;
  email:   string;
  pushToken?: string;
}

interface Cliente {
  uid:     string;
  nombre:  string;
  apellido: string;
  email:   string;
  pushToken?: string;
}

export function AdminAsignarReservaScreen() {
  const c = useThemeColors();

  const [paso,          setPaso]          = useState<1|2|3|4|5>(1);
  const [empleados,     setEmpleados]     = useState<Empleado[]>([]);
  const [clientes,      setClientes]      = useState<Cliente[]>([]);
  const [servicios,     setServicios]     = useState<Servicio[]>([]);
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [guardando,     setGuardando]     = useState(false);

  // Selecciones
  const [empleadoSel,   setEmpleadoSel]   = useState<Empleado | null>(null);
  const [clienteSel,    setClienteSel]    = useState<Cliente | null>(null);
  const [clienteManual, setClienteManual] = useState("");
  const [usarManual,    setUsarManual]    = useState(false);
  const [servicioSel,   setServicioSel]   = useState(0);
  const [fecha,         setFecha]         = useState("");
  const [hora,          setHora]          = useState("");

  const horasConfig = [
    "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
    "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30",
  ];

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, "users"), where("role", "==", "empleado")))
        .then(s => setEmpleados(s.docs.map(d => d.data() as Empleado))),
      getDocs(query(collection(db, "users"), where("role", "==", "cliente")))
        .then(s => setClientes(s.docs.map(d => d.data() as Cliente))),
      getServicios().then(setServicios),
    ]).catch(console.log).finally(() => setLoading(false));
  }, []);

  // Cargar horas ocupadas del empleado en la fecha
  useEffect(() => {
    if (!empleadoSel || !fecha) return;
    const inicio = new Date(fecha + "T00:00:00");
    const fin    = new Date(fecha + "T23:59:59");
    getDocs(query(
      collection(db, "reservas"),
      where("peluqueroUid", "==", empleadoSel.uid),
      where("fecha", ">=", Timestamp.fromDate(inicio)),
      where("fecha", "<=", Timestamp.fromDate(fin)),
      where("estado", "in", ["pendiente","confirmada"])
    )).then(s => setHorasOcupadas(s.docs.map(d => d.data().hora)))
      .catch(console.log);
  }, [empleadoSel, fecha]);

  const hoy     = new Date();
  const minDate = hoy.toISOString().split("T")[0];
  const maxDate = new Date(new Date().setDate(hoy.getDate() + 60)).toISOString().split("T")[0];

  const confirmar = async () => {
    const nombreCliente = usarManual
      ? clienteManual.trim()
      : clienteSel ? `${clienteSel.nombre} ${clienteSel.apellido}` : "";

    if (!empleadoSel || !nombreCliente || !fecha || !hora || !servicios.length) {
      Alert.alert("Faltan datos", "Completa todos los pasos.");
      return;
    }

    setGuardando(true);
    try {
      const servicio   = servicios[servicioSel];
      const fechaDate  = new Date(fecha + "T" + hora);
      const fechaLabel = fechaDate.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

      const docRef = await addDoc(collection(db, "reservas"), {
        clienteUid:      usarManual ? null : (clienteSel?.uid ?? null),
        clienteNombre:   nombreCliente,
        clienteEmail:    usarManual ? null : (clienteSel?.email ?? null),
        peluqueroUid:    empleadoSel.uid,
        peluqueroNombre: `${empleadoSel.nombre} ${empleadoSel.apellido}`,
        servicio:        servicio.label,
        precio:          servicio.precio,
        fecha:           Timestamp.fromDate(fechaDate),
        hora,
        estado:          "confirmada",
        noRegistrado:    usarManual,
        creadoPorAdmin:  true,
        createdAt:       Timestamp.now(),
      });

      // Notificar al empleado
      if (empleadoSel.pushToken) {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to:    empleadoSel.pushToken,
            title: "📋 Nueva cita asignada",
            body:  `${nombreCliente} · ${servicio.label} · ${fechaLabel} a las ${hora}`,
            sound: "default",
          }),
        });
      }

      // Notificar al cliente registrado
      if (!usarManual && clienteSel?.uid) {
        notificarCambioEstado(
          clienteSel.uid, nombreCliente, servicio.label, "confirmada", hora
        );
      }

      Alert.alert(
        "✅ Reserva asignada",
        `${nombreCliente} con ${empleadoSel.nombre}\n${fechaLabel} · ${hora}`,
        [{ text: "OK", onPress: () => {
          // Reset
          setPaso(1); setEmpleadoSel(null); setClienteSel(null);
          setClienteManual(""); setFecha(""); setHora(""); setServicioSel(0);
        }}]
      );
    } catch(e) {
      console.log(e);
      Alert.alert("Error", "No se pudo crear la reserva.");
    } finally { setGuardando(false); }
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <BackHeader title="Asignar reserva" />
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <BackHeader title="Asignar reserva" />

      {/* Stepper */}
      <View style={[styles.stepper, { borderBottomColor: c.border }]}>
        {[1,2,3,4,5].map(p => (
          <View key={p} style={styles.stepItem}>
            <View style={[
              styles.stepCircle,
              { backgroundColor: paso >= p ? c.amber : c.surface, borderColor: paso >= p ? c.amber : c.border }
            ]}>
              <Text style={[styles.stepNum, { color: paso >= p ? "#000" : c.sub }]}>{p}</Text>
            </View>
            {p < 5 && <View style={[styles.stepLine, { backgroundColor: paso > p ? c.amber : c.border }]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* PASO 1 — Empleado */}
        {paso === 1 && (
          <>
            <Text style={[styles.pasoTitle, { color: c.text }]}>Selecciona el empleado</Text>
            {empleados.map((emp, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { setEmpleadoSel(emp); setPaso(2); }}
                style={[styles.opcionCard, { borderColor: c.border, backgroundColor: c.surface }]}
              >
                <View style={[styles.avatar, { backgroundColor: c.blue + "22" }]}>
                  <Text style={[styles.avatarText, { color: c.blue }]}>
                    {emp.nombre[0]}{emp.apellido[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.opcionNombre, { color: c.text }]}>{emp.nombre} {emp.apellido}</Text>
                  <Text style={[styles.opcionSub,    { color: c.sub  }]}>{emp.email}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={c.sub} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* PASO 2 — Cliente */}
        {paso === 2 && (
          <>
            <Text style={[styles.pasoTitle, { color: c.text }]}>Selecciona el cliente</Text>

            {/* Toggle manual */}
            <ThemedCard style={styles.toggleCard}>
              <Text style={[styles.toggleLabel, { color: c.text }]}>Cliente sin registro</Text>
              <TouchableOpacity
                onPress={() => setUsarManual(!usarManual)}
                style={[styles.toggleBtn, { backgroundColor: usarManual ? c.amber : c.surface, borderColor: c.border }]}
              >
                <Text style={[styles.toggleBtnText, { color: usarManual ? "#000" : c.sub }]}>
                  {usarManual ? "Sí" : "No"}
                </Text>
              </TouchableOpacity>
            </ThemedCard>

            {usarManual ? (
              <TextInput
                style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
                value={clienteManual}
                onChangeText={setClienteManual}
                placeholder="Nombre del cliente"
                placeholderTextColor={c.sub}
              />
            ) : (
              clientes.map((cli, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { setClienteSel(cli); setPaso(3); }}
                  style={[styles.opcionCard, { borderColor: c.border, backgroundColor: c.surface }]}
                >
                  <View style={[styles.avatar, { backgroundColor: c.amber + "22" }]}>
                    <Text style={[styles.avatarText, { color: c.amber }]}>
                      {cli.nombre[0]}{cli.apellido[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.opcionNombre, { color: c.text }]}>{cli.nombre} {cli.apellido}</Text>
                    <Text style={[styles.opcionSub,    { color: c.sub  }]}>{cli.email}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={c.sub} />
                </TouchableOpacity>
              ))
            )}

            {usarManual && clienteManual.trim() && (
              <TouchableOpacity
                onPress={() => setPaso(3)}
                style={[styles.siguienteBtn, { backgroundColor: c.amber }]}
              >
                <Text style={styles.siguienteBtnText}>Siguiente →</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* PASO 3 — Servicio */}
        {paso === 3 && (
          <>
            <Text style={[styles.pasoTitle, { color: c.text }]}>Selecciona el servicio</Text>
            {servicios.map((s, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { setServicioSel(i); setPaso(4); }}
                style={[styles.opcionCard, { borderColor: c.border, backgroundColor: c.surface }]}
              >
                <MaterialIcons name="content-cut" size={20} color={c.amber} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.opcionNombre, { color: c.text }]}>{s.label}</Text>
                  <Text style={[styles.opcionSub, { color: c.sub }]}>${s.precio.toLocaleString("es-CO")} · {s.duracion} min</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={c.sub} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* PASO 4 — Fecha */}
        {paso === 4 && (
          <>
            <Text style={[styles.pasoTitle, { color: c.text }]}>Selecciona la fecha</Text>
            <Calendar
              minDate={minDate}
              maxDate={maxDate}
              onDayPress={d => { setFecha(d.dateString); setHora(""); setPaso(5); }}
              markedDates={fecha ? { [fecha]: { selected: true, selectedColor: c.amber } } : {}}
              theme={{
                backgroundColor: c.bg, calendarBackground: c.surface,
                textSectionTitleColor: c.sub,
                selectedDayBackgroundColor: c.amber,
                selectedDayTextColor: "#000",
                todayTextColor: c.amber, dayTextColor: c.text,
                textDisabledColor: c.border, arrowColor: c.amber,
                monthTextColor: c.text,
                textDayFontFamily: "SpaceGrotesk_500Medium",
                textMonthFontFamily: "Syne_700Bold",
                textDayHeaderFontFamily: "SpaceGrotesk_400Regular",
                textDayFontSize: 14, textMonthFontSize: 16,
              }}
              style={{ borderRadius: 12 }}
            />
          </>
        )}

        {/* PASO 5 — Hora + confirmación */}
        {paso === 5 && (
          <>
            <Text style={[styles.pasoTitle, { color: c.text }]}>Selecciona la hora</Text>
            <View style={styles.horasGrid}>
              {horasConfig.map((h, i) => {
                const ocupada = horasOcupadas.includes(h);
                const sel     = hora === h;
                return (
                  <TouchableOpacity
                    key={i}
                    disabled={ocupada}
                    onPress={() => setHora(h)}
                    style={[
                      styles.horaBtn,
                      { borderColor: sel ? c.amber : c.border, backgroundColor: sel ? c.amber + "18" : ocupada ? c.border + "30" : c.surface, opacity: ocupada ? 0.4 : 1 }
                    ]}
                  >
                    <Text style={[styles.horaText, { color: sel ? c.amber : ocupada ? c.sub : c.text }]}>{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Resumen */}
            {hora && (
              <ThemedCard style={styles.resumen}>
                <Text style={[styles.resumenTitle, { color: c.text }]}>Resumen de la cita</Text>
                {[
                  { label: "Empleado",  value: `${empleadoSel?.nombre} ${empleadoSel?.apellido}` },
                  { label: "Cliente",   value: usarManual ? clienteManual : `${clienteSel?.nombre} ${clienteSel?.apellido}` },
                  { label: "Servicio",  value: servicios[servicioSel]?.label },
                  { label: "Fecha",     value: fecha },
                  { label: "Hora",      value: hora },
                  { label: "Precio",    value: `$${servicios[servicioSel]?.precio.toLocaleString("es-CO")}` },
                ].map((row, i) => (
                  <View key={i} style={styles.resumenRow}>
                    <Text style={[styles.resumenLabel, { color: c.sub }]}>{row.label}</Text>
                    <Text style={[styles.resumenValue, { color: c.text }]}>{row.value}</Text>
                  </View>
                ))}

                <TouchableOpacity
                  onPress={confirmar}
                  style={[styles.confirmarBtn, { backgroundColor: c.amber, opacity: guardando ? 0.7 : 1 }]}
                  disabled={guardando}
                >
                  {guardando
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.confirmarBtnText}>Confirmar y notificar</Text>
                  }
                </TouchableOpacity>
              </ThemedCard>
            )}
          </>
        )}

        {/* Botón volver */}
        {paso > 1 && (
          <TouchableOpacity
            onPress={() => setPaso(prev => (prev - 1) as any)}
            style={[styles.volverBtn, { borderColor: c.border }]}
          >
            <MaterialIcons name="arrow-back" size={16} color={c.sub} />
            <Text style={[styles.volverBtnText, { color: c.sub }]}>Volver</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1,
  },
  stepItem:   { flexDirection: "row", alignItems: "center", flex: 1 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5,
    justifyContent: "center", alignItems: "center",
  },
  stepNum:  { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  stepLine: { flex: 1, height: 2, marginHorizontal: 4 },
  scroll:   { padding: 20, gap: 14 },
  pasoTitle: { fontSize: 18, fontFamily: "Syne_700Bold", marginBottom: 4 },
  opcionCard: {
    flexDirection: "row", alignItems: "center",
    padding: 14, borderRadius: 12, borderWidth: 1, gap: 12,
  },
  avatar:      { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  avatarText:  { fontSize: 15, fontFamily: "Syne_700Bold" },
  opcionNombre:{ fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  opcionSub:   { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  toggleCard:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleLabel: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  toggleBtn:   {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
  },
  toggleBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  input: {
    height: 50, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15, fontFamily: "SpaceGrotesk_400Regular",
  },
  siguienteBtn: {
    height: 50, borderRadius: 12, justifyContent: "center", alignItems: "center",
  },
  siguienteBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  horasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horaBtn: {
    width: "22%", borderWidth: 1, borderRadius: 8,
    padding: 10, alignItems: "center",
  },
  horaText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  resumen:      { gap: 10, marginTop: 8 },
  resumenTitle: { fontSize: 16, fontFamily: "Syne_700Bold" },
  resumenRow:   { flexDirection: "row", justifyContent: "space-between" },
  resumenLabel: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  resumenValue: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  confirmarBtn: {
    height: 52, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginTop: 8,
  },
  confirmarBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  volverBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, height: 44, borderRadius: 10, borderWidth: 1,
  },
  volverBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium" },
});
