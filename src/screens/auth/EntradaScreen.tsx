import React, { useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, Image,
} from "react-native";
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSpring,
  withTiming, withRepeat, withDelay, interpolate, Easing,
} from "react-native-reanimated";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { MaterialIcons, Feather } from "@expo/vector-icons";
import { useThemeColors }  from "../../hooks/useThemeColors";
import { navState }        from "../../utils/navState";

function ScaleBtn({
  onPress, style, children,
}: { onPress: () => void; style: any; children: React.ReactNode }) {
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={anim}>
      <Pressable
        style={style}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 18, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1,    { damping: 18, stiffness: 300 }); }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function EntradaScreen() {
  const c          = useThemeColors();
  const navigation = useNavigation<any>();

  // ── Efecto 3D: el logo entra con un flip y luego flota en perspectiva ──
  const intro = useSharedValue(0);   // entrada (una vez)
  const float = useSharedValue(0);   // flotación continua

  useEffect(() => {
    intro.value = withDelay(120, withTiming(1, { duration: 800, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    float.value = withRepeat(
      withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.ease) }),
      -1, true,
    );
  }, []);

  // Logo: flip de entrada (rotateX) + balanceo 3D continuo (rotateY) + flotación (translateY)
  const logo3D = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { rotateX: `${interpolate(intro.value, [0, 1], [40, 0])}deg` },
      { rotateY: `${interpolate(float.value, [0, 1], [-8, 8])}deg` },
      { translateY: interpolate(float.value, [0, 1], [-5, 5]) },
    ],
  }));

  // Glow: parallax suave en sentido opuesto → sensación de profundidad
  const glow3D = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [4, -4]) }],
  }));

  useFocusEffect(useCallback(() => {
    navState.lastAuthScreen = "entrada";
  }, []));

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>

      {/* Logo — entra desde arriba */}
      <Animated.View entering={FadeIn.delay(80).duration(600)} style={styles.logoSection}>
        {/* Glow detrás del logo — parallax 3D */}
        <Animated.View style={[styles.logoGlow, glow3D, { backgroundColor: c.amber + "18" }]} />
        <Animated.View style={[styles.logoGlowInner, glow3D, { backgroundColor: c.amber + "12" }]} />
        <Animated.View style={logo3D}>
          <Image
            source={require("../../../assets/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <Text style={[styles.brand,    { color: c.text }]}>HARRY'S</Text>
        <Text style={[styles.brandSub, { color: c.amber }]}>BARBER SHOP</Text>
      </Animated.View>

      {/* Buttons — entran desde abajo */}
      <Animated.View entering={FadeInDown.delay(220).duration(500)} style={styles.btns}>

        <ScaleBtn
          onPress={() => navigation.navigate("Login")}
          style={[styles.loginBtn, { backgroundColor: c.amber }]}
        >
          <MaterialIcons name="email" size={18} color="#000" />
          <Text style={styles.loginText}>Ingresar con correo</Text>
        </ScaleBtn>

        <ScaleBtn
          onPress={() => navigation.navigate("Invitado")}
          style={[styles.guestBtn, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Feather name="user" size={16} color={c.sub} />
          <Text style={[styles.guestText, { color: c.sub }]}>Continuar como invitado</Text>
        </ScaleBtn>

        <Pressable
          onPress={() => navigation.navigate("Registro")}
          style={styles.registerBtn}
        >
          <Text style={[styles.registerText, { color: c.sub }]}>
            ¿No tienes cuenta? <Text style={{ color: c.amber }}>Regístrate</Text>
          </Text>
        </Pressable>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, justifyContent: "space-between", paddingVertical: 60, paddingHorizontal: 32 },
  logoSection:  { alignItems: "center", gap: 12, marginTop: 40 },
  logoGlow:     { position: "absolute", width: 260, height: 260, borderRadius: 130, top: -30, opacity: 0.6 },
  logoGlowInner:{ position: "absolute", width: 180, height: 180, borderRadius: 90, top: 10, opacity: 0.8 },
  logo:         { width: 120, height: 120, borderRadius: 60, zIndex: 1 },
  brand:        { fontSize: 32, fontFamily: "Syne_800ExtraBold", letterSpacing: 8 },
  brandSub:     { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium", letterSpacing: 4 },
  btns:         { gap: 16 },
  loginBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 8, height: 52, borderRadius: 12 },
  loginText:    { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  guestBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 8, height: 46, borderRadius: 12, borderWidth: 1 },
  guestText:    { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
  registerBtn:  { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  registerText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
});
