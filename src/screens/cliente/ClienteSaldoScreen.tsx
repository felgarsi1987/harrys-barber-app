import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  collection, getDocs, query, where,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { NumberText }     from "../../components/ui/NumberText";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { TagChip }        from "../../components/ui/TagChip";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

interface Movimiento {
  id:          string;
  tipo:        "cargo" | "abono" | "pago";
  descripcion: string;
  monto:       number;
  fecha:       any;
}

export function ClienteSaldoScreen() {
  const c = useThemeColors();
  const { user } = useAuthStore();
  const [saldo,        setSaldo]       = useState(0);
  const [movimientos,  setMovimientos] = useState<Movimiento[]>([]);
  const [loading,      setLoading]     = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    getDocs(query(
      collection(db, "movimientos"),
      where("clienteUid", "==", user.uid)
    )).then(snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Movimiento);
      setMovimientos(data);
      const total = data.reduce((acc, m) =>
        m.tipo === "cargo" ? acc + m.monto : acc - m.monto, 0
      );
      setSaldo(total);
    }).catch(console.log)
    .finally(() => setLoading(false));
  }, [user?.uid]);

  const formatFecha = (ts: any) => {
    if (!ts?.toDate) return "";
    return ts.toDate().toLocaleDateString("es-CO", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  return (
    <ScreenWrapper>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Mi saldo</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Saldo actual */}
        <ThemedCard style={styles.saldoCard} elevated>
          <Text style={[styles.saldoLabel, { color: c.sub }]}>SALDO PENDIENTE</Text>
          <NumberText size={36} negative={saldo > 0} positive={saldo <= 0}>
            ${Math.abs(saldo).toLocaleString("es-CO")}
          </NumberText>
          <Text style={[styles.saldoDesc, { color: c.sub }]}>
            {saldo > 0 ? "Tienes una deuda pendiente" : "Estás al día ✓"}
          </Text>
        </ThemedCard>

        {/* Historial */}
        <Text style={[styles.sectionLabel, { color: c.sub }]}>HISTORIAL</Text>
        {loading ? (
          <ActivityIndicator color={c.amber} />
        ) : movimientos.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="receipt-long" size={48} color={c.sub} />
            <Text style={[styles.emptyText, { color: c.sub }]}>
              Sin movimientos
            </Text>
          </View>
        ) : (
          <ThemedCard style={styles.historialCard}>
            {movimientos.map((m, i) => (
              <View
                key={i}
                style={[
                  styles.movRow,
                  i < movimientos.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.movDesc, { color: c.text }]}>{m.descripcion}</Text>
                  <Text style={[styles.movFecha, { color: c.sub }]}>{formatFecha(m.fecha)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <NumberText
                    size={15}
                    negative={m.tipo === "cargo"}
                    positive={m.tipo === "abono" || m.tipo === "pago"}
                  >
                    {m.tipo === "cargo" ? "-" : "+"}${m.monto.toLocaleString("es-CO")}
                  </NumberText>
                  <TagChip
                    label={m.tipo}
                    variant={m.tipo === "cargo" ? "danger" : "success"}
                  />
                </View>
              </View>
            ))}
          </ThemedCard>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  title:  { fontSize: 22, fontFamily: "Syne_700Bold" },
  scroll: { padding: 20, gap: 16 },
  saldoCard:  { gap: 8, alignItems: "center", paddingVertical: 28 },
  saldoLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  saldoDesc:  { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  sectionLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  empty:      { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyText:  { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  historialCard: { gap: 0, padding: 0, overflow: "hidden" },
  movRow: {
    flexDirection: "row", alignItems: "center",
    padding: 14, gap: 12,
  },
  movDesc:  { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  movFecha: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
});