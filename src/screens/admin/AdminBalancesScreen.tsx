import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BarChart } from "react-native-chart-kit";
import {
  collection, getDocs, query, where, Timestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { NumberText }     from "../../components/ui/NumberText";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - 48;

interface ServicioRealizado {
  precio:          number;
  servicio:        string;
  fecha:           Timestamp;
  peluqueroUid?:   string;
  peluqueroNombre?: string;
}

interface PedidoAprobado {
  total:     number;
  fecha:     Timestamp;
  createdAt: Timestamp;
  items:     { nombre: string; cantidad: number; precio: number }[];
}

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const PERIODO_OPTS = ["7 días","30 días","Este año"] as const;
type Periodo = typeof PERIODO_OPTS[number];

export function AdminBalancesScreen() {
  const c = useThemeColors();
  const [servicios,  setServicios]  = useState<ServicioRealizado[]>([]);
  const [pedidos,    setPedidos]    = useState<PedidoAprobado[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [periodo,    setPeriodo]    = useState<Periodo>("30 días");

  const loadData = async () => {
    try {
      const [serviciosSnap, pedidosSnap] = await Promise.all([
        getDocs(query(
          collection(db, "servicios_realizados"),
          where("estado", "==", "completado"),
        )),
        getDocs(query(
          collection(db, "pedidos"),
          where("estado", "==", "aprobado"),
        )),
      ]);
      const serviciosData = serviciosSnap.docs.map(d => d.data() as ServicioRealizado)
        .sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis());
      const pedidosData = pedidosSnap.docs.map(d => d.data() as PedidoAprobado)
        .sort((a, b) => (a.createdAt ?? a.fecha).toMillis() - (b.createdAt ?? b.fecha).toMillis());
      setServicios(serviciosData);
      setPedidos(pedidosData);
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Filtrar por período ──────────────────────────────────────────────────
  const ahora = new Date();
  const enPeriodo = (ts: Timestamp) => {
    const fecha = ts.toDate();
    if (periodo === "7 días") {
      const hace7 = new Date(ahora); hace7.setDate(ahora.getDate() - 7);
      return fecha >= hace7;
    } else if (periodo === "30 días") {
      const hace30 = new Date(ahora); hace30.setDate(ahora.getDate() - 30);
      return fecha >= hace30;
    }
    return fecha.getFullYear() === ahora.getFullYear();
  };

  const serviciosFilt = servicios.filter(s => enPeriodo(s.fecha));
  const pedidosFilt   = pedidos.filter(p => enPeriodo(p.createdAt ?? p.fecha));

  // ── KPIs globales ────────────────────────────────────────────────────────
  const ingresosServicios = serviciosFilt.reduce((a, s) => a + (s.precio ?? 0), 0);
  const ingresosTienda    = pedidosFilt.reduce((a, p) => a + (p.total ?? 0), 0);
  const totalIngresos     = ingresosServicios + ingresosTienda;
  const totalServicios    = serviciosFilt.length;
  const ticketPromedio    = totalServicios > 0 ? Math.round(ingresosServicios / totalServicios) : 0;

  // ── Gráfica de barras (servicios) ────────────────────────────────────────
  const buildBarData = () => {
    if (periodo === "Este año") {
      const meses = Array(12).fill(0);
      serviciosFilt.forEach(s => { meses[s.fecha.toDate().getMonth()] += s.precio ?? 0; });
      return { labels: MESES, datasets: [{ data: meses }] };
    } else if (periodo === "30 días") {
      const semanas = [0, 0, 0, 0];
      serviciosFilt.forEach(s => {
        const dias = Math.floor((ahora.getTime() - s.fecha.toDate().getTime()) / 86400000);
        const sem  = Math.min(3, Math.floor(dias / 7));
        semanas[3 - sem] += s.precio ?? 0;
      });
      return { labels: ["Sem 1","Sem 2","Sem 3","Sem 4"], datasets: [{ data: semanas }] };
    }
    const dias = Array(7).fill(0);
    const labDias: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(ahora); d.setDate(ahora.getDate() - i);
      labDias.push(["D","L","M","X","J","V","S"][d.getDay()]);
    }
    serviciosFilt.forEach(s => {
      const diasAtras = Math.floor((ahora.getTime() - s.fecha.toDate().getTime()) / 86400000);
      if (diasAtras < 7) dias[6 - diasAtras] += s.precio ?? 0;
    });
    return { labels: labDias, datasets: [{ data: dias }] };
  };

  // ── Top servicios ────────────────────────────────────────────────────────
  const topServicios: Record<string, number> = {};
  serviciosFilt.forEach(s => {
    topServicios[s.servicio] = (topServicios[s.servicio] ?? 0) + (s.precio ?? 0);
  });
  const topServSorted = Object.entries(topServicios).sort(([,a],[,b]) => b - a).slice(0, 4);

  // ── Top productos tienda ─────────────────────────────────────────────────
  const topProductos: Record<string, number> = {};
  pedidosFilt.forEach(p => {
    p.items?.forEach(item => {
      topProductos[item.nombre] = (topProductos[item.nombre] ?? 0) + item.precio * item.cantidad;
    });
  });
  const topProdSorted = Object.entries(topProductos).sort(([,a],[,b]) => b - a).slice(0, 4);

  // ── Ingresos por empleado ────────────────────────────────────────────────
  const porEmpleado: Record<string, { nombre: string; total: number; citas: number }> = {};
  serviciosFilt.forEach(s => {
    const uid    = s.peluqueroUid    ?? "sin_asignar";
    const nombre = s.peluqueroNombre ?? "Sin asignar";
    if (!porEmpleado[uid]) porEmpleado[uid] = { nombre, total: 0, citas: 0 };
    porEmpleado[uid].total += s.precio ?? 0;
    porEmpleado[uid].citas += 1;
  });
  const empleadosSorted = Object.values(porEmpleado).sort((a, b) => b.total - a.total);

  const barData = buildBarData();

  const chartConfig = {
    backgroundGradientFrom: c.surface,
    backgroundGradientTo:   c.surface,
    color: (opacity = 1) => `rgba(242, 185, 12, ${opacity})`,
    labelColor: () => c.sub,
    strokeWidth: 2,
    barPercentage: 0.6,
    decimalPlaces: 0,
    propsForLabels: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 10 },
  };

  return (
    <ScreenWrapper>
      <BackHeader title="Balances" />

      {loading ? (
        <ActivityIndicator color={c.amber} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} />}
        >

          {/* Selector de período */}
          <View style={[styles.periodoRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            {PERIODO_OPTS.map(p => (
              <TouchableOpacity
                key={p}
                onPress={() => setPeriodo(p)}
                style={[styles.periodoBtn, periodo === p && { backgroundColor: c.amber }]}
              >
                <Text style={[styles.periodoBtnText, { color: periodo === p ? "#000" : c.sub }]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── KPIs GLOBALES ── */}
          <Text style={[styles.sectionTitle, { color: c.sub }]}>RESUMEN GENERAL</Text>
          <View style={styles.kpiRow}>
            <ThemedCard style={styles.kpiCard}>
              <MaterialIcons name="trending-up" size={16} color={c.sub} />
              <Text style={[styles.kpiLabel, { color: c.sub }]}>Total</Text>
              <NumberText size={18} positive>${totalIngresos.toLocaleString("es-CO")}</NumberText>
            </ThemedCard>
            <ThemedCard style={styles.kpiCard}>
              <MaterialIcons name="content-cut" size={16} color={c.sub} />
              <Text style={[styles.kpiLabel, { color: c.sub }]}>Servicios</Text>
              <NumberText size={18} positive>${ingresosServicios.toLocaleString("es-CO")}</NumberText>
            </ThemedCard>
            <ThemedCard style={styles.kpiCard}>
              <MaterialIcons name="shopping-cart" size={16} color={c.sub} />
              <Text style={[styles.kpiLabel, { color: c.sub }]}>Tienda</Text>
              <NumberText size={18} positive>${ingresosTienda.toLocaleString("es-CO")}</NumberText>
            </ThemedCard>
          </View>

          <View style={styles.kpiRow}>
            <ThemedCard style={styles.kpiCard}>
              <MaterialIcons name="event" size={16} color={c.sub} />
              <Text style={[styles.kpiLabel, { color: c.sub }]}>Citas</Text>
              <NumberText size={18}>{totalServicios.toString()}</NumberText>
            </ThemedCard>
            <ThemedCard style={styles.kpiCard}>
              <MaterialIcons name="receipt" size={16} color={c.sub} />
              <Text style={[styles.kpiLabel, { color: c.sub }]}>Ticket prom.</Text>
              <NumberText size={18}>${ticketPromedio.toLocaleString("es-CO")}</NumberText>
            </ThemedCard>
            <ThemedCard style={styles.kpiCard}>
              <MaterialIcons name="store" size={16} color={c.sub} />
              <Text style={[styles.kpiLabel, { color: c.sub }]}>Pedidos</Text>
              <NumberText size={18}>{pedidosFilt.length.toString()}</NumberText>
            </ThemedCard>
          </View>

          {totalIngresos === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="bar-chart" size={52} color={c.sub} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>Sin datos aún</Text>
              <Text style={[styles.emptyDesc, { color: c.sub }]}>
                Los ingresos aparecerán cuando se completen servicios o aprueben pedidos
              </Text>
            </View>
          ) : (<>

            {/* ── GRÁFICA SERVICIOS ── */}
            {totalServicios > 0 && (<>
              <Text style={[styles.sectionTitle, { color: c.sub }]}>INGRESOS POR SERVICIOS</Text>
              <ThemedCard style={{ padding: 8 }}>
                <BarChart
                  data={barData}
                  width={CHART_W}
                  height={180}
                  chartConfig={chartConfig}
                  style={{ borderRadius: 12 }}
                  showValuesOnTopOfBars
                  fromZero
                  yAxisLabel="$"
                  yAxisSuffix=""
                />
              </ThemedCard>

              <Text style={[styles.sectionTitle, { color: c.sub }]}>TOP SERVICIOS</Text>
              {topServSorted.map(([nombre, total], i) => {
                const pct = ingresosServicios > 0 ? (total / ingresosServicios) * 100 : 0;
                return (
                  <ThemedCard key={i} style={styles.topCard}>
                    <View style={styles.topRow}>
                      <Text style={[styles.topNombre, { color: c.text }]}>{nombre}</Text>
                      <Text style={[styles.topTotal,  { color: c.amber }]}>${total.toLocaleString("es-CO")}</Text>
                    </View>
                    <View style={[styles.barBg, { backgroundColor: c.border }]}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: c.amber }]} />
                    </View>
                    <Text style={[styles.topPct, { color: c.sub }]}>{pct.toFixed(1)}% de servicios</Text>
                  </ThemedCard>
                );
              })}
            </>)}

            {/* ── VENTAS TIENDA ── */}
            {pedidosFilt.length > 0 && (<>
              <Text style={[styles.sectionTitle, { color: c.sub }]}>VENTAS TIENDA</Text>
              <View style={styles.kpiRow}>
                <ThemedCard style={styles.kpiCard}>
                  <MaterialIcons name="shopping-bag" size={16} color={c.sub} />
                  <Text style={[styles.kpiLabel, { color: c.sub }]}>Ventas</Text>
                  <NumberText size={18} positive>${ingresosTienda.toLocaleString("es-CO")}</NumberText>
                </ThemedCard>
                <ThemedCard style={styles.kpiCard}>
                  <MaterialIcons name="inventory" size={16} color={c.sub} />
                  <Text style={[styles.kpiLabel, { color: c.sub }]}>Pedidos</Text>
                  <NumberText size={18}>{pedidosFilt.length.toString()}</NumberText>
                </ThemedCard>
                <ThemedCard style={styles.kpiCard}>
                  <MaterialIcons name="receipt" size={16} color={c.sub} />
                  <Text style={[styles.kpiLabel, { color: c.sub }]}>Prom. pedido</Text>
                  <NumberText size={18}>
                    ${pedidosFilt.length > 0
                      ? Math.round(ingresosTienda / pedidosFilt.length).toLocaleString("es-CO")
                      : "0"}
                  </NumberText>
                </ThemedCard>
              </View>

              {topProdSorted.length > 0 && (<>
                <Text style={[styles.sectionTitle, { color: c.sub }]}>TOP PRODUCTOS</Text>
                {topProdSorted.map(([nombre, total], i) => {
                  const pct = ingresosTienda > 0 ? (total / ingresosTienda) * 100 : 0;
                  return (
                    <ThemedCard key={i} style={styles.topCard}>
                      <View style={styles.topRow}>
                        <Text style={[styles.topNombre, { color: c.text }]}>{nombre}</Text>
                        <Text style={[styles.topTotal,  { color: c.positive }]}>${total.toLocaleString("es-CO")}</Text>
                      </View>
                      <View style={[styles.barBg, { backgroundColor: c.border }]}>
                        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: c.positive }]} />
                      </View>
                      <Text style={[styles.topPct, { color: c.sub }]}>{pct.toFixed(1)}% de tienda</Text>
                    </ThemedCard>
                  );
                })}
              </>)}
            </>)}

            {/* ── INGRESOS POR EMPLEADO ── */}
            {empleadosSorted.length > 0 && (<>
              <Text style={[styles.sectionTitle, { color: c.sub }]}>INGRESOS POR EMPLEADO</Text>
              {empleadosSorted.map((emp, i) => {
                const pct = ingresosServicios > 0 ? (emp.total / ingresosServicios) * 100 : 0;
                return (
                  <ThemedCard key={i} style={styles.empCard}>
                    <View style={[styles.empAvatar, { backgroundColor: c.blue + "22" }]}>
                      <Text style={[styles.empAvatarText, { color: c.blue }]}>
                        {emp.nombre.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.topRow}>
                        <Text style={[styles.topNombre, { color: c.text }]}>{emp.nombre}</Text>
                        <Text style={[styles.topTotal, { color: c.blue }]}>${emp.total.toLocaleString("es-CO")}</Text>
                      </View>
                      <View style={[styles.barBg, { backgroundColor: c.border }]}>
                        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: c.blue }]} />
                      </View>
                      <View style={styles.empMeta}>
                        <Text style={[styles.topPct, { color: c.sub }]}>{emp.citas} cita{emp.citas !== 1 ? "s" : ""}</Text>
                        <Text style={[styles.topPct, { color: c.sub }]}>{pct.toFixed(1)}% del total</Text>
                      </View>
                    </View>
                  </ThemedCard>
                );
              })}
            </>)}

          </>)}

        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 16 },
  periodoRow: {
    flexDirection: "row", borderRadius: 12,
    borderWidth: 1, overflow: "hidden",
  },
  periodoBtn:     { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  periodoBtnText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  sectionTitle:   { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2, marginTop: 4 },
  kpiRow:  { flexDirection: "row", gap: 10 },
  kpiCard: { flex: 1, gap: 6, alignItems: "center" },
  kpiLabel:{ fontSize: 10, fontFamily: "SpaceGrotesk_400Regular", textAlign: "center" },
  topCard: { gap: 8 },
  topRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topNombre: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold", flex: 1, marginRight: 8 },
  topTotal:  { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  barBg:   { height: 6, borderRadius: 3, width: "100%" },
  barFill: { height: 6, borderRadius: 3 },
  topPct:  { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  empCard: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  empAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center", marginTop: 2,
  },
  empAvatarText: { fontSize: 13, fontFamily: "Syne_700Bold" },
  empMeta: { flexDirection: "row", justifyContent: "space-between" },
  empty:     { alignItems: "center", marginTop: 40, gap: 12, paddingHorizontal: 20 },
  emptyTitle:{ fontSize: 18, fontFamily: "Syne_700Bold" },
  emptyDesc: { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", textAlign: "center" },
});
