import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Switch,
} from "react-native";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { getServicios, Servicio } from "../../services/serviciosService";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

// Servicios cargados desde Firestore

const HORAS = [
  "08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30",
  "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30",
];

export function AdminNuevaReservaScreen() {
  const c = useThemeColors();

  const [servicios,      setServicios]      = useState<Servicio[]>([]);
  const [noRegistrado,  setNoRegistrado]  = useState(false);
  const [nombreCliente, setNombreCliente] = useState("");
  const [servicioSel,   setServicioSel]   = useState(0);
  const [horaSel,       setHoraSel]       = useState("");
  const [guardando,     setGuardando]     = useState(false);

  useEffect(() => { getServicios().then(setServicios); }, []);

  const hoy    = new Date();
  const hoyStr = hoy.toISOString().split("T")[0];

  const crearReserva = async () => {
    if (!nombreCliente.trim() || !horaSel) {
      Alert.alert("Faltan datos", "Ingresa el nombre del cliente y la hora.");
      return;
    }
    setGuardando(true);
    try {
      if (!servicios.length) return;
      const servicio = servicios[servicioSel];
      const fecha    = new Date(`${hoyStr}T${horaSel}`);
      await addDoc(collection(db, "reservas"), {
        clienteNombre: nombreCliente.trim(),
        clienteUid:    null,
        clienteEmail:  null,
        servicio:      servicio.label,
        precio:        servicio.precio,
        fecha:         Timestamp.fromDate(fecha),
        hora:          horaSel,
        estado:        "confirmada",
        noRegistrado,
        creadoPorAdmin: true,
        createdAt:     Timestamp.now(),
      });
      Alert.alert("✅ Reserva creada", `${nombreCliente} — ${horaSel}`);
      setNombreCliente("");
      setHoraSel("");
      setNoRegistrado(false);
    } catch {
      Alert.alert("Error", "No se pudo crear la reserva.");
    } finally { setGuardando(false); }
  };

  return (
    <ScreenWrapper>
      <BackHeader title="Nueva reserva" />

      <ScrollView contentContainerStyle={styles.scroll}>

        <ThemedCard style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, { color: c.text }]}>Cliente sin registro</Text>
            <Text style={[styles.toggleDesc,  { color: c.sub  }]}>No puede tener crédito</Text>
          </View>
          <Switch
            value={noRegistrado}
            onValueChange={setNoRegistrado}
            trackColor={{ false: c.border, true: c.amber + "66" }}
            thumbColor={noRegistrado ? c.amber : c.sub}
          />
        </ThemedCard>

        <Text style={[styles.sectionLabel, { color: c.sub }]}>CLIENTE</Text>
        <TextInput
          style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
          value={nombreCliente}
          onChangeText={setNombreCliente}
          placeholder="Nombre del cliente"
          placeholderTextColor={c.sub}
        />

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
              <Text style={[styles.servicioLabel, { color: servicioSel === i ? c.amber : c.text }]}>
                {s.label}
              </Text>
              <Text style={[styles.servicioPrecio, { color: c.sub }]}>
                ${s.precio.toLocaleString("es-CO")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
              <Text style={[styles.horaText, { color: horaSel === hora ? c.amber : c.text }]}>
                {hora}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
            : <Text style={[styles.crearBtnText, { color: nombreCliente && horaSel ? "#000" : c.sub }]}>
                Crear reserva
              </Text>
          }
        </TouchableOpacity>

      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16 },
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
