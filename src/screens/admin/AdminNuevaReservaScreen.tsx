import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Switch, FlatList, Modal,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { collection, addDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import { getServicios, Servicio } from "../../services/serviciosService";
import { notificarCambioEstado } from "../../services/notifications";
import { db } from "../../services/firebase";
import { useThemeColors }   from "../../hooks/useThemeColors";
import { useHorarioConfig } from "../../hooks/useHorarioConfig";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";
import { PressableScale } from "../../components/ui/PressableScale";

const DIAS_SEMANA = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

interface Cliente {
  uid:     string;
  nombre:  string;
  apellido: string;
  email:   string;
}

export function AdminNuevaReservaScreen() {
  const c = useThemeColors();

  const [servicios,       setServicios]       = useState<Servicio[]>([]);
  const [clientes,        setClientes]        = useState<Cliente[]>([]);
  const [clienteSel,      setClienteSel]      = useState<Cliente | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [modalClientes,   setModalClientes]   = useState(false);
  const [noRegistrado,    setNoRegistrado]    = useState(false);
  const [nombreCliente,   setNombreCliente]   = useState("");
  const [servicioSel,   setServicioSel]   = useState(0);
  const [horaSel,       setHoraSel]       = useState("");
  const [guardando,     setGuardando]     = useState(false);
  const [diaOffset,     setDiaOffset]     = useState(0);
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const { horas: HORAS } = useHorarioConfig();

  useEffect(() => {
    getServicios().then(setServicios);
    getDocs(query(collection(db, "users"), where("role", "==", "cliente")))
      .then(snap => setClientes(snap.docs.map(d => ({ uid: d.id, ...d.data() }) as Cliente)))
      .catch(() => {});
  }, []);

  const fechaSel = (() => {
    const d = new Date();
    d.setDate(d.getDate() + diaOffset);
    return d;
  })();
  const fechaStr = fechaSel.toISOString().split("T")[0];

  useEffect(() => {
    getDocs(collection(db, "reservas"))
      .then(snap => {
        const ocupadas = snap.docs
          .map(d => d.data())
          .filter(d => {
            if (!["pendiente","confirmada"].includes(d.estado ?? "")) return false;
            const f: Date | null = d.fecha?.toDate?.() ?? null;
            if (!f) return false;
            const yy = f.getFullYear(), mm = String(f.getMonth()+1).padStart(2,"0"), dd = String(f.getDate()).padStart(2,"0");
            return `${yy}-${mm}-${dd}` === fechaStr;
          })
          .map(d => d.hora as string);
        setHorasOcupadas(ocupadas);
        setHoraSel("");
      })
      .catch(() => {});
  }, [fechaStr]);

  const dias = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const clientesFiltrados = clientes.filter(cl =>
    `${cl.nombre} ${cl.apellido}`.toLowerCase().includes(busquedaCliente.toLowerCase()) ||
    cl.email.toLowerCase().includes(busquedaCliente.toLowerCase())
  );

  const seleccionarCliente = (cli: Cliente) => {
    setClienteSel(cli);
    setNombreCliente(`${cli.nombre} ${cli.apellido}`);
    setNoRegistrado(false);
    setModalClientes(false);
    setBusquedaCliente("");
  };

  const crearReserva = async () => {
    if (!nombreCliente.trim() || !horaSel) {
      Alert.alert("Faltan datos", "Ingresa el nombre del cliente y la hora.");
      return;
    }
    setGuardando(true);
    try {
      if (!servicios.length) return;
      const servicio = servicios[servicioSel];
      const fecha    = new Date(`${fechaStr}T${horaSel}`);
      await addDoc(collection(db, "reservas"), {
        clienteNombre: nombreCliente.trim(),
        clienteUid:    clienteSel?.uid ?? null,
        clienteEmail:  clienteSel?.email ?? null,
        servicio:      servicio.label,
        precio:        servicio.precio,
        fecha:         Timestamp.fromDate(fecha),
        hora:          horaSel,
        estado:        "confirmada",
        noRegistrado,
        creadoPorAdmin: true,
        createdAt:     Timestamp.now(),
      });
      // Avisar al cliente registrado que su cita quedó confirmada
      if (clienteSel?.uid) {
        notificarCambioEstado(
          clienteSel.uid, nombreCliente.trim(), servicio.label, "confirmada", horaSel,
        ).catch(() => {});
      }
      Alert.alert("✅ Reserva creada", `${nombreCliente} — ${horaSel}`);
      setNombreCliente("");
      setHoraSel("");
      setNoRegistrado(false);
      setClienteSel(null);
      setHorasOcupadas(prev => [...prev, horaSel]);
    } catch {
      Alert.alert("Error", "No se pudo crear la reserva.");
    } finally { setGuardando(false); }
  };

  const ahora = new Date();

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
        {noRegistrado ? (
          <TextInput
            style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
            value={nombreCliente}
            onChangeText={setNombreCliente}
            placeholder="Nombre del cliente"
            placeholderTextColor={c.sub}
          />
        ) : (
          <>
            <TouchableOpacity
              onPress={() => setModalClientes(true)}
              style={[styles.input, { justifyContent: "space-between", flexDirection: "row", alignItems: "center", borderColor: clienteSel ? c.amber : c.border, backgroundColor: c.surface }]}
            >
              <Text style={{ color: clienteSel ? c.text : c.sub, fontFamily: "SpaceGrotesk_400Regular", fontSize: 15 }}>
                {clienteSel ? `${clienteSel.nombre} ${clienteSel.apellido}` : "Seleccionar cliente registrado"}
              </Text>
              <MaterialIcons name="expand-more" size={20} color={c.sub} />
            </TouchableOpacity>
            <Modal visible={modalClientes} animationType="slide" transparent>
              <View style={styles.modalOverlay}>
                <View style={[styles.modalBox, { backgroundColor: c.surface }]}>
                  <Text style={[styles.modalTitle, { color: c.text }]}>Seleccionar cliente</Text>
                  <TextInput
                    style={[styles.modalSearch, { color: c.text, backgroundColor: c.bg, borderColor: c.border }]}
                    value={busquedaCliente}
                    onChangeText={setBusquedaCliente}
                    placeholder="Buscar por nombre o email..."
                    placeholderTextColor={c.sub}
                    autoFocus
                  />
                  <FlatList
                    data={clientesFiltrados}
                    keyExtractor={item => item.uid}
                    style={{ maxHeight: 320 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => seleccionarCliente(item)}
                        style={[styles.clienteItem, { borderBottomColor: c.border }]}
                      >
                        <Text style={[styles.clienteItemNombre, { color: c.text }]}>{item.nombre} {item.apellido}</Text>
                        <Text style={[styles.clienteItemEmail, { color: c.sub }]}>{item.email}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={<Text style={[styles.clienteItemEmail, { color: c.sub, padding: 16 }]}>Sin resultados</Text>}
                  />
                  <TouchableOpacity onPress={() => setModalClientes(false)} style={[styles.modalCerrar, { borderColor: c.border }]}>
                    <Text style={{ color: c.sub, fontFamily: "SpaceGrotesk_600SemiBold" }}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </>
        )}

        <Text style={[styles.sectionLabel, { color: c.sub }]}>FECHA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.diasRow}>
          {dias.map((d, i) => {
            const activo = diaOffset === i;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setDiaOffset(i)}
                style={[styles.diaBtn, activo && { backgroundColor: c.amber }]}
              >
                <Text style={[styles.diaNombre, { color: activo ? "#000" : c.sub }]}>
                  {DIAS_SEMANA[d.getDay()]}
                </Text>
                <Text style={[styles.diaNumero, { color: activo ? "#000" : c.text }]}>
                  {d.getDate()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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

        <Text style={[styles.sectionLabel, { color: c.sub }]}>HORA</Text>
        <View style={styles.horasGrid}>
          {HORAS.map((hora, i) => {
            const [hh, mm] = hora.split(":").map(Number);
            const esHoy = diaOffset === 0;
            const pasada = esHoy && (hh * 60 + mm) <= (ahora.getHours() * 60 + ahora.getMinutes());
            const ocupada = horasOcupadas.includes(hora);
            const deshabilitada = pasada || ocupada;
            return (
              <TouchableOpacity
                key={i}
                disabled={deshabilitada}
                onPress={() => setHoraSel(hora)}
                style={[
                  styles.horaBtn,
                  {
                    borderColor:     horaSel === hora ? c.amber : ocupada ? c.negative + "66" : c.border,
                    backgroundColor: horaSel === hora ? c.amber + "18" : ocupada ? c.negative + "11" : c.surface,
                    opacity:         deshabilitada ? 0.35 : 1,
                  },
                ]}
              >
                <Text style={[styles.horaText, { color: horaSel === hora ? c.amber : deshabilitada ? c.sub : c.text }]}>
                  {hora}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <PressableScale
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
        </PressableScale>

      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16 },
  toggleCard:   { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel:  { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  toggleDesc:   { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  sectionLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 1.5 },
  input: {
    height: 50, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15,
    fontFamily: "SpaceGrotesk_400Regular",
  },
  diasRow: { gap: 8, paddingVertical: 4 },
  diaBtn: {
    width: 50, alignItems: "center", paddingVertical: 8, borderRadius: 10,
  },
  diaNombre: { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium" },
  diaNumero: { fontSize: 18, fontFamily: "Inter_700Bold" },
  serviciosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  servicioBtn: {
    width: "47.5%", borderWidth: 1, borderRadius: 12, padding: 12, gap: 4,
  },
  servicioLabel:  { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  servicioPrecio: { fontSize: 11, fontFamily: "Inter_500Medium" },
  horasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horaBtn: {
    width: "22%", borderWidth: 1, borderRadius: 8,
    padding: 8, alignItems: "center",
  },
  horaText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  crearBtn:     { height: 52, borderRadius: 12, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  crearBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  modalOverlay:      { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  modalBox:          { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalTitle:        { fontSize: 17, fontFamily: "Syne_700Bold" },
  modalSearch:       { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  clienteItem:       { paddingVertical: 12, borderBottomWidth: 1, gap: 2 },
  clienteItemNombre: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  clienteItemEmail:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  modalCerrar:       { height: 44, borderRadius: 10, borderWidth: 1, justifyContent: "center", alignItems: "center", marginTop: 8 },
});
