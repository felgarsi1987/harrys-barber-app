import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Switch,
} from "react-native";
import { collection, addDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { getServicios, Servicio } from "../../services/serviciosService";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

// Servicios cargados desde Firestore

const HORAS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30",
];


interface Empleado {
  uid:     string;
  nombre:  string;
  apellido: string;
  role:    string;
}

export function EmpleadoReservaScreen() {
  const c = useThemeColors();
  const { user } = useAuthStore();

  const [servicios,     setServicios]     = useState<Servicio[]>([]);
  const [empleados,     setEmpleados]     = useState<Empleado[]>([]);
  const [barberoSel,    setBarberoSel]    = useState<Empleado | null>(null);
  const [paraMiMismo,   setParaMiMismo]   = useState(false);
  const [noRegistrado,  setNoRegistrado]  = useState(false);
  const [nombreCliente, setNombreCliente] = useState("");
  const [servicioSel,   setServicioSel]   = useState(0);
  const [horaSel,       setHoraSel]       = useState("");
  const [guardando,     setGuardando]     = useState(false);

  useEffect(() => {
    getServicios().then(setServicios);
    // Cargar todos los empleados + admin como opciones de barbero
    getDocs(query(collection(db, "users"), where("role", "in", ["empleado", "admin"])))
      .then(snap => {
        const lista = snap.docs.map(d => d.data() as Empleado);
        setEmpleados(lista);
        // Pre-seleccionar al empleado actual
        const yo = lista.find(e => e.uid === user?.uid);
        if (yo) setBarberoSel(yo);
      })
      .catch(console.log);
  }, []);

  const toggleParaMiMismo = (val: boolean) => {
    setParaMiMismo(val);
    if (val) {
      setNombreCliente(`${user?.nombre ?? ""} ${user?.apellido ?? ""}`.trim());
      setNoRegistrado(false);
    } else {
      setNombreCliente("");
    }
  };

  const hoy    = new Date();
  const hoyStr = hoy.toISOString().split("T")[0];

  const crearReserva = async () => {
    if (!nombreCliente.trim() || !horaSel) {
      Alert.alert("Faltan datos", "Ingresa el nombre del cliente y la hora.");
      return;
    }
    if (!barberoSel) {
      Alert.alert("Faltan datos", "Selecciona quién atiende la cita.");
      return;
    }
    setGuardando(true);
    try {
      if (!servicios.length) return;
      const servicio = servicios[servicioSel];
      const fecha    = new Date(`${hoyStr}T${horaSel}`);
      await addDoc(collection(db, "reservas"), {
        clienteNombre:     nombreCliente.trim(),
        clienteUid:        paraMiMismo ? (user?.uid ?? null) : null,
        clienteEmail:      paraMiMismo ? (user?.email ?? null) : null,
        peluqueroUid:      barberoSel?.uid    ?? null,
        peluqueroNombre:   barberoSel
          ? `${barberoSel.nombre} ${barberoSel.apellido}`
          : null,
        servicio:          servicio.label,
        precio:            servicio.precio,
        fecha:             Timestamp.fromDate(fecha),
        hora:              horaSel,
        estado:            "confirmada",
        noRegistrado:      !paraMiMismo && noRegistrado,
        paraMiMismo,
        creadoPorEmpleado: true,
        createdAt:         Timestamp.now(),
      });
      Alert.alert(
        "✅ Reserva creada",
        paraMiMismo
          ? `Tu cita para las ${horaSel} fue registrada.`
          : `${nombreCliente} — ${horaSel}`
      );
      setNombreCliente("");
      setHoraSel("");
      setNoRegistrado(false);
      setParaMiMismo(false);
    } catch {
      Alert.alert("Error", "No se pudo crear la reserva.");
    } finally { setGuardando(false); }
  };

  return (
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Nueva cita</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Para mí mismo */}
        <ThemedCard style={[styles.toggleCard, paraMiMismo && { borderColor: c.amber, borderWidth: 1 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, { color: paraMiMismo ? c.amber : c.text }]}>
              Para mí mismo
            </Text>
            <Text style={[styles.toggleDesc, { color: c.sub }]}>
              La cita queda a tu nombre
            </Text>
          </View>
          <Switch
            value={paraMiMismo}
            onValueChange={toggleParaMiMismo}
            trackColor={{ false: c.border, true: c.amber + "66" }}
            thumbColor={paraMiMismo ? c.amber : c.sub}
          />
        </ThemedCard>

        {/* Cliente sin registro — solo si NO es para mí mismo */}
        {!paraMiMismo && (
          <ThemedCard style={styles.toggleCard}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: c.text }]}>
                Cliente sin registro
              </Text>
              <Text style={[styles.toggleDesc, { color: c.sub }]}>
                No puede tener crédito
              </Text>
            </View>
            <Switch
              value={noRegistrado}
              onValueChange={setNoRegistrado}
              trackColor={{ false: c.border, true: c.amber + "66" }}
              thumbColor={noRegistrado ? c.amber : c.sub}
            />
          </ThemedCard>
        )}

        {/* Nombre cliente */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>
          {paraMiMismo ? "EMPLEADO" : "CLIENTE"}
        </Text>
        <TextInput
          style={[styles.input, {
            color: c.text,
            backgroundColor: c.surface,
            borderColor: paraMiMismo ? c.amber + "66" : c.border,
            opacity: paraMiMismo ? 0.7 : 1,
          }]}
          value={nombreCliente}
          onChangeText={val => !paraMiMismo && setNombreCliente(val)}
          placeholder={paraMiMismo ? "Tu nombre" : "Nombre del cliente"}
          placeholderTextColor={c.sub}
          editable={!paraMiMismo}
        />

        {/* Barbero que atiende */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>BARBERO QUE ATIENDE</Text>
        <View style={styles.barberosRow}>
          {empleados.map((emp, i) => {
            const seleccionado = barberoSel?.uid === emp.uid;
            const esYo        = emp.uid === user?.uid;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setBarberoSel(emp)}
                style={[
                  styles.barberoBtn,
                  {
                    borderColor:     seleccionado ? c.amber : c.border,
                    backgroundColor: seleccionado ? c.amber + "18" : c.surface,
                  },
                ]}
              >
                <View style={[styles.barberoAvatar, {
                  backgroundColor: seleccionado ? c.amber : c.border + "40",
                }]}>
                  <Text style={[styles.barberoAvatarText, {
                    color: seleccionado ? "#000" : c.text,
                  }]}>
                    {emp.nombre[0]}{emp.apellido[0]}
                  </Text>
                </View>
                <Text style={[styles.barberoNombre, {
                  color: seleccionado ? c.amber : c.text,
                }]} numberOfLines={1}>
                  {esYo ? "Yo" : emp.nombre}
                </Text>
                {esYo && (
                  <Text style={[styles.barberoYo, { color: c.sub }]}>tú</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Servicio */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>SERVICIO</Text>
        <View style={styles.serviciosGrid}>
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

        {/* Hora */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>HORA — HOY</Text>
        <View style={styles.horasGrid}>
          {HORAS.map((hora, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setHoraSel(hora)}
              style={[
                styles.horaBtn,
                {
                  borderColor:     horaSel === hora ? c.amber : c.border,
                  backgroundColor: horaSel === hora ? c.amber + "18" : c.surface,
                },
              ]}
            >
              <Text style={[styles.horaText, {
                color: horaSel === hora ? c.amber : c.text,
              }]}>
                {hora}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Botón crear */}
        <TouchableOpacity
          style={[
            styles.crearBtn,
            {
              backgroundColor: nombreCliente && horaSel ? c.amber : c.surface,
              borderColor: c.border,
              opacity: guardando ? 0.7 : 1,
            },
          ]}
          onPress={crearReserva}
          disabled={guardando}
        >
          {guardando
            ? <ActivityIndicator color="#000" />
            : <Text style={[styles.crearBtnText, {
                color: nombreCliente && horaSel ? "#000" : c.sub,
              }]}>
                Crear reserva
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
  barberosRow:     { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  barberoBtn: {
    alignItems: "center", gap: 6, padding: 10,
    borderWidth: 1, borderRadius: 12, minWidth: 72,
  },
  barberoAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
  },
  barberoAvatarText: { fontSize: 14, fontFamily: "Syne_700Bold" },
  barberoNombre:     { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  barberoYo:         { fontSize: 10, fontFamily: "SpaceGrotesk_400Regular" },
  toggleCard:   { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel:  { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  toggleDesc:   { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  sectionLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  input: {
    height: 50, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15,
    fontFamily: "SpaceGrotesk_400Regular",
  },
  serviciosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  servicioBtn: {
    width: "47.5%", borderWidth: 1, borderRadius: 12, padding: 12, gap: 4,
  },
  servicioLabel:  { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  servicioPrecio: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  horasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horaBtn: {
    width: "22%", borderWidth: 1, borderRadius: 8,
    padding: 8, alignItems: "center",
  },
  horaText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  crearBtn: {
    height: 52, borderRadius: 12, borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  crearBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});