import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, Image,
} from "react-native";
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle, withSpring,
} from "react-native-reanimated";
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
  const [pedidosHoy,          setPedidosHoy]          = useState(0);
  const [serviciosHoy,        setServiciosHoy]        = useState(0);

  const loadStats = async () => {
    try {
      const clientesSnap = await getDocs(
        query(collection(db, "users"), where("role", "==", "cliente"))
      );
      setTotalClientes(clientesSnap.size);

      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const manana = new Date(hoy); manana.setDate(manana.getDate()+1);
      const pedSnap = await getDocs(query(collection(db,"pedidos"),where("createdAt",">=",Timestamp.fromDate(hoy))));
      setPedidosHoy(pedSnap.size);
      const citasSnap = await getDocs(
        query(collection(db,"reservas"),
          where("fecha",">=",Timestamp.fromDate(hoy)),
          where("fecha","<", Timestamp.fromDate(manana)))
      );
      setCitasHoy(citasSnap.size);
      if (user?.uid) programarResumenDiario(user.uid, citasSnap.size);

      const serviciosSnap = await getDocs(
        query(collection(db,"servicios_realizados"),
          where("fecha",">=",Timestamp.fromDate(hoy)),
          where("fecha","<", Timestamp.fromDate(manana)),
          where("estado","==","completado"))
      );
      setServiciosHoy(serviciosSnap.size);
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
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.amber + "08" }]}>
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
        <View style={[styles.datePill, { backgroundColor: c.amber + "12", borderColor: c.amber + "30" }]}>
          <View style={[styles.dateDot, { backgroundColor: c.amber }]} />
          <Text style={[styles.dateLabel, { color: c.amber }]}>
            {new Date().toLocaleDateString("es-CO", { weekday:"long", day:"numeric", month:"long" }).toUpperCase()}
          </Text>
        </View>

        {/* ── KPIs ── */}
        <View style={styles.kpiGrid}>
          {[
            { label: "Citas hoy",     value: citasHoy,       icon: "event",          color: c.amber },
            { label: "Clientes",      value: totalClientes,  icon: "people-outline", color: c.blue  },
            { label: "Servicios hoy", value: serviciosHoy,   icon: "content-cut",    color: c.positive },
            { label: "Pedidos hoy",   value: pedidosHoy,     icon: "receipt-long",   color: "#A78BFA" },
          ].map((kpi, i) => (
            <Animated.View key={kpi.label} entering={FadeInDown.delay(i * 70).springify().damping(18).stiffness(200)} style={styles.kpiCardWrap}>
              <KPICard label={kpi.label} value={kpi.value.toString()} icon={kpi.icon} c={c} iconColor={kpi.color} />
            </Animated.View>
          ))}
        </View>

        {/* ── DIVISOR ── */}
        <View style={[styles.divider, { backgroundColor: c.border }]} />

        {/* ── ACCESOS RÁPIDOS ── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: c.sub }]}>GESTIÓN</Text>
          <View style={[styles.sectionLine, { backgroundColor: c.border }]} />
        </View>
        <View style={styles.actionGrid}>
          {ACTIONS.map((a, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(280 + i * 50).duration(350)} style={{ width: "47.5%" }}>
              <ActionCard action={a} c={c} onPress={() => navigation.navigate(a.route)} />
            </Animated.View>
          ))}
        </View>

      </ScrollView>
    </ScreenWrapper>
  );
}

/* ── KPI Card ── */
function KPICard({ label, value, icon, c, iconColor }: any) {
  return (
    <View style={[styles.kpiCard, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={[styles.kpiAccent, { backgroundColor: iconColor + "18", borderBottomColor: iconColor + "30", borderBottomWidth: 1 }]}>
        <View style={[styles.kpiIconWrap, { backgroundColor: iconColor + "22" }]}>
          <MaterialIcons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={[styles.kpiLabel, { color: c.sub }]} numberOfLines={1}>{label}</Text>
      </View>
      <View style={styles.kpiValueWrap}>
        <NumberText size={30}>
          {value}
        </NumberText>
      </View>
    </View>
  );
}

/* ── Action Card with press scale ── */
function ActionCard({ action, c, onPress }: { action: typeof ACTIONS[0]; c: any; onPress: () => void }) {
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={anim}>
      <Pressable
        style={[styles.actionCard, { borderColor: c.amber + "30", backgroundColor: c.amber + "06" }]}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 16, stiffness: 280 }); }}
        onPressOut={() => { scale.value = withSpring(1,    { damping: 16, stiffness: 280 }); }}
      >
        <View style={[styles.actionIconWrap, { backgroundColor: c.amber + "18" }]}>
          <MaterialIcons name={action.icon as any} size={18} color={c.amber} />
        </View>
        <Text style={[styles.actionLabel, { color: c.text }]}>{action.label}</Text>
        <Text style={[styles.actionDesc,  { color: c.sub  }]}>{action.desc}</Text>
      </Pressable>
    </Animated.View>
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
  headerSub:      { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 1.5 },
  headerRight:    { alignItems: "flex-end" },
  headerGreeting: { fontSize: 10, fontFamily: "SpaceGrotesk_400Regular" },
  headerName:     { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },

  scroll: { padding: 20, gap: 20 },

  datePill:  { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  dateDot:   { width: 5, height: 5, borderRadius: 3 },
  dateLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_600SemiBold", letterSpacing: 1.5 },

  kpiGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCardWrap:{ width: "47.5%" },
  kpiCard: {
    borderWidth: 1, borderRadius: 14, overflow: "hidden",
  },
  kpiAccent: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  kpiIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    justifyContent: "center", alignItems: "center",
  },
  kpiLabel: {
    fontSize: 11, fontFamily: "SpaceGrotesk_500Medium", flex: 1,
  },
  kpiValueWrap: {
    paddingHorizontal: 14, paddingVertical: 12,
  },

  divider: { height: 1 },

  sectionRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 1.5 },
  sectionLine:  { flex: 1, height: 1 },

  actionGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  actionCard: {
    flex: 1, borderWidth: 1, borderRadius: 12,
    padding: 14, gap: 8,
  },
  actionIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  actionLabel: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  actionDesc:  { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular" },
});