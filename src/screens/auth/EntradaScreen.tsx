import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { auth, db }        from "../../services/firebase";
import { useAuthStore }    from "../../store/authStore";
import { useThemeColors }  from "../../hooks/useThemeColors";
import { navState }        from "../../utils/navState";

// Configure Google Sign-In - webclientId from Firebase Console
GoogleSignin.configure({
  webClientId: "532202718754-assock1o21ofgd60ta3g7sa2rdkaomh7.apps.googleusercontent.com",
  offlineAccess: false,
  forceCodeForRefreshToken: false,
});

export function EntradaScreen() {
  const c          = useThemeColors();
  const navigation = useNavigation<any>();
  const { login }  = useAuthStore();
  const [googleLoading, setGoogleLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    navState.lastAuthScreen = "entrada";
  }, []));

  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const { idToken } = await GoogleSignin.getTokens();

      if (!idToken) throw new Error("No se obtuvo token de Google");

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);

      // Check if user document exists
      const snap = await getDoc(doc(db, "users", result.user.uid));
      if (!snap.exists()) {
        // Create new client profile
        const nombres = (result.user.displayName ?? "Usuario").split(" ");
        await setDoc(doc(db, "users", result.user.uid), {
          uid:       result.user.uid,
          email:     result.user.email ?? "",
          role:      "cliente",
          nombre:    nombres[0] ?? "Usuario",
          apellido:  nombres.slice(1).join(" ") || "Google",
          photoURL:  result.user.photoURL ?? null,
          createdAt: serverTimestamp(),
          saldo:     0,
        });
      }
      // authStore will pick up the new auth state via onAuthStateChanged
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled - do nothing
      } else if (e.code === statusCodes.IN_PROGRESS) {
        // Already signing in
      } else {
        Alert.alert("Error", "No se pudo iniciar sesión con Google. Intenta de nuevo.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Logo */}
      <View style={styles.logoSection}>
        <Image
          source={require("../../../assets/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.brand,    { color: c.text }]}>HARRY'S</Text>
        <Text style={[styles.brandSub, { color: c.amber }]}>BARBER SHOP</Text>
      </View>

      {/* Buttons */}
      <View style={styles.btns}>
        {/* Google Sign-In */}
        <TouchableOpacity
          onPress={signInWithGoogle}
          disabled={googleLoading}
          style={[styles.googleBtn, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          {googleLoading ? (
            <ActivityIndicator color={c.text} size="small" />
          ) : (
            <>
              <MaterialIcons name="g-mobiledata" size={24} color="#4285F4" />
              <Text style={[styles.googleText, { color: c.text }]}>
                Continuar con Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Email login */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          style={[styles.loginBtn, { backgroundColor: c.amber }]}
        >
          <MaterialIcons name="email" size={18} color="#000" />
          <Text style={styles.loginText}>Ingresar con correo</Text>
        </TouchableOpacity>

        {/* Register */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Registro")}
          style={[styles.registerBtn, { borderColor: c.border }]}
        >
          <Text style={[styles.registerText, { color: c.sub }]}>
            ¿No tienes cuenta? <Text style={{ color: c.amber }}>Regístrate</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, justifyContent: "space-between", paddingVertical: 60, paddingHorizontal: 32 },
  logoSection:  { alignItems: "center", gap: 8, marginTop: 40 },
  logo:         { width: 120, height: 120, borderRadius: 60 },
  brand:        { fontSize: 32, fontFamily: "Syne_800ExtraBold", letterSpacing: 8 },
  brandSub:     { fontSize: 12, letterSpacing: 4 },
  btns:         { gap: 14 },
  googleBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 10, height: 52, borderRadius: 12, borderWidth: 1 },
  googleText:   { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  loginBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 8, height: 52, borderRadius: 12 },
  loginText:    { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", color: "#000" },
  registerBtn:  { alignItems: "center", paddingVertical: 12 },
  registerText: { fontSize: 14, fontFamily: "SpaceGrotesk_400Regular" },
});
