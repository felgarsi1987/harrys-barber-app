import React, { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Image,
  ActivityIndicator, Alert,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { navState } from "../../utils/navState";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../services/firebase";
import { useThemeColors }  from "../../hooks/useThemeColors";
import { useAuthStore }    from "../../store/authStore";
import { ScreenWrapper }  from "../../components/ui/ScreenWrapper";
import { Typography }      from "../../theme/typography";
import { Spacing, Radius } from "../../theme/spacing";

export function LoginScreen() {
  // Track that we're on login so remount returns here after error
  useFocusEffect(useCallback(() => {
    navState.lastAuthScreen = "login";
    // Don't reset on unmount - we want to return to Login after error
    return () => {};
  }, []));
  const navigation = useNavigation<any>();
  const c = useThemeColors();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    clearError();
    await login(email.trim().toLowerCase(), password);
  };

  const handleRecuperarContrasena = async () => {
    if (!email.trim()) {
      Alert.alert("Ingresa tu correo", "Escribe tu correo arriba para recuperar la contraseña.");
      return;
    }
    setEnviando(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      Alert.alert(
        "✅ Correo enviado",
        `Te enviamos un enlace para restablecer tu contraseña a ${email.trim()}.`
      );
    } catch (e: any) {
      Alert.alert("Error", "No se pudo enviar el correo. Verifica que el email sea correcto.");
    } finally { setEnviando(false); }
  };

  return (
    <ScreenWrapper>
        <View style={styles.container}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ alignSelf: "flex-start" }}
          >
            <Text style={[Typography.body, { color: c.blue }]}>← Volver</Text>
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/images/harrys_logo_clean.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={[Typography.h2, { color: c.text }]}>Ingresar</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={[Typography.label, { color: c.sub }]}>Correo</Text>
            <TextInput
              style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.border }]}
              value={email}
              onChangeText={setEmail}
              placeholder="correo@ejemplo.com"
              placeholderTextColor={c.sub}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Contraseña */}
          <View style={styles.fieldGroup}>
            <Text style={[Typography.label, { color: c.sub }]}>Contraseña</Text>
            <View>
              <TextInput
                style={[styles.input, { color: c.text, backgroundColor: c.surface,
                  borderColor: c.border, paddingRight: 48 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={c.sub}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity
                onPress={() => setShowPass(!showPass)}
                style={styles.eyeBtn}
              >
                <Text style={{ color: c.sub, fontSize: 16 }}>
                  {showPass ? "🙈" : "👁"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Error */}
          {error ? (
            <Text style={[Typography.bodySmall, { color: c.negative }]}>{error}</Text>
          ) : null}

          {/* Recuperar contraseña */}
          {(
            <TouchableOpacity
              onPress={handleRecuperarContrasena}
              disabled={enviando}
            >
              <Text style={[Typography.body, { color: c.sub }]}>
                {enviando ? "Enviando..." : "¿Olvidaste tu contraseña?"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Registro */}
          {(
            <TouchableOpacity onPress={() => navigation.navigate("Registro")}>
              <Text style={[Typography.body, { color: c.blue }]}>
                ¿No tienes cuenta? Regístrate
              </Text>
            </TouchableOpacity>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: c.blue, opacity: isLoading ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={[Typography.bodyLarge, { color: "#fff" }]}>Ingresar</Text>
            }
          </TouchableOpacity>
        </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  logoContainer: { alignItems: 'center', marginVertical: 12 },
  logo: { width: 80, height: 80, borderRadius: 40 },
  container:  {
    flex: 1, padding: Spacing.lg, gap: Spacing.md, justifyContent: "center",
  },
  fieldGroup: { gap: 6 },
  input: {
    height: 50, borderWidth: 1, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, fontSize: 15,
  },
  eyeBtn: { position: "absolute", right: 14, top: 13 },
  btn: {
    height: 52, borderRadius: Radius.md,
    justifyContent: "center", alignItems: "center", marginTop: Spacing.sm,
  },
});