import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { SplashScreen }    from "../screens/auth/SplashScreen";
import { EntradaScreen }   from "../screens/auth/EntradaScreen";
import { LoginScreen }     from "../screens/auth/LoginScreen";
import { RegistroScreen }  from "../screens/auth/RegistroScreen";
import { InvitadoScreen }  from "../screens/auth/InvitadoScreen";

const Stack = createStackNavigator();

import { navState } from "../utils/navState";

export function AuthNavigator() {
  const initialRoute = navState.lastAuthScreen === "splash" ? "Splash"
    : navState.lastAuthScreen === "login" ? "Login"
    : "Entrada";
  
  if (navState.lastAuthScreen === "splash") navState.lastAuthScreen = "entrada";

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash"   component={SplashScreen} />
      <Stack.Screen name="Entrada"  component={EntradaScreen} />
      <Stack.Screen name="Login"    component={LoginScreen} />
      <Stack.Screen name="Registro" component={RegistroScreen} />
      <Stack.Screen name="Invitado" component={InvitadoScreen} />
    </Stack.Navigator>
  );
}