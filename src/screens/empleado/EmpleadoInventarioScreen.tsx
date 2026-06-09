import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { ThemedCard }     from "../../components/ui/ThemedCard";

interface Producto {
  id:        string;
  nombre:    string;
  categoria: string;
  stock:     number;
  stockMin:  number;
  precio:    number;
}

export function EmpleadoInventarioScreen() {
  const c = useThemeColors();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    getDocs(collection(db, "inventario"))
      .then(snap => {
        setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Producto));
      })
      .finally(() => setLoading(false));
  }, []);

  const getStockColor = (stock: number, min: number) => {
    if (stock === 0)  return c.negative;
    if (stock <= min) return c.amber;
    return c.positive;
  };

  const getStockLabel = (stock: number, min: number) => {
    if (stock === 0)  return "Agotado";
    if (stock <= min) return "Stock bajo";
    return "Disponible";
  };

  const getBarWidth = (stock: number, min: number): number => {
    const max = Math.max(stock, min * 3, 10);
    return Math.min((stock / max) * 100, 100);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Inventario</Text>
        <Text style={[styles.subtitle, { color: c.sub }]}>Solo lectura</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {productos.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="inventory-2" size={48} color={c.sub} />
              <Text style={[styles.emptyText, { color: c.sub }]}>
                Sin productos en inventario
              </Text>
            </View>
          ) : (
            productos.map((p, i) => {
              const min   = p.stockMin ?? 3;
              const color = getStockColor(p.stock, min);
              const label = getStockLabel(p.stock, min);
              const barW  = getBarWidth(p.stock, min);
              return (
                <ThemedCard key={i} style={styles.productoCard}>
                  <View style={styles.productoTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.productoNombre, { color: c.text }]}>
                        {p.nombre}
                      </Text>
                      <Text style={[styles.productoCategoria, { color: c.sub }]}>
                        {p.categoria}
                      </Text>
                    </View>
                    <View style={styles.stockBadge}>
                      <Text style={[styles.stockNumero, { color }]}>
                        {p.stock}
                      </Text>
                      <Text style={[styles.stockLabel, { color }]}>
                        {label}
                      </Text>
                    </View>
                  </View>

                  {/* Barra de stock */}
                  <View style={[styles.barTrack, { backgroundColor: c.border }]}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${barW}%` as any, backgroundColor: color },
                      ]}
                    />
                  </View>
                </ThemedCard>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  title:             { fontSize: 22, fontFamily: "Syne_700Bold" },
  subtitle:          { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  scroll:            { padding: 20, gap: 12 },
  empty:             { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText:         { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
  productoCard:      { gap: 10 },
  productoTop:       { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  productoNombre:    { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  productoCategoria: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  stockBadge:        { alignItems: "flex-end", gap: 2 },
  stockNumero:       { fontSize: 22, fontFamily: "Syne_700Bold" },
  stockLabel:        { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold" },
  barTrack: {
    height: 4, borderRadius: 2, overflow: "hidden",
  },
  barFill: {
    height: 4, borderRadius: 2,
  },
});