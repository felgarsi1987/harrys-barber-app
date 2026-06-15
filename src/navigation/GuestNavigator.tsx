import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors }   from "../hooks/useThemeColors";
import { useGuestStore }    from "../store/guestStore";
import { ClienteAgendarScreen }  from "../screens/cliente/ClienteAgendarScreen";
import { ClienteCarritoScreen }  from "../screens/cliente/ClienteCarritoScreen";
import { EntretenimientoScreen } from "../screens/shared/EntretenimientoScreen";
import { ScreenWrapper }         from "../components/ui/ScreenWrapper";

function ScalePress({ onPress, style, children }: { onPress: () => void; style: any; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={anim}>
      <TouchableOpacity
        onPress={onPress}
        style={style}
        activeOpacity={1}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 16, stiffness: 280 }); }}
        onPressOut={() => { scale.value = withSpring(1,    { damping: 16, stiffness: 280 }); }}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

function GuestPerfilScreen() {
  const c          = useThemeColors();
  const guest      = useGuestStore(s => s.guest);
  const clearGuest = useGuestStore(s => s.clearGuest);

  const initials = `${guest?.nombre?.[0] ?? ""}${guest?.apellido?.[0] ?? ""}`.toUpperCase();

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.amber + "08" }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>Mi perfil</Text>
        <Text style={[styles.headerSub, { color: c.amber }]}>Sesión de invitado</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(200)} style={styles.avatarSection}>
          <View style={[styles.avatarGlow, { backgroundColor: c.amber + "18" }]} />
          <View style={[styles.avatar, { backgroundColor: c.amber + "22", borderColor: c.amber + "44", borderWidth: 2 }]}>
            <Text style={[styles.avatarText, { color: c.amber }]}>{initials}</Text>
          </View>
          <Text style={[styles.name, { color: c.text }]}>
            {guest?.nombre} {guest?.apellido}
          </Text>
          <View style={[styles.badge, { backgroundColor: c.amber + "18", borderColor: c.amber + "44" }]}>
            <View style={[styles.badgeDot, { backgroundColor: c.amber }]} />
            <Text style={[styles.badgeText, { color: c.amber }]}>Invitado</Text>
          </View>
          {guest?.fecha ? (
            <Text style={[styles.fechaNac, { color: c.sub }]}>
              Nacimiento: {guest.fecha}
            </Text>
          ) : null}
        </Animated.View>

        {/* Sección info */}
        <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(200)}>
          <View style={styles.secRow}>
            <Text style={[styles.secLabel, { color: c.sub }]}>CUENTA</Text>
            <View style={[styles.secLine, { backgroundColor: c.border }]} />
          </View>
        </Animated.View>

        {/* Info card */}
        <Animated.View entering={FadeInDown.delay(160).springify().damping(18).stiffness(200)}
          style={[styles.infoCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: c.amber + "18" }]}>
              <MaterialIcons name="person-outline" size={16} color={c.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: c.sub }]}>TIPO DE SESIÓN</Text>
              <Text style={[styles.infoValue, { color: c.text }]}>Acceso como invitado</Text>
            </View>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: c.border }]} />
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: c.blue + "18" }]}>
              <MaterialIcons name="info-outline" size={16} color={c.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoLabel, { color: c.sub }]}>ACCESO</Text>
              <Text style={[styles.infoValue, { color: c.text }]}>Agendar · Tienda · Entretenimiento</Text>
            </View>
          </View>
        </Animated.View>

        {/* Tema */}
        <Animated.View entering={FadeInDown.delay(200).springify().damping(18).stiffness(200)}>
          <View style={styles.secRow}>
            <Text style={[styles.secLabel, { color: c.sub }]}>PREFERENCIAS</Text>
            <View style={[styles.secLine, { backgroundColor: c.border }]} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).springify().damping(18).stiffness(200)}
          style={[styles.infoCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: c.amber + "18" }]}>
              <MaterialIcons name={c.mode === "dark" ? "dark-mode" : "light-mode"} size={16} color={c.amber} />
            </View>
            <Text style={[styles.infoValue, { color: c.text, flex: 1 }]}>
              Tema {c.mode === "dark" ? "oscuro" : "claro"}
            </Text>
            <TouchableOpacity
              onPress={c.toggle}
              style={[styles.themeBtn, { backgroundColor: c.amber + "22", borderColor: c.amber + "44" }]}
            >
              <Text style={[styles.themeBtnText, { color: c.amber }]}>Cambiar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Registrarse */}
        <Animated.View entering={FadeInDown.delay(280).springify().damping(18).stiffness(200)}
          style={[styles.registerCard, { backgroundColor: c.amber + "0A", borderColor: c.amber + "30" }]}>
          <MaterialIcons name="star-outline" size={20} color={c.amber} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.registerTitle, { color: c.text }]}>¿Quieres más beneficios?</Text>
            <Text style={[styles.registerDesc, { color: c.sub }]}>
              Regístrate para acumular puntos, saldo y más
            </Text>
          </View>
        </Animated.View>

        {/* Salir */}
        <Animated.View entering={FadeInDown.delay(320).springify().damping(18).stiffness(200)}>
          <ScalePress
            onPress={clearGuest}
            style={[styles.salirBtn, { borderColor: c.negative + "50", backgroundColor: c.negative + "0A" }]}
          >
            <MaterialIcons name="logout" size={18} color={c.negative} />
            <Text style={[styles.salirText, { color: c.negative }]}>Cerrar sesión de invitado</Text>
          </ScalePress>
        </Animated.View>

      </ScrollView>
    </ScreenWrapper>
  );
}

const Tab = createBottomTabNavigator();

export function GuestNavigator() {
  const c      = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor:  c.border,
          borderTopWidth:  1,
          height:          60 + insets.bottom,
          paddingBottom:   8 + insets.bottom,
        },
        tabBarActiveTintColor:   c.amber,
        tabBarInactiveTintColor: c.sub,
        tabBarLabelStyle: { fontSize: 10 },
        tabBarIcon: ({ color }) => {
          const icons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
            Agendar:         "content-cut",
            Entretenimiento: "sports-soccer",
            Tienda:          "shopping-bag",
            Perfil:          "person-outline",
          };
          return <MaterialIcons name={icons[route.name] ?? "circle"} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Agendar"         component={ClienteAgendarScreen} />
      <Tab.Screen name="Entretenimiento" component={EntretenimientoScreen} />
      <Tab.Screen name="Tienda"          component={ClienteCarritoScreen} />
      <Tab.Screen name="Perfil"          component={GuestPerfilScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontFamily: "Syne_700Bold" },
  headerSub:   { fontSize: 11, fontFamily: "SpaceGrotesk_500Medium", marginTop: 2 },

  scroll: { padding: 20, gap: 16 },

  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 12 },
  avatarGlow: {
    position: "absolute", width: 140, height: 140, borderRadius: 70, top: 0,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 30, fontFamily: "Syne_700Bold" },
  name:       { fontSize: 22, fontFamily: "Syne_700Bold", marginTop: 4 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  badgeDot:   { width: 5, height: 5, borderRadius: 3 },
  badgeText:  { fontSize: 11, fontFamily: "SpaceGrotesk_600SemiBold" },
  fechaNac:   { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },

  secRow:   { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  secLabel: { fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 1.5 },
  secLine:  { flex: 1, height: 1 },

  infoCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  infoRow:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  infoIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  infoLabel:{ fontSize: 10, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 1 },
  infoValue:{ fontSize: 14, fontFamily: "SpaceGrotesk_500Medium", marginTop: 1 },
  infoDivider: { height: 1, marginHorizontal: 14 },

  themeBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  themeBtnText: { fontSize: 12, fontFamily: "SpaceGrotesk_600SemiBold" },

  registerCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  registerTitle: { fontSize: 14, fontFamily: "SpaceGrotesk_600SemiBold" },
  registerDesc:  { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },

  salirBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 50, borderRadius: 12, borderWidth: 1, gap: 8,
  },
  salirText: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
});
