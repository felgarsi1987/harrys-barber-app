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
import { ThemedCard }     from "../../components/ui/ThemedCard";
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
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Movimiento)
        .sort((a, b) => {
          const ta = a.fecha?.toMillis ? a.fecha.toMillis() : 0;
          const tb = b.fecha?.toMillis ? b.fecha.toMillis() : 0;
          return tb - ta; // más reciente primero
        });
      setMovimientos(data);
      const total = data.reduce((acc, m) =>
        m.tipo === "cargo" ? acc + m.monto : acc - m.monto, 0
      );
      setSaldo(total);
    }).catch(() => {})
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
          <Text style={[styles.saldoMonto, { color: saldo > 0 ? c.negative : c.positive }]}>
            ${Math.abs(saldo).toLocaleString("es-CO")}
          </Text>
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
                <View style={[styles.movIcon, {
                  backgroundColor: m.tipo === "cargo" ? c.negative+"18" : c.positive+"18"
                }]}>
                  <MaterialIcons
                    name={m.tipo === "cargo" ? "shopping-cart" : "payments"}
                    size={16}
                    color={m.tipo === "cargo" ? c.negative : c.positive}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.movDesc, { color: c.text }]}>{m.descripcion}</Text>
                  <Text style={[styles.movFecha, { color: c.sub }]}>{formatFecha(m.fecha)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={[styles.movMonto, { color: m.tipo === "cargo" ? c.negative : c.positive }]}>
                    {m.tipo === "cargo" ? "-" : "+"}${m.monto.toLocaleString("es-CO")}
                  </Text>
                  <Text style={[styles.movTipo, { color: m.tipo === "cargo" ? c.negative : c.positive }]}>
                    {m.tipo === "cargo" ? "Cargo" : "Abono"}
                  </Text>
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
  saldoMonto: { fontSize: 36, fontFamily: "SpaceGrotesk_600SemiBold" },
  saldoLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2 },
  saldoDesc:  { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular" },
  sectionLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 1.5 },
  empty:      { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyText:  { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  historialCard: { gap: 0, padding: 0, overflow: "hidden" },
  movRow: {
    flexDirection: "row", alignItems: "center",
    padding: 14, gap: 12,
  },
  movIcon:  { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  movMonto: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  movDesc:  { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  movTipo:  { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold" },
  movFecha: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
});