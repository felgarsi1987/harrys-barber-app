import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Image,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { programarResumenDiario } from "../../services/notifications";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useAuthStore }   from "../../store/authStore";
import { NumberText }     from "../../components/ui/NumberText";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";

export function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const c = useThemeColors();
  const { user } = useAuthStore();

  const [refreshing,          setRefreshing]          = useState(false);
  const [citasHoy,            setCitasHoy]            = useState(0);
  const [totalClientes,       setTotalClientes]       = useState(0);
  const [ingresosMes,         setIngresosMes]         = useState(0);
  const [creditosPendientes,  setCreditosPendientes]  = useState(0);

  const loadStats = async () => {
    try {
      const clientesSnap = await getDocs(
        query(collection(db, "users"), where("role", "==", "cliente"))
      );
      setTotalClientes(clientesSnap.size);
      // Schedule tomorrow's daily summary
      if (user?.uid) programarResumenDiario(user.uid, citasHoy.length);

      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const manana = new Date(hoy); manana.setDate(manana.getDate()+1);
      const citasSnap = await getDocs(
        query(collection(db,"reservas"),
          where("fecha",">=",Timestamp.fromDate(hoy)),
          where("fecha","<", Timestamp.fromDate(manana)))
      );
      setCitasHoy(citasSnap.size);

      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const serviciosSnap = await getDocs(
        query(collection(db,"servicios_realizados"),
          where("fecha",">=",Timestamp.fromDate(inicioMes)),
          where("estado","==","completado"))
      );
      let total = 0;
      serviciosSnap.forEach(d => { total += d.data().precio ?? 0; });
      // Add tienda sales
      const pedidosSnap = await getDocs(query(
        collection(db,"pedidos"), where("estado","==","aprobado"),
        where("createdAt",">=",Timestamp.fromDate(inicioMes))
      ));
      pedidosSnap.forEach(d => { total += d.data().total ?? 0; });
      setIngresosMes(total);

      const creditosSnap = await getDocs(
        query(collection(db, "users"), where("role", "==", "cliente"), where("saldo", ">", 0))
      );
      let creditos = 0;
      creditosSnap.forEach(d => { creditos += d.data().saldo ?? 0; });
      setCreditosPendientes(creditos);
    } catch(e) { /* silent */ }
  };

  useEffect(() => { loadStats(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  return (
    <ScreenWrapper>

      {/* ── HEADER ── */}
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Image
          source={require("../../assets/images/harrys_logo_clean.png")}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerCenter}>
          <Text style={[styles.headerBrand, { color: c.text }]}>HARRYS</Text>
          <Text style={[styles.headerSub,   { color: c.amber }]}>BARBER SHOP</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.headerGreeting, { color: c.sub }]}>Admin</Text>
          <Text style={[styles.headerName, { color: c.text }]}>{user?.nombre}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.amber} />
        }
      >

        {/* ── FECHA ── */}
        <Text style={[styles.dateLabel, { color: c.sub }]}>
          {new Date().toLocaleDateString("es-CO", { weekday:"long", day:"numeric", month:"long" }).toUpperCase()}
        </Text>

        {/* ── KPIs ── */}
        <View style={styles.kpiGrid}>
          <KPICard
            label="Citas hoy"
            value={citasHoy.toString()}
            icon="event"
            c={c}
          />
          <KPICard
            label="Clientes"
            value={totalClientes.toString()}
            icon="people-outline"
            c={c}
          />
          <KPICard
            label="Ingresos mes"
            value={`$${ingresosMes.toLocaleString("es-CO")}`}
            icon="trending-up"
            c={c}
            positive
          />
          <KPICard
            label="Créditos"
            value={`$${creditosPendientes.toLocaleString("es-CO")}`}
            icon="account-balance-wallet"
            c={c}
            negative={creditosPendientes > 0}
          />
        </View>

        {/* ── DIVISOR ── */}
        <View style={[styles.divider, { backgroundColor: c.border }]} />

        {/* ── ACCESOS RÁPIDOS ── */}
        <Text style={[styles.sectionTitle, { color: c.sub }]}>GESTIÓN</Text>
        <View style={styles.actionGrid}>
          {ACTIONS.map((a, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.actionCard, { borderColor: c.border }]}
              activeOpacity={0.6}
              onPress={() => navigation.navigate(a.route)}
            >
              <MaterialIcons name={a.icon as any} size={20} color={c.text} />
              <Text style={[styles.actionLabel, { color: c.text }]}>{a.label}</Text>
              <Text style={[styles.actionDesc,  { color: c.sub  }]}>{a.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </ScreenWrapper>
  );
}

/* ── KPI Card ── */
function KPICard({ label, value, icon, c, positive = false, negative = false }: any) {
  return (
    <View style={[styles.kpiCard, { borderColor: c.border }]}>
      <View style={styles.kpiTop}>
        <MaterialIcons name={icon} size={16} color={c.sub} />
        <Text style={[styles.kpiLabel, { color: c.sub }]}>{label}</Text>
      </View>
      <NumberText size={24} positive={positive} negative={negative}>
        {value}
      </NumberText>
    </View>
  );
}

const ACTIONS = [
  { icon: "event-available",  label: "Reservas",    desc: "Gestionar citas",      route: "Reservas" },
  { icon: "assignment-ind",   label: "Asignar",     desc: "Reserva a empleado",   route: "AdminAsignarReserva" },
  { icon: "payments",         label: "Pagos",       desc: "Créditos y abonos",    route: "Pagos" },
  { icon: "people",           label: "Empleados",   desc: "Equipo de trabajo",    route: "AdminEmpleados" },
  { icon: "content-cut",      label: "Servicios",   desc: "Precios y catálogo",   route: "AdminServicios" },
  { icon: "inventory-2",      label: "Inventario",  desc: "Stock de productos",   route: "AdminInventario" },
  { icon: "bar-chart",        label: "Balances",    desc: "Peluquería y tienda",  route: "AdminBalances" },
  { icon: "campaign",         label: "Eventos",     desc: "Publicidad activa",    route: "AdminEventos" },
];

const styles = StyleSheet.create({

  header: {
    flexDirection:    "row",
    alignItems:       "center",
    paddingHorizontal: 20,
    paddingVertical:   12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerLogo:     { width: 40, height: 40, borderRadius: 20 },
  headerCenter:   { flex: 1, gap: 1 },
  headerBrand:    { fontSize: 14, fontFamily: "Syne_800ExtraBold", letterSpacing: 3 },
  headerSub:      { fontSize: 8,  fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 2 },
  headerRight:    { alignItems: "flex-end" },
  headerGreeting: { fontSize: 10, fontFamily: "SpaceGrotesk_400Regular" },
  headerName:     { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },

  scroll: { padding: 20, gap: 20 },

  dateLabel: {
    fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2,
  },

  kpiGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  kpiCard: {
    width: "47.5%", borderWidth: 1, borderRadius: 12,
    padding: 14, gap: 10,
  },
  kpiTop: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  kpiLabel: {
    fontSize: 11, fontFamily: "SpaceGrotesk_400Regular",
  },

  divider: { height: 1 },

  sectionTitle: {
    fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 2,
  },

  actionGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  actionCard: {
    width: "47.5%", borderWidth: 1, borderRadius: 12,
    padding: 14, gap: 6,
  },
  actionLabel: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  actionDesc:  { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
});