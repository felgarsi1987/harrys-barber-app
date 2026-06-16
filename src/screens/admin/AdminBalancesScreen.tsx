import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Dimensions, RefreshControl,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { MaterialIcons } from "@expo/vector-icons";
import { BarChart } from "react-native-chart-kit";
import {
  collection, query, where, Timestamp, orderBy, onSnapshot,
} from "firebase/firestore";
import { db }             from "../../services/firebase";
import { useThemeColors } from "../../hooks/useThemeColors";
import { BackHeader }    from "../../components/ui/BackHeader";
import { ThemedCard }    from "../../components/ui/ThemedCard";
import { ScreenWrapper } from "../../components/ui/ScreenWrapper";
import { SkeletonLoader } from "../../components/ui/SkeletonLoader";
import { ProgressBar }    from "../../components/ui/ProgressBar";
import { PressableScale } from "../../components/ui/PressableScale";
import { AnimatedNumber } from "../../components/ui/AnimatedNumber";

const { width: SCREEN_W } = Dimensions.get("window");
const CHART_W = SCREEN_W - 48;

interface ServicioRealizado {
  precio:           number;
  servicio:         string;
  fecha:            Timestamp;
  estado?:          string;
  modalidadPago?:   string;
  peluqueroUid?:    string;
  peluqueroNombre?: string;
}
interface PedidoAprobado {
  total:     number;
  fecha?:    Timestamp;
  createdAt: Timestamp;
  estado:    string;
  aCredito?: boolean;
  items:     { nombre: string; cantidad: number; precio: number; categoria?: string }[];
}

const PERIODOS = ["Hoy","7 días","30 días","Mes","Este año"] as const;
type Periodo = typeof PERIODOS[number];
type Vista   = "todo" | "peluqueria" | "tienda";

// Estados de servicio que cuentan como ingreso (los servicios se guardan como "aprobado")
const SERV_INGRESO = ["aprobado", "completado"];
// Estados de pedido que cuentan como ingreso (venta concretada)
const PED_INGRESO  = ["aprobado", "entregado"];

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export function AdminBalancesScreen() {
  const c = useThemeColors();
  const [servicios,     setServicios]     = useState<ServicioRealizado[]>([]);
  const [pedidos,       setPedidos]       = useState<PedidoAprobado[]>([]);
  const [abonos,        setAbonos]        = useState<{ monto: number; fecha: Timestamp; tipo: string }[]>([]);
  const [creditoTotal,  setCreditoTotal]  = useState(0);
  const [peluqueros,    setPeluqueros]    = useState<{uid:string;nombre:string}[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [periodo,       setPeriodo]       = useState<Periodo>("Hoy");
  const [mesSelec,      setMesSelec]      = useState<number>(new Date().getMonth());
  const [anioSelec,     setAnioSelec]     = useState<number>(new Date().getFullYear());
  const [vista,         setVista]         = useState<Vista>("todo");
  const [peluqueroFil,  setPeluqueroFil]  = useState<string>("todos");

  // ── Rango de fechas: ÚNICA fuente de verdad para query y filtro JS ──
  const getRange = (): { start: Date; end: Date } => {
    const now        = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endToday   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    if (periodo === "Hoy")     return { start: startToday, end: endToday };
    if (periodo === "7 días")  { const s = new Date(startToday); s.setDate(s.getDate() - 6);  return { start: s, end: endToday }; }
    if (periodo === "30 días") { const s = new Date(startToday); s.setDate(s.getDate() - 29); return { start: s, end: endToday }; }
    if (periodo === "Mes")     return { start: new Date(anioSelec, mesSelec, 1, 0, 0, 0, 0), end: new Date(anioSelec, mesSelec + 1, 0, 23, 59, 59, 999) };
    return { start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) };
  };
  const range = getRange();

  const enRango = (ts: any) => {
    const f = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
    if (!f || isNaN(f.getTime())) return false;
    return f >= range.start && f <= range.end;
  };

  // Listeners en tiempo real — acotados al rango exacto del período seleccionado
  useEffect(() => {
    const { start, end } = getRange();
    const desde = Timestamp.fromDate(start);
    const hasta = Timestamp.fromDate(end);
    setLoading(true);

    const unsubServ = onSnapshot(
      query(
        collection(db, "servicios_realizados"),
        where("fecha", ">=", desde), where("fecha", "<=", hasta),
        orderBy("fecha", "asc"),
      ),
      snap => { setServicios(snap.docs.map(d => d.data() as ServicioRealizado)); setLoading(false); },
      () => setLoading(false)
    );

    const unsubPed = onSnapshot(
      query(
        collection(db, "pedidos"),
        where("createdAt", ">=", desde), where("createdAt", "<=", hasta),
        orderBy("createdAt", "asc"),
      ),
      snap => setPedidos(snap.docs.map(d => d.data() as PedidoAprobado)),
      () => {}
    );

    // Abonos (pagos de crédito) — efectivo que entra cuando el cliente paga su deuda
    const unsubAbonos = onSnapshot(
      query(
        collection(db, "movimientos"),
        where("fecha", ">=", desde), where("fecha", "<=", hasta),
        orderBy("fecha", "asc"),
      ),
      snap => setAbonos(snap.docs.map(d => d.data() as any).filter((m: any) => m.tipo === "abono")),
      () => {}
    );

    const unsubCred = onSnapshot(
      query(collection(db, "users"), where("role", "==", "cliente")),
      snap => setCreditoTotal(snap.docs.reduce((acc, d) => acc + (d.data().saldo ?? 0), 0)),
      () => {}
    );

    const unsubPel = onSnapshot(
      query(collection(db, "users"), where("role", "in", ["empleado", "admin"])),
      snap => setPeluqueros(snap.docs.map(d => ({ uid: d.id, nombre: `${d.data().nombre} ${d.data().apellido}` }))),
      () => {}
    );

    return () => { unsubServ(); unsubPed(); unsubAbonos(); unsubCred(); unsubPel(); };
  }, [periodo, mesSelec, anioSelec]);

  const onRefresh = async () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 500); };

  // ── FILTRADO (todo se ajusta al rango + estado válido) ──
  const servFiltBase = servicios
    .filter(s => enRango(s.fecha))
    .filter(s => !s.estado || SERV_INGRESO.includes(s.estado));
  const servFilt = vista === "peluqueria" && peluqueroFil !== "todos"
    ? servFiltBase.filter(s => s.peluqueroUid === peluqueroFil)
    : servFiltBase;

  const pedFilt = pedidos
    .filter(p => enRango(p.createdAt ?? p.fecha))
    .filter(p => PED_INGRESO.includes(p.estado));

  // ── INGRESOS SERVICIOS ──
  const ingServicios = servFilt.reduce((a, s) => a + (s.precio ?? 0), 0);
  const ingContado   = servFilt.filter(s => s.modalidadPago === "contado").reduce((a, s) => a + (s.precio ?? 0), 0);
  const ingCredito   = servFilt.filter(s => s.modalidadPago === "credito").reduce((a, s) => a + (s.precio ?? 0), 0);
  const ticketProm   = servFilt.length > 0 ? Math.round(ingServicios / servFilt.length) : 0;

  // ── INGRESOS TIENDA (separados contado vs crédito) ──
  const ingTiendaContado = pedFilt.filter(p => !p.aCredito).reduce((a, p) => a + (p.total ?? 0), 0);
  const ingTiendaCredito = pedFilt.filter(p =>  p.aCredito).reduce((a, p) => a + (p.total ?? 0), 0);
  const ingTienda        = ingTiendaContado + ingTiendaCredito;
  const ticketTienda     = pedFilt.length > 0 ? Math.round(ingTienda / pedFilt.length) : 0;

  // ── ABONOS = efectivo que entra al pagar deudas de crédito ──
  const ingAbonos = abonos.filter(m => enRango(m.fecha)).reduce((a, m) => a + (m.monto ?? 0), 0);

  // ── CAJA = efectivo realmente cobrado (contado + abonos, NO el crédito nuevo) ──
  const cajaServicios   = ingContado;
  const cajaTienda      = ingTiendaContado;
  const ingCaja         = cajaServicios + cajaTienda + ingAbonos;
  // Por cobrar generado en el período (crédito nuevo)
  const creditoGenerado = ingCredito + ingTiendaCredito;

  const showPeluqueria = vista === "todo" || vista === "peluqueria";
  const showTienda     = vista === "todo" || vista === "tienda";

  // Hero adaptado a la vista
  const heroNum   = vista === "tienda" ? cajaTienda : vista === "peluqueria" ? cajaServicios : ingCaja;
  const breakItems = vista === "todo"
    ? [
        { label: "Servicios", val: cajaServicios, tint: "text" },
        { label: "Tienda",    val: cajaTienda,    tint: "text" },
        ...(ingAbonos > 0 ? [{ label: "Abonos", val: ingAbonos, tint: "positive" }] : []),
      ]
    : [
        { label: "Contado",    val: vista === "tienda" ? ingTiendaContado : ingContado, tint: "text" },
        { label: "Por cobrar", val: vista === "tienda" ? ingTiendaCredito : ingCredito, tint: "negative" },
      ];

  const periodoLabel = periodo === "Mes" ? `${MESES[mesSelec]} ${anioSelec}` : periodo;
  const sinDatos = servFilt.length === 0 && pedFilt.length === 0 && ingAbonos === 0;

  // ── Gráfica (solo servicios) ──
  const buildBarData = () => {
    const source = servFilt;
    if (periodo === "Hoy") {
      const horas = [0,0,0,0,0,0];
      const labs  = ["8-10","10-12","12-14","14-16","16-18","18+"];
      source.forEach(s => {
        const h = s.fecha.toDate().getHours();
        const idx = h < 10 ? 0 : h < 12 ? 1 : h < 14 ? 2 : h < 16 ? 3 : h < 18 ? 4 : 5;
        horas[idx] += (s.precio ?? 0);
      });
      return { labels: labs, datasets: [{ data: horas }] };
    }
    if (periodo === "Este año") {
      const m = Array(12).fill(0);
      source.forEach(s => { m[s.fecha.toDate().getMonth()] += (s.precio ?? 0); });
      return { labels: MESES, datasets: [{ data: m }] };
    }
    if (periodo === "Mes") {
      const sem = [0,0,0,0];
      source.forEach(s => {
        const f = s.fecha.toDate();
        if (f.getFullYear() === anioSelec && f.getMonth() === mesSelec) {
          sem[Math.min(3, Math.floor((f.getDate() - 1) / 7))] += (s.precio ?? 0);
        }
      });
      return { labels: ["Sem 1","Sem 2","Sem 3","Sem 4"], datasets: [{ data: sem }] };
    }
    const ahora = new Date();
    if (periodo === "30 días") {
      const sem = [0,0,0,0];
      source.forEach(s => {
        const d = Math.floor((ahora.getTime() - s.fecha.toDate().getTime()) / 86400000);
        sem[Math.min(3, Math.floor(d / 7))] += (s.precio ?? 0);
      });
      return { labels: ["Sem 1","Sem 2","Sem 3","Sem 4"], datasets: [{ data: sem }] };
    }
    const dias = Array(7).fill(0);
    const labs: string[] = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(ahora); d.setDate(ahora.getDate() - i); labs.push(["D","L","M","X","J","V","S"][d.getDay()]); }
    source.forEach(s => { const d = Math.floor((ahora.getTime() - s.fecha.toDate().getTime()) / 86400000); if (d < 7) dias[6 - d] += (s.precio ?? 0); });
    return { labels: labs, datasets: [{ data: dias }] };
  };

  // Top servicios
  const topServ: Record<string, number> = {};
  servFilt.forEach(s => { topServ[s.servicio] = (topServ[s.servicio] ?? 0) + (s.precio ?? 0); });
  const topServSorted = Object.entries(topServ).sort(([,a],[,b]) => b - a).slice(0, 4);

  // Top productos
  const topProd: Record<string, number> = {};
  pedFilt.forEach(p => p.items?.forEach(i => { topProd[i.nombre] = (topProd[i.nombre] ?? 0) + i.precio * i.cantidad; }));
  const topProdSorted = Object.entries(topProd).sort(([,a],[,b]) => b - a).slice(0, 4);

  // Por empleado
  const porEmp: Record<string, {uid:string;nombre:string;total:number;citas:number}> = {};
  servFilt.forEach(s => {
    const uid = s.peluqueroUid ?? "sin_asignar";
    if (!porEmp[uid]) porEmp[uid] = { uid, nombre: s.peluqueroNombre ?? "Sin asignar", total: 0, citas: 0 };
    porEmp[uid].total += (s.precio ?? 0);
    porEmp[uid].citas += 1;
  });
  const empSorted = Object.values(porEmp).sort((a, b) => b.total - a.total);

  const barData = buildBarData();
  const chartConfig = {
    backgroundGradientFrom: c.surface, backgroundGradientTo: c.surface,
    color: (o = 1) => `rgba(242,185,12,${o})`, labelColor: () => c.sub,
    strokeWidth: 2, barPercentage: 0.6, decimalPlaces: 0,
    propsForLabels: { fontFamily: "SpaceGrotesk_500Medium", fontSize: 10 },
  };

  return (
    <ScreenWrapper keyboard={false}>
      <BackHeader title="Balances" />
      {loading ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <SkeletonLoader height={44} />
          <SkeletonLoader height={140} />
          <SkeletonLoader count={2} height={70} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} />}
        >
          {/* Periodo */}
          <View style={[styles.segRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            {PERIODOS.map(p => (
              <PressableScale key={p} onPress={() => setPeriodo(p)}
                style={[styles.segBtn, periodo === p && { backgroundColor: c.amber }]}>
                <Text style={[styles.segTxt, { color: periodo === p ? "#000" : c.sub }]}>{p}</Text>
              </PressableScale>
            ))}
          </View>

          {/* Selector mes/año */}
          {periodo === "Mes" && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity onPress={() => setAnioSelec(a => a - 1)} style={[styles.anioBtn, { borderColor: c.border }]}>
                  <MaterialIcons name="chevron-left" size={20} color={c.text} />
                </TouchableOpacity>
                <Text style={[styles.anioTxt, { color: c.text }]}>{anioSelec}</Text>
                <TouchableOpacity onPress={() => setAnioSelec(a => Math.min(a + 1, new Date().getFullYear()))} style={[styles.anioBtn, { borderColor: c.border }]}>
                  <MaterialIcons name="chevron-right" size={20} color={c.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.mesesGrid}>
                {MESES.map((m, i) => (
                  <TouchableOpacity key={i} onPress={() => setMesSelec(i)}
                    style={[styles.mesBtn, {
                      borderColor: mesSelec === i ? c.amber : c.border,
                      backgroundColor: mesSelec === i ? c.amber + "22" : "transparent",
                    }]}>
                    <Text style={[styles.mesBtnTxt, { color: mesSelec === i ? c.amber : c.sub }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Vista */}
          <View style={[styles.segRow, { backgroundColor: c.surface, borderColor: c.border }]}>
            {([["todo","Todo"],["peluqueria","Peluquería"],["tienda","Tienda"]] as const).map(([k, l]) => (
              <PressableScale key={k} onPress={() => setVista(k)}
                style={[styles.segBtn, vista === k && { backgroundColor: c.blue }]}>
                <Text style={[styles.segTxt, { color: vista === k ? "#fff" : c.sub }]}>{l}</Text>
              </PressableScale>
            ))}
          </View>

          {/* Filtro peluquero */}
          {vista === "peluqueria" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity onPress={() => setPeluqueroFil("todos")}
                style={[styles.chip, { borderColor: peluqueroFil === "todos" ? c.blue : c.border, backgroundColor: peluqueroFil === "todos" ? c.blue + "22" : "transparent" }]}>
                <Text style={[styles.chipTxt, { color: peluqueroFil === "todos" ? c.blue : c.sub }]}>Todos</Text>
              </TouchableOpacity>
              {peluqueros.map((e, i) => (
                <TouchableOpacity key={i} onPress={() => setPeluqueroFil(e.uid)}
                  style={[styles.chip, { borderColor: peluqueroFil === e.uid ? c.blue : c.border, backgroundColor: peluqueroFil === e.uid ? c.blue + "22" : "transparent" }]}>
                  <Text style={[styles.chipTxt, { color: peluqueroFil === e.uid ? c.blue : c.sub }]}>{e.nombre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* ── HERO CAJA ── */}
          <Animated.View entering={FadeInDown.duration(380)}>
          <ThemedCard style={[styles.heroCard, { borderColor: c.positive + "33" }]}>
            <View style={styles.heroTop}>
              <MaterialIcons name="account-balance-wallet" size={16} color={c.positive} />
              <Text style={[styles.heroLabel, { color: c.sub }]}>CAJA · {periodoLabel.toUpperCase()}</Text>
            </View>
            <AnimatedNumber value={heroNum} prefix="$" style={[styles.heroNum, { color: c.positive }]} />
            <Text style={[styles.heroSub, { color: c.sub }]}>Efectivo cobrado en el período</Text>
            <View style={[styles.heroBreak, { borderTopColor: c.border }]}>
              {breakItems.map((it, i) => (
                <React.Fragment key={it.label}>
                  {i > 0 && <View style={[styles.heroDivider, { backgroundColor: c.border }]} />}
                  <View style={styles.heroBreakItem}>
                    <Text style={[styles.heroBreakNum, {
                      color: it.tint === "negative" ? c.negative : it.tint === "positive" ? c.positive : c.text,
                    }]}>${it.val.toLocaleString("es-CO")}</Text>
                    <Text style={[styles.heroBreakLbl, { color: c.sub }]}>{it.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </ThemedCard>
          </Animated.View>

          {sinDatos ? (
            <View style={styles.empty}>
              <MaterialIcons name="bar-chart" size={52} color={c.sub} />
              <Text style={[styles.emptyT, { color: c.text }]}>Sin movimientos en {periodoLabel}</Text>
              <Text style={[styles.emptyD, { color: c.sub }]}>Los ingresos aparecen cuando se completen servicios o se aprueben pedidos</Text>
            </View>
          ) : (<>

            {/* ── PELUQUERÍA ── */}
            {showPeluqueria && servFilt.length > 0 && (<>
              <Text style={[styles.sec, { color: c.sub }]}>PELUQUERÍA</Text>
              <View style={styles.kpiRow}>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="content-cut" size={16} color={c.sub} />
                  <Text style={[styles.kpiL, { color: c.sub }]}>Ingresos</Text>
                  <Text style={[styles.numSobrio, { color: c.positive }]}>${ingServicios.toLocaleString("es-CO")}</Text>
                </ThemedCard>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="event" size={16} color={c.sub} />
                  <Text style={[styles.kpiL, { color: c.sub }]}>Citas</Text>
                  <Text style={[styles.numSobrio, { color: c.text }]}>{servFilt.length}</Text>
                </ThemedCard>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="receipt" size={16} color={c.sub} />
                  <Text style={[styles.kpiL, { color: c.sub }]}>Ticket prom.</Text>
                  <Text style={[styles.numSobrio, { color: c.text }]}>${ticketProm.toLocaleString("es-CO")}</Text>
                </ThemedCard>
              </View>

              <ThemedCard style={{ padding: 8 }}>
                <BarChart data={barData} width={CHART_W} height={180} chartConfig={chartConfig}
                  style={{ borderRadius: 12 }} showValuesOnTopOfBars fromZero yAxisLabel="$" yAxisSuffix="" />
              </ThemedCard>

              <Text style={[styles.sec, { color: c.sub }]}>TOP SERVICIOS</Text>
              {topServSorted.map(([n, t], i) => {
                const pct = ingServicios > 0 ? (t / ingServicios) * 100 : 0;
                return (
                  <ThemedCard key={i} style={styles.topCard}>
                    <View style={styles.topRow}>
                      <Text style={[styles.topN, { color: c.text }]}>{n}</Text>
                      <Text style={[styles.topNum, { color: c.amber }]}>${t.toLocaleString("es-CO")}</Text>
                    </View>
                    <ProgressBar pct={pct} color={c.amber} track={c.border} delay={i * 70} />
                    <Text style={[styles.topP, { color: c.sub }]}>{pct.toFixed(1)}%</Text>
                  </ThemedCard>
                );
              })}

              {empSorted.length > 0 && (<>
                <Text style={[styles.sec, { color: c.sub }]}>POR EMPLEADO</Text>
                {empSorted.map((e, i) => {
                  const pct = ingServicios > 0 ? (e.total / ingServicios) * 100 : 0;
                  return (
                    <ThemedCard key={i} style={styles.empCard}>
                      <View style={[styles.empAv, { backgroundColor: c.blue + "22" }]}>
                        <Text style={[styles.empAvT, { color: c.blue }]}>
                          {e.nombre.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={styles.topRow}>
                          <Text style={[styles.topN, { color: c.text }]}>{e.nombre}</Text>
                          <Text style={[styles.topNum, { color: c.blue }]}>${e.total.toLocaleString("es-CO")}</Text>
                        </View>
                        <ProgressBar pct={pct} color={c.blue} track={c.border} delay={i * 70} />
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={[styles.topP, { color: c.sub }]}>{e.citas} cita{e.citas !== 1 ? "s" : ""}</Text>
                          <Text style={[styles.topP, { color: c.sub }]}>{pct.toFixed(1)}%</Text>
                        </View>
                      </View>
                    </ThemedCard>
                  );
                })}
              </>)}
            </>)}

            {/* ── TIENDA ── */}
            {showTienda && pedFilt.length > 0 && (<>
              <Text style={[styles.sec, { color: c.sub }]}>TIENDA</Text>
              <View style={styles.kpiRow}>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="store" size={16} color={c.sub} />
                  <Text style={[styles.kpiL, { color: c.sub }]}>Ventas</Text>
                  <Text style={[styles.numSobrio, { color: c.positive }]}>${ingTienda.toLocaleString("es-CO")}</Text>
                </ThemedCard>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="shopping-bag" size={16} color={c.sub} />
                  <Text style={[styles.kpiL, { color: c.sub }]}>Pedidos</Text>
                  <Text style={[styles.numSobrio, { color: c.text }]}>{pedFilt.length}</Text>
                </ThemedCard>
                <ThemedCard style={styles.kpi}>
                  <MaterialIcons name="receipt" size={16} color={c.sub} />
                  <Text style={[styles.kpiL, { color: c.sub }]}>Prom.</Text>
                  <Text style={[styles.numSobrio, { color: c.text }]}>${ticketTienda.toLocaleString("es-CO")}</Text>
                </ThemedCard>
              </View>

              {topProdSorted.length > 0 && (<>
                <Text style={[styles.sec, { color: c.sub }]}>TOP PRODUCTOS</Text>
                {topProdSorted.map(([n, t], i) => {
                  const pct = ingTienda > 0 ? (t / ingTienda) * 100 : 0;
                  return (
                    <ThemedCard key={i} style={styles.topCard}>
                      <View style={styles.topRow}>
                        <Text style={[styles.topN, { color: c.text }]}>{n}</Text>
                        <Text style={[styles.topNum, { color: c.positive }]}>${t.toLocaleString("es-CO")}</Text>
                      </View>
                      <ProgressBar pct={pct} color={c.positive} track={c.border} delay={i * 70} />
                      <Text style={[styles.topP, { color: c.sub }]}>{pct.toFixed(1)}%</Text>
                    </ThemedCard>
                  );
                })}
              </>)}
            </>)}

            {/* ── CRÉDITO ── */}
            <Text style={[styles.sec, { color: c.sub }]}>CRÉDITO</Text>
            {creditoGenerado > 0 && (
              <ThemedCard style={[styles.creditCard, { borderColor: c.amber + "44", backgroundColor: c.amber + "0A" }]}>
                <MaterialIcons name="schedule" size={18} color={c.amber} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.kpiL, { color: c.sub, textAlign: "left" }]}>GENERADO EN {periodoLabel.toUpperCase()}</Text>
                  <Text style={[styles.numSobrio, { color: c.amber }]}>${creditoGenerado.toLocaleString("es-CO")}</Text>
                </View>
              </ThemedCard>
            )}
            <ThemedCard style={[styles.creditCard, { borderColor: c.negative + "44", backgroundColor: c.negative + "0A" }]}>
              <MaterialIcons name="credit-card" size={18} color={c.negative} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.kpiL, { color: c.sub, textAlign: "left" }]}>SALDO PENDIENTE TOTAL · ACTUAL</Text>
                <Text style={[styles.numSobrio, { color: c.negative }]}>${creditoTotal.toLocaleString("es-CO")}</Text>
                <Text style={[styles.creditNote, { color: c.sub }]}>Deuda viva de clientes — no depende del período</Text>
              </View>
            </ThemedCard>

          </>)}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll:    { padding: 20, gap: 16 },
  anioBtn:   { padding: 6, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  anioTxt:   { fontSize: 16, fontFamily: "Inter_700Bold", minWidth: 60, textAlign: "center" },
  mesesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  mesBtn:    { width: "22%", paddingVertical: 7, alignItems: "center", borderRadius: 8, borderWidth: 1 },
  mesBtnTxt: { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold" },
  segRow:    { flexDirection: "row", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  segBtn:    { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  segTxt:    { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },
  chip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipTxt:   { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold" },
  sec:       { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 1.5, marginTop: 4 },
  // Hero
  heroCard:    { borderWidth: 1, gap: 4, paddingVertical: 18 },
  heroTop:     { flexDirection: "row", alignItems: "center", gap: 6 },
  heroLabel:   { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 1.5 },
  heroNum:     { fontSize: 34, fontFamily: "Inter_700Bold", marginTop: 2 },
  heroSub:     { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
  heroBreak:   { flexDirection: "row", alignItems: "center", marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  heroBreakItem:{ flex: 1, alignItems: "center", gap: 2 },
  heroBreakNum: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  heroBreakLbl: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  heroDivider:  { width: 1, height: 32, marginHorizontal: 8 },
  // KPIs
  kpiRow:    { flexDirection: "row", gap: 10 },
  kpi:       { flex: 1, gap: 6, alignItems: "center" },
  kpiL:      { fontSize: 10, fontFamily: "SpaceGrotesk_400Regular", textAlign: "center" },
  numSobrio: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  // Crédito
  creditCard:{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderWidth: 1, borderRadius: 12 },
  creditNote:{ fontSize: 10, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
  // Top / barras
  topCard:   { gap: 8 },
  topRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topN:      { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold", flex: 1, marginRight: 8 },
  topNum:    { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  barBg:     { height: 6, borderRadius: 3, width: "100%" },
  barFill:   { height: 6, borderRadius: 3 },
  topP:      { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
  empCard:   { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  empAv:     { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginTop: 2 },
  empAvT:    { fontSize: 13, fontFamily: "Syne_700Bold" },
  empty:     { alignItems: "center", marginTop: 40, gap: 12, paddingHorizontal: 20 },
  emptyT:    { fontSize: 18, fontFamily: "Syne_700Bold", textAlign: "center" },
  emptyD:    { fontSize: 13, fontFamily: "SpaceGrotesk_400Regular", textAlign: "center" },
});
