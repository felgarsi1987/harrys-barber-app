import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { NumberText }     from "../../components/ui/NumberText";
import { TagChip }        from "../../components/ui/TagChip";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface Cliente {
  uid:       string;
  nombre:    string;
  apellido:  string;
  email:     string;
  telefono?: string;
  saldo?:    number;
  birthdate?: string;
}

export function AdminClientesScreen() {
  const c = useThemeColors();
  const [clientes,  setClientes]  = useState<Cliente[]>([]);
  const [filtered,  setFiltered]  = useState<Cliente[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "users"), where("role", "==", "cliente")))
      .then(snap => {
        const data = snap.docs.map(d => d.data() as Cliente);
        setClientes(data);
        setFiltered(data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      clientes.filter(c =>
        `${c.nombre} ${c.apellido} ${c.email}`.toLowerCase().includes(q)
      )
    );
  }, [search, clientes]);

  const isBirthday = (birthdate?: string) => {
    if (!birthdate) return false;
    const hoy = new Date();
    const bd  = new Date(birthdate);
    return bd.getMonth() === hoy.getMonth() && bd.getDate() === hoy.getDate();
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
            <ThemedCard key={i} style={styles.clienteCard}>
              <View style={[styles.avatar, { backgroundColor: c.amber + "22" }]}>
                <Text style={[styles.avatarText, { color: c.amber }]}>
                  {cli.nombre[0]}{cli.apellido?.[0] ?? ""}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.clienteName, { color: c.text }]}>
                    {cli.nombre} {cli.apellido}
                  </Text>
                  {isBirthday(cli.birthdate) && (
                    <Text style={{ fontSize: 16 }}>🎂</Text>
                  )}
                </View>
                <Text style={[styles.clienteEmail, { color: c.sub }]}>{cli.email}</Text>
                {cli.saldo !== undefined && cli.saldo > 0 && (
                  <View style={styles.saldoRow}>
                    <Text style={[styles.saldoLabel, { color: c.sub }]}>Debe: </Text>
                    <NumberText size={13} negative>${cli.saldo.toLocaleString("es-CO")}</NumberText>
                  </View>
                )}
                {cli.saldo === 0 && (
                  <TagChip label="Al día" variant="success" />
                )}
              </View>
            </ThemedCard>
          ))
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginVertical: 12,
    paddingHorizontal: 14, height: 44,
    borderRadius: 10, borderWidth: 1, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  scroll:      { padding: 20, gap: 10 },
  empty:       { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText:   { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  clienteCard: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
  },
  avatarText:    { fontSize: 16, fontFamily: "Syne_700Bold" },
  nameRow:       { flexDirection: "row", alignItems: "center", gap: 6 },
  clienteName:   { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  clienteEmail:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  saldoRow:      { flexDirection: "row", alignItems: "center" },
  saldoLabel:    { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
});