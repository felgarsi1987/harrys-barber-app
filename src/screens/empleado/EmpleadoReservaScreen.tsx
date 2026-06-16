import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Switch, FlatList, Modal,
} from "react-native";
import { collection, addDoc, getDocs, query, where, Timestamp, orderBy } from "firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { db } from "../../services/firebase";
import { notificarEmpleadoAsignado } from "../../services/notifications";
import { getServicios, Servicio } from "../../services/serviciosService";
import { useThemeColors }   from "../../hooks/useThemeColors";
import { useHorarioConfig } from "../../hooks/useHorarioConfig";
import { useAuthStore }     from "../../store/authStore";
import { ThemedCard }       from "../../components/ui/ThemedCard";
import { TagChip }          from "../../components/ui/TagChip";
import { ScreenWrapper }    from "../../components/ui/ScreenWrapper";
import { PressableScale }   from "../../components/ui/PressableScale";

const DIAS_SEMANA = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const ESTADO_CHIP: Record<string, any> = {
  pendiente:  "warning",
  confirmada: "success",
  completada: "default",
  fallida:    "danger",
  cancelada:  "danger",
};

interface HistorialData {
  total:            number;
  ultimaVisita:     string | null;
  servicioFavorito: string | null;
  ultimas:          { servicio: string; fechaStr: string; estado: string }[];
}

interface Empleado {
  uid:     string;
  nombre:  string;
  apellido: string;
  role:    string;
}

interface Cliente {
  uid:     string;
  nombre:  string;
  apellido: string;
  email:   string;
}

export function EmpleadoReservaScreen() {
  const c = useThemeColors();
  const { user } = useAuthStore();

  const [servicios,       setServicios]       = useState<Servicio[]>([]);
  const [empleados,       setEmpleados]       = useState<Empleado[]>([]);
  const [clientes,        setClientes]        = useState<Cliente[]>([]);
  const [clienteSel,      setClienteSel]      = useState<Cliente | null>(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [modalClientes,   setModalClientes]   = useState(false);
  const [modalHistorial,  setModalHistorial]  = useState(false);
  const [historialData,   setHistorialData]   = useState<HistorialData>({ total: 0, ultimaVisita: null, servicioFavorito: null, ultimas: [] });
  const [loadingHistorial,setLoadingHistorial]= useState(false);
  const [barberoSel,      setBarberoSel]      = useState<Empleado | null>(null);
  const [paraMiMismo,     setParaMiMismo]     = useState(false);
  const [noRegistrado,    setNoRegistrado]    = useState(false);
  const [nombreCliente,   setNombreCliente]   = useState("");
  const [servicioSel,   setServicioSel]   = useState(0);
  const [horaSel,       setHoraSel]       = useState("");
  const [guardando,     setGuardando]     = useState(false);
  const [diaOffset,     setDiaOffset]     = useState(0);
  const [horasOcupadas, setHorasOcupadas] = useState<string[]>([]);
  const { horas: HORAS } = useHorarioConfig();

  const fechaSel = (() => {
    const d = new Date();
    d.setDate(d.getDate() + diaOffset);
    return d;
  })();
  const fechaStr = fechaSel.toISOString().split("T")[0];
  const esHoy    = diaOffset === 0;
  const ahora    = new Date();

  const dias = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    getServicios().then(setServicios);
    getDocs(query(collection(db, "users"), where("role", "in", ["empleado", "admin"])))
      .then(snap => {
        const lista = snap.docs.map(d => d.data() as Empleado);
        setEmpleados(lista);
        const yo = lista.find(e => e.uid === user?.uid);
        if (yo) setBarberoSel(yo);
      })
      .catch(() => {});
    getDocs(query(collection(db, "users"), where("role", "==", "cliente")))
      .then(snap => setClientes(snap.docs.map(d => ({ uid: d.id, ...d.data() }) as Cliente)))
      .catch(() => {});
  }, []);

  // Cargar horas ocupadas cuando cambia la fecha o el barbero (query simple para evitar índice compuesto)
  useEffect(() => {
    if (!barberoSel) { setHorasOcupadas([]); return; }
    getDocs(query(
      collection(db, "reservas"),
      where("peluqueroUid", "==", barberoSel.uid),
    )).then(snap => {
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
    }).catch(() => {});
  }, [fechaStr, barberoSel?.uid]);

  const toggleParaMiMismo = (val: boolean) => {
    setParaMiMismo(val);
    if (val) {
      setNombreCliente(`${user?.nombre ?? ""} ${user?.apellido ?? ""}`.trim());
      setNoRegistrado(false);
      setClienteSel(null);
    } else {
      setNombreCliente("");
      setClienteSel(null);
    }
  };

  const abrirHistorial = async (uid: string) => {
    setLoadingHistorial(true);
    setModalHistorial(true);
    try {
      const snap = await getDocs(query(collection(db, "reservas"), where("clienteUid", "==", uid)));
      const todas = snap.docs
        .map(d => d.data())
        .sort((a: any, b: any) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0));
      const cnt: Record<string, number> = {};
      todas.forEach((r: any) => { if (r.servicio) cnt[r.servicio] = (cnt[r.servicio] ?? 0) + 1; });
      const favorito = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const ultima   = todas.find((r: any) => r.estado === "completada");
      const ultimaStr = ultima?.fecha?.toDate?.().toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) ?? null;
      const ultimas  = todas.slice(0, 5).map((r: any) => ({
        servicio: r.servicio ?? "—",
        fechaStr: r.fecha?.toDate?.().toLocaleDateString("es-CO", { day: "numeric", month: "short" }) ?? "—",
        estado:   r.estado ?? "—",
      }));
      setHistorialData({ total: todas.length, ultimaVisita: ultimaStr, servicioFavorito: favorito, ultimas });
    } catch {
      setHistorialData({ total: 0, ultimaVisita: null, servicioFavorito: null, ultimas: [] });
    } finally { setLoadingHistorial(false); }
  };

  const clientesFiltrados = clientes.filter(c =>
    `${c.nombre} ${c.apellido}`.toLowerCase().includes(busquedaCliente.toLowerCase()) ||
    c.email.toLowerCase().includes(busquedaCliente.toLowerCase())
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
    if (!barberoSel) {
      Alert.alert("Faltan datos", "Selecciona quién atiende la cita.");
      return;
    }
    setGuardando(true);
    try {
      if (!servicios.length) return;
      const servicio = servicios[servicioSel];
      const fecha    = new Date(`${fechaStr}T${horaSel}`);
      await addDoc(collection(db, "reservas"), {
        clienteNombre:     nombreCliente.trim(),
        clienteUid:        paraMiMismo ? (user?.uid ?? null) : (clienteSel?.uid ?? null),
        clienteEmail:      paraMiMismo ? (user?.email ?? null) : (clienteSel?.email ?? null),
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
      setHorasOcupadas(prev => [...prev, horaSel]);
      // Avisar al peluquero asignado si no es uno mismo
      if (barberoSel && barberoSel.uid !== user?.uid) {
        notificarEmpleadoAsignado(
          barberoSel.uid, nombreCliente.trim(), servicio.label, fechaStr, horaSel,
        ).catch(() => {});
      }
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
      setClienteSel(null);
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
            <Text style={[styles.toggleLabel, { color: paraMiMismo ? c.amber : c.text }]}>Para mí mismo</Text>
            <Text style={[styles.toggleDesc, { color: c.sub }]}>La cita queda a tu nombre</Text>
          </View>
          <Switch value={paraMiMismo} onValueChange={toggleParaMiMismo}
            trackColor={{ false: c.border, true: c.amber + "66" }}
            thumbColor={paraMiMismo ? c.amber : c.sub}
          />
        </ThemedCard>

        {!paraMiMismo && (
          <ThemedCard style={styles.toggleCard}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: c.text }]}>Cliente sin registro</Text>
              <Text style={[styles.toggleDesc, { color: c.sub }]}>No puede tener crédito</Text>
            </View>
            <Switch value={noRegistrado} onValueChange={setNoRegistrado}
              trackColor={{ false: c.border, true: c.amber + "66" }}
              thumbColor={noRegistrado ? c.amber : c.sub}
            />
          </ThemedCard>
        )}

        {/* Cliente */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>
          {paraMiMismo ? "EMPLEADO" : "CLIENTE"}
        </Text>
        {paraMiMismo ? (
          <TextInput
            style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.amber + "66", opacity: 0.7 }]}
            value={nombreCliente}
            editable={false}
            placeholderTextColor={c.sub}
          />
        ) : noRegistrado ? (
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
            {clienteSel && (
              <TouchableOpacity
                onPress={() => abrirHistorial(clienteSel.uid)}
                style={[styles.historialBtn, { borderColor: c.amber + "44", backgroundColor: c.amber + "11" }]}
              >
                <MaterialIcons name="history" size={15} color={c.amber} />
                <Text style={[styles.historialBtnText, { color: c.amber }]}>
                  Ver historial de {clienteSel.nombre}
                </Text>
              </TouchableOpacity>
            )}

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

        {/* Barbero */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>BARBERO QUE ATIENDE</Text>
        <View style={styles.barberosRow}>
          {empleados.map((emp, i) => {
            const seleccionado = barberoSel?.uid === emp.uid;
            const esYo        = emp.uid === user?.uid;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setBarberoSel(emp)}
                style={[styles.barberoBtn, {
                  borderColor:     seleccionado ? c.amber : c.border,
                  backgroundColor: seleccionado ? c.amber + "18" : c.surface,
                }]}
              >
                <View style={[styles.barberoAvatar, { backgroundColor: seleccionado ? c.amber : c.border + "40" }]}>
                  <Text style={[styles.barberoAvatarText, { color: seleccionado ? "#000" : c.text }]}>
                    {emp.nombre[0]}{emp.apellido[0]}
                  </Text>
                </View>
                <Text style={[styles.barberoNombre, { color: seleccionado ? c.amber : c.text }]} numberOfLines={1}>
                  {esYo ? "Yo" : emp.nombre}
                </Text>
                {esYo && <Text style={[styles.barberoYo, { color: c.sub }]}>tú</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Fecha */}
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

        {/* Servicio */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>SERVICIO</Text>
        <View style={styles.serviciosGrid}>
          {servicios.map((s, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setServicioSel(i)}
              style={[styles.servicioBtn, {
                borderColor:     servicioSel === i ? c.amber : c.border,
                backgroundColor: servicioSel === i ? c.amber + "18" : c.surface,
              }]}
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

        {/* Horas */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>HORA</Text>
        <View style={styles.horasGrid}>
          {HORAS.map((hora, i) => {
            const [hh, mm] = hora.split(":").map(Number);
            const pasada   = esHoy && (hh * 60 + mm) <= (ahora.getHours() * 60 + ahora.getMinutes());
            const ocupada  = horasOcupadas.includes(hora);
            const disabled = pasada || ocupada;
            return (
              <TouchableOpacity
                key={i}
                disabled={disabled}
                onPress={() => setHoraSel(hora)}
                style={[styles.horaBtn, {
                  borderColor:     horaSel === hora ? c.amber : ocupada ? c.negative + "66" : c.border,
                  backgroundColor: horaSel === hora ? c.amber + "18" : ocupada ? c.negative + "11" : c.surface,
                  opacity:         disabled ? 0.35 : 1,
                }]}
              >
                <Text style={[styles.horaText, {
                  color: horaSel === hora ? c.amber : disabled ? c.sub : c.text,
                }]}>
                  {hora}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <PressableScale
          style={[styles.crearBtn, {
            backgroundColor: nombreCliente && horaSel ? c.amber : c.surface,
            borderColor: c.border,
            opacity: guardando ? 0.7 : 1,
          }]}
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

      {/* Modal historial del cliente */}
      <Modal visible={modalHistorial} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {clienteSel?.nombre} {clienteSel?.apellido}
            </Text>
            {loadingHistorial ? (
              <ActivityIndicator color={c.amber} style={{ marginVertical: 24 }} />
            ) : (
              <>
                <View style={styles.historialStats}>
                  <View style={styles.historialStatItem}>
                    <Text style={[styles.historialStatNum, { color: c.amber }]}>{historialData.total}</Text>
                    <Text style={[styles.historialStatLabel, { color: c.sub }]}>Visitas totales</Text>
                  </View>
                  <View style={[styles.historialDivider, { backgroundColor: c.border }]} />
                  <View style={styles.historialStatItem}>
                    <Text style={[styles.historialStatNum, { color: c.text, fontSize: 14 }]}>
                      {historialData.ultimaVisita ?? "Sin visitas"}
                    </Text>
                    <Text style={[styles.historialStatLabel, { color: c.sub }]}>Última visita</Text>
                  </View>
                </View>
                {historialData.servicioFavorito && (
                  <View style={[styles.favServicio, { backgroundColor: c.amber + "11", borderColor: c.amber + "33" }]}>
                    <MaterialIcons name="favorite" size={13} color={c.amber} />
                    <Text style={[styles.favServicioText, { color: c.amber }]}>
                      Favorito: {historialData.servicioFavorito}
                    </Text>
                  </View>
                )}
                {historialData.ultimas.length > 0 && (
                  <>
                    <Text style={[styles.historialSubtitle, { color: c.sub }]}>ÚLTIMAS CITAS</Text>
                    {historialData.ultimas.map((r, i) => (
                      <View key={i} style={[styles.historialItem, { borderBottomColor: c.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.historialItemServicio, { color: c.text }]}>{r.servicio}</Text>
                          <Text style={[styles.historialItemFecha, { color: c.sub }]}>{r.fechaStr}</Text>
                        </View>
                        <TagChip label={r.estado} variant={ESTADO_CHIP[r.estado] ?? "default"} />
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
            <TouchableOpacity
              onPress={() => setModalHistorial(false)}
              style={[styles.modalCerrar, { borderColor: c.border }]}
            >
              <Text style={{ color: c.sub, fontFamily: "SpaceGrotesk_600SemiBold" }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  scroll: { padding: 20, gap: 16 },
  barberosRow:  { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  barberoBtn:   { alignItems: "center", gap: 6, padding: 10, borderWidth: 1, borderRadius: 12, minWidth: 72 },
  barberoAvatar:{ width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  barberoAvatarText: { fontSize: 14, fontFamily: "Syne_700Bold" },
  barberoNombre:     { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  barberoYo:         { fontSize: 10, fontFamily: "SpaceGrotesk_400Regular" },
  toggleCard:   { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel:  { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  toggleDesc:   { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  sectionLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 1.5 },
  input: {
    height: 50, borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, fontSize: 15, fontFamily: "SpaceGrotesk_400Regular",
  },
  diasRow:  { gap: 8, paddingVertical: 4 },
  diaBtn:   { width: 50, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  diaNombre:{ fontSize: 10, fontFamily: "SpaceGrotesk_500Medium" },
  diaNumero:{ fontSize: 18, fontFamily: "Inter_700Bold" },
  serviciosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  servicioBtn:   { width: "47.5%", borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  servicioLabel: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  servicioPrecio:{ fontSize: 11, fontFamily: "Inter_500Medium" },
  horasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horaBtn:   { width: "22%", borderWidth: 1, borderRadius: 8, padding: 8, alignItems: "center" },
  horaText:  { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  crearBtn:  { height: 52, borderRadius: 12, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  crearBtnText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  modalOverlay: { flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" },
  modalBox:     { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  modalTitle:   { fontSize: 17, fontFamily: "Syne_700Bold" },
  modalSearch:  { height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  clienteItem:  { paddingVertical: 12, borderBottomWidth: 1, gap: 2 },
  clienteItemNombre: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  clienteItemEmail:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  modalCerrar:  { height: 44, borderRadius: 10, borderWidth: 1, justifyContent: "center", alignItems: "center", marginTop: 8 },
  historialBtn:     { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  historialBtnText: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  historialStats:   { flexDirection: "row", alignItems: "center", marginVertical: 12 },
  historialStatItem:{ flex: 1, alignItems: "center", gap: 4 },
  historialStatNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  historialStatLabel:{ fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  historialDivider: { width: 1, height: 40, marginHorizontal: 12 },
  favServicio:      { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  favServicioText:  { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  historialSubtitle:{ fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 1.2, marginBottom: 4 },
  historialItem:    { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, gap: 8 },
  historialItemServicio: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  historialItemFecha:    { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
});
