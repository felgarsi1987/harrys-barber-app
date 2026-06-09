import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, RefreshControl,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BarChart, LineChart } from "react-native-chart-kit";
import {
  collection, getDocs, query, where, Timestamp, orderBy,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { BackHeader }     from "../../components/ui/BackHeader";
import { ThemedCard }     from "../../components/ui/ThemedCard";
import { NumberText }     from "../../components/ui/NumberText";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - 48;

interface Servicio {
  precio:   number;
  servicio: string;
  fecha:    Timestamp;
}

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const PERIODO_OPTS = ["7 días","30 días","Este año"] as const;
type Periodo = typeof PERIODO_OPTS[number];

export function AdminBalancesScreen() {
  const c = useThemeColors();
  const [servicios,   setServicios]   = useState<Servicio[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [periodo,     setPeriodo]     = useState<Periodo>("30 días");

  const loadData = async () => {
    try {
      const snap = await getDocs(query(
        collection(db, "servicios_realizados"),
        where("estado", "==", "completado"),
        orderBy("fecha", "asc"),
      ));
      setServicios(snap.docs.map(d => d.data() as Servicio));
    } catch(e) { console.log(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Filtrar por período ──
  const ahora = new Date();
  const filtrados = servicios.filter(s => {
    const fecha = s.fecha.toDate();
    if (periodo === "7 días") {
      const hace7 = new Date(ahora); hace7.setDate(ahora.getDate() - 7);
      return fecha >= hace7;
    } else if (periodo === "30 días") {
      const hace30 = new Date(ahora); hace30.setDate(ahora.getDate() - 30);
      return fecha >= hace30;
    } else {
      return fecha.getFullYear() === ahora.getFullYear();
    }
  });

  // ── KPIs ──
  const totalIngresos = filtrados.reduce((acc, s) => acc + (s.precio ?? 0), 0);
  const totalServicios = filtrados.length;
  const ticketPromedio = totalServicios > 0 ? Math.round(totalIngresos / totalServicios) : 0;

  // ── Datos para gráfica de barras (por semana o mes) ──
  const buildBarData = () => {
    if (periodo === "Este año") {
      // Agrupar por mes
      const meses = Array(12).fill(0);
      filtrados.forEach(s => {
        meses[s.fecha.toDate().getMonth()] += s.precio ?? 0;
      });
      return {
        labels: MESES,
        datasets: [{ data: meses }],
      };
    } else if (periodo === "30 días") {
      // Agrupar por semana (últimas 4 semanas)
      const semanas = [0, 0, 0, 0];
      filtrados.forEach(s => {
        const diasAtras = Math.floor((ahora.getTime() - s.fecha.toDate().getTime()) / 86400000);
        const semana = Math.min(3, Math.floor(diasAtras / 7));
        semanas[3 - semana] += s.precio ?? 0;
      });
      return {
        labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
        datasets: [{ data: semanas }],
      };
    } else {
      // 7 días: por día
      const dias = Array(7).fill(0);
      const labDias = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(ahora); d.setDate(ahora.getDate() - i);
        labDias.push(["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][d.getDay()]);
      }
      filtrados.forEach(s => {
        const diasAtras = Math.floor((ahora.getTime() - s.fecha.toDate().getTime()) / 86400000);
        if (diasAtras < 7) dias[6 - diasAtras] += s.precio ?? 0;
      });
      return { labels: labDias, datasets: [{ data: dias }] };
    }
  };

  // ── Top servicios ──
  const topServicios: Record<string, number> = {};
  filtrados.forEach(s => {
    topServicios[s.servicio] = (topServicios[s.servicio] ?? 0) + (s.precio ?? 0);
  });
  const topSorted = Object.entries(topServicios)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 4);

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
                style={[
                  styles.periodoBtn,
                  periodo === p && { backgroundColor: c.amber },
                ]}
              >
                <Text style={[styles.periodoBtnText, { color: periodo === p ? "#000" : c.sub }]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* KPIs */}
          <View style={styles.kpiRow}>
            <ThemedCard style={styles.kpiCard}>
              <MaterialIcons name="trending-up" size={16} color={c.sub} />
              <Text style={[styles.kpiLabel, { color: c.sub }]}>Ingresos</Text>
              <NumberText size={20} positive>
                ${totalIngresos.toLocaleString("es-CO")}
              </NumberText>
            </ThemedCard>
            <ThemedCard style={styles.kpiCard}>
              <MaterialIcons name="content-cut" size={16} color={c.sub} />
              <Text style={[styles.kpiLabel, { color: c.sub }]}>Servicios</Text>
              <NumberText size={20}>{totalServicios.toString()}</NumberText>
            </ThemedCard>
            <ThemedCard style={styles.kpiCard}>
              <MaterialIcons name="receipt" size={16} color={c.sub} />
              <Text style={[styles.kpiLabel, { color: c.sub }]}>Ticket prom.</Text>
              <NumberText size={20}>
                ${ticketPromedio.toLocaleString("es-CO")}
              </NumberText>
            </ThemedCard>
          </View>

          {/* Gráfica de barras */}
          {totalServicios > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: c.sub }]}>INGRESOS POR PERÍODO</Text>
              <ThemedCard style={{ padding: 8 }}>
                <BarChart
                  data={barData}
                  width={CHART_W}
                  height={200}
                  chartConfig={chartConfig}
                  style={{ borderRadius: 12 }}
                  showValuesOnTopOfBars
                  fromZero
                  yAxisLabel="$"
                  yAxisSuffix=""
                />
              </ThemedCard>

              {/* Top servicios */}
              <Text style={[styles.sectionTitle, { color: c.sub }]}>TOP SERVICIOS</Text>
              {topSorted.map(([nombre, total], i) => {
                const pct = totalIngresos > 0 ? (total / totalIngresos) * 100 : 0;
                return (
                  <ThemedCard key={i} style={styles.topCard}>
                    <View style={styles.topRow}>
                      <Text style={[styles.topNombre, { color: c.text }]}>{nombre}</Text>
                      <Text style={[styles.topTotal, { color: c.amber }]}>
                        ${total.toLocaleString("es-CO")}
                      </Text>
                    </View>
                    <View style={[styles.barBg, { backgroundColor: c.border }]}>
                      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: c.amber }]} />
                    </View>
                    <Text style={[styles.topPct, { color: c.sub }]}>{pct.toFixed(1)}% del total</Text>
                  </ThemedCard>
                );
              })}
            </>
          ) : (
            <View style={styles.empty}>
              <MaterialIcons name="bar-chart" size={52} color={c.sub} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>Sin datos aún</Text>
              <Text style={[styles.emptyDesc,  { color: c.sub  }]}>
                Los ingresos aparecerán aquí cuando se marquen servicios como completados
              </Text>
            </View>
          )}

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
  periodoBtn: {
    flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10,
  },
  periodoBtnText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  kpiRow:   { flexDirection: "row", gap: 10 },
  kpiCard:  { flex: 1, gap: 6, alignItems: "center" },
  kpiLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_400Regular", textAlign: "center" },
  sectionTitle: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2, marginTop: 4 },
  topCard:  { gap: 8 },
  topRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topNombre:{ fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  topTotal: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  barBg:    { height: 6, borderRadius: 3, width: "100%" },
  barFill:  { height: 6, borderRadius: 3 },
  topPct:   { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  empty:    { alignItems: "center", marginTop: 40, gap: 12, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontFamily: "Syne_700Bold" },
  emptyDesc:  { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", textAlign: "center" },
});
