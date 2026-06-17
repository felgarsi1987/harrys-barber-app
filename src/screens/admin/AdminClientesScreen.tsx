import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TextInput, TouchableOpacity, Alert, Modal,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { collection, getDocs, deleteDoc, doc, updateDoc, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../services/firebase";
import { notificarSaldoPendiente } from "../../services/notifications";
import { useThemeColors }      from "../../hooks/useThemeColors";
import { ThemedCard }           from "../../components/ui/ThemedCard";
import { NumberText }           from "../../components/ui/NumberText";
import { TagChip }              from "../../components/ui/TagChip";
import { ScreenWrapper }        from "../../components/ui/ScreenWrapper";
import { FidelizacionBadge, Categoria } from "../../components/ui/FidelizacionBadge";

interface Cliente {
  uid:        string;
  nombre:     string;
  apellido:   string;
  email:      string;
  telefono?:  string;
  saldo?:     number;
  birthdate?: string;
  categoria?: Categoria;
  visitas?:   number;
}

const CATEGORIAS: { key: Categoria; label: string; icon: string; color: string }[] = [
  { key: "plata",    label: "Plata",    icon: "stars",   color: "#9E9E9E" },
  { key: "oro",      label: "Oro",      icon: "stars",   color: "#FFC107" },
  { key: "diamante", label: "Diamante", icon: "diamond", color: "#29B6F6" },
];

export function AdminClientesScreen() {
  const c = useThemeColors();
  const [clientes,  setClientes]  = useState<Cliente[]>([]);
  const [filtered,  setFiltered]  = useState<Cliente[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [modalCli,  setModalCli]  = useState<Cliente | null>(null);

  useEffect(() => {
    let unsub = () => {};
    // Visitas se cargan una vez; los usuarios (saldo) van en tiempo real
    getDocs(collection(db, "servicios_realizados")).then(servSnap => {
      const visitasPorCliente: Record<string, number> = {};
      servSnap.docs.forEach(d => {
        const uid = d.data().clienteUid;
        if (uid) visitasPorCliente[uid] = (visitasPorCliente[uid] ?? 0) + 1;
      });
      unsub = onSnapshot(
        query(collection(db, "users"), where("role", "==", "cliente")),
        snap => {
          const data = snap.docs
            .map(d => ({ ...(d.data() as Cliente), visitas: visitasPorCliente[d.data().uid] ?? 0 }))
            .filter(cl => !!cl.email);
          setClientes(data);
          setLoading(false);
        },
        () => setLoading(false),
      );
    }).catch(() => setLoading(false));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      clientes.filter(cl =>
        `${cl.nombre} ${cl.apellido} ${cl.email}`.toLowerCase().includes(q)
      )
    );
  }, [search, clientes]);

  const isBirthday = (birthdate?: string) => {
    if (!birthdate) return false;
    const hoy = new Date(); const bd = new Date(birthdate);
    return bd.getMonth() === hoy.getMonth() && bd.getDate() === hoy.getDate();
  };

  const asignarCategoria = async (cliente: Cliente, cat: Categoria | null) => {
    try {
      await updateDoc(doc(db, "users", cliente.uid), { categoria: cat });
      const updated = { ...cliente, categoria: cat ?? undefined };
      setClientes(prev => prev.map(cl => cl.uid === cliente.uid ? updated : cl));
      setModalCli(updated);
    } catch { Alert.alert("Error", "No se pudo actualizar."); }
  };

  const notificarPago = (cli: Cliente) => {
    Alert.alert(
      "Notificar cobro",
      `¿Enviar recordatorio de pago a ${cli.nombre}?\nSaldo: $${(cli.saldo ?? 0).toLocaleString("es-CO")}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: () => {
            notificarSaldoPendiente(cli.uid, `${cli.nombre} ${cli.apellido}`, cli.saldo ?? 0)
              .then(() => Alert.alert("✅ Enviado", `Recordatorio enviado a ${cli.nombre}.`))
              .catch(() => Alert.alert("Error", "No se pudo enviar la notificación."));
          },
        },
      ]
    );
  };

  const eliminarCliente = (cli: Cliente) => {
    Alert.alert(
      "Eliminar cliente",
      `¿Eliminar a ${cli.nombre} ${cli.apellido}? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: async () => {
          try {
            await deleteDoc(doc(db, "users", cli.uid));
            setClientes(prev => prev.filter(c => c.uid !== cli.uid));
            setFiltered(prev => prev.filter(c => c.uid !== cli.uid));
          } catch { Alert.alert("Error", "No se pudo eliminar el cliente."); }
        }},
      ]
    );
  };

  return (
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Clientes</Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: c.surface, borderColor: c.border }]}>
        <MaterialIcons name="search" size={18} color={c.sub} />
        <TextInput
          style={[styles.searchInput, { color: c.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar cliente..."
          placeholderTextColor={c.sub}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator color={c.blue} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="person-search" size={48} color={c.sub} />
            <Text style={[styles.emptyText, { color: c.sub }]}>Sin resultados</Text>
          </View>
        ) : (
          filtered.map((cli, i) => (
            <Animated.View key={cli.uid} entering={FadeInDown.delay(i * 45).duration(320)}>
            <ThemedCard style={styles.clienteCard}>
              <View style={[styles.avatar, {
                backgroundColor: cli.categoria === "diamante" ? "#29B6F622" :
                                 cli.categoria === "oro"      ? "#FFC10722" :
                                 cli.categoria === "plata"    ? "#9E9E9E22" : c.blue + "22",
              }]}>
                <Text style={[styles.avatarText, { color: c.blue }]}>
                  {cli.nombre[0]}{cli.apellido?.[0] ?? ""}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.nombre, { color: c.text }]}>
                    {cli.nombre} {cli.apellido}
                  </Text>
                  {cli.categoria && <FidelizacionBadge categoria={cli.categoria} />}
                  {isBirthday(cli.birthdate) && (
                    <Text style={{ fontSize: 14 }}>🎂</Text>
                  )}
                </View>
                <Text style={[styles.email, { color: c.sub }]}>{cli.email}</Text>
                <View style={styles.visitasRow}>
                  <MaterialIcons name="content-cut" size={11} color={c.sub} />
                  <Text style={[styles.visitasTxt, { color: c.sub }]}>
                    {cli.visitas ?? 0} visita{(cli.visitas ?? 0) !== 1 ? "s" : ""}
                    {(cli.visitas ?? 0) >= 10 ? " · Cliente frecuente ⭐" :
                     (cli.visitas ?? 0) >= 5  ? " · Cliente regular" : ""}
                  </Text>
                </View>
                {(cli.saldo ?? 0) > 0 && (
                  <NumberText size={13} negative>
                    Deuda: ${(cli.saldo ?? 0).toLocaleString("es-CO")}
                  </NumberText>
                )}
              </View>
              <View style={styles.acciones}>
                <TouchableOpacity
                  onPress={() => setModalCli(cli)}
                  style={[styles.editBtn, { borderColor: c.border }]}
                >
                  <MaterialIcons name="workspace-premium" size={18} color={c.amber} />
                </TouchableOpacity>
                {(cli.saldo ?? 0) > 0 && (
                  <TouchableOpacity
                    onPress={() => notificarPago(cli)}
                    style={[styles.editBtn, { borderColor: c.amber + "66" }]}
                  >
                    <MaterialIcons name="notifications" size={18} color={c.amber} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => eliminarCliente(cli)}
                  style={[styles.editBtn, { borderColor: c.negative + "44" }]}
                >
                  <MaterialIcons name="delete-outline" size={18} color={c.negative} />
                </TouchableOpacity>
              </View>
            </ThemedCard>
            </Animated.View>
          ))
        )}
      </ScrollView>

      {/* Modal categoría */}
      <Modal visible={!!modalCli} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: c.surface }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {modalCli?.nombre} {modalCli?.apellido}
            </Text>
            <Text style={[styles.modalSub, { color: c.sub }]}>
              Asignar categoría de fidelización
            </Text>

            <View style={styles.catGrid}>
              {CATEGORIAS.map(cat => {
                const sel = modalCli?.categoria === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    onPress={() => modalCli && asignarCategoria(modalCli, cat.key)}
                    style={[
                      styles.catBtn,
                      {
                        borderColor:     sel ? cat.color : c.border,
                        backgroundColor: sel ? cat.color + "22" : c.bg,
                      },
                    ]}
                  >
                    <MaterialIcons name={cat.icon as any} size={24} color={cat.color} />
                    <Text style={[styles.catLabel, { color: sel ? cat.color : c.text }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalBtns}>
              {modalCli?.categoria && (
                <TouchableOpacity
                  onPress={() => modalCli && asignarCategoria(modalCli, null)}
                  style={[styles.modalBtn, { borderColor: c.border }]}
                >
                  <Text style={[styles.modalBtnText, { color: c.sub }]}>Quitar categoría</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setModalCli(null)}
                style={[styles.modalBtn, { backgroundColor: c.amber, flex: 1 }]}
              >
                <Text style={[styles.modalBtnText, { color: "#000" }]}>Listo</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                const cli = modalCli;
                setModalCli(null);
                if (cli) setTimeout(() => eliminarCliente(cli), 300);
              }}
              style={[styles.eliminarBtn, { borderColor: c.negative + "44" }]}
            >
              <MaterialIcons name="delete-outline" size={16} color={c.negative} />
              <Text style={[styles.modalBtnText, { color: c.negative }]}>Eliminar cliente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header:      { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:       { fontSize: 22, fontFamily: "Syne_700Bold" },
  searchBox:   {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 16, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, height: 42,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  scroll:      { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  empty:       { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText:   { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  clienteCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:      { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  avatarText:  { fontSize: 16, fontFamily: "Syne_700Bold" },
  nameRow:     { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  nombre:      { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  email:       { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  visitasRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  visitasTxt:  { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  acciones:    { gap: 6 },
  editBtn:     { width: 34, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  eliminarBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 10, borderWidth: 1 },
  overlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard:   { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 16 },
  modalTitle:  { fontSize: 20, fontFamily: "Syne_700Bold" },
  modalSub:    { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  catGrid:     { flexDirection: "row", gap: 10 },
  catBtn:      { flex: 1, alignItems: "center", gap: 8, padding: 14, borderRadius: 12, borderWidth: 1 },
  catLabel:    { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  modalBtns:   { flexDirection: "row", gap: 10 },
  modalBtn:    { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  modalBtnText:{ fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
});
