import React, { useRef } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { useAuth } from "../hooks/useAuth";
import { useThemeStore } from "../store/themeStore";
import { useAuthStore } from "../store/authStore";
import { useGuestStore } from "../store/guestStore";
import { getThemeColors } from "../theme/colors";
import { AuthNavigator } from "./AuthNavigator";
import { AdminNavigator } from "./AdminNavigator";
import { EmpleadoNavigator } from "./EmpleadoNavigator";
import { ClienteNavigator } from "./ClienteNavigator";
import { GuestNavigator } from "./GuestNavigator";

const Stack = createStackNavigator();

export function RootNavigator() {
  const { user, isLoading } = useAuth();
  const guest  = useGuestStore((s) => s.guest);
  const mode   = useThemeStore((state) => state.mode);
  const c      = getThemeColors(mode);

  // Track if we were previously authenticated - prevents resetting
  // AuthNavigator to Splash when a login error occurs
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.blue} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user && !guest ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !user && guest ? (
          <Stack.Screen name="Guest" component={GuestNavigator} />
        ) : user?.role === "admin" ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : user?.role === "empleado" ? (
          <Stack.Screen name="Empleado" component={EmpleadoNavigator} />
        ) : (
          <Stack.Screen name="Cliente" component={ClienteNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}