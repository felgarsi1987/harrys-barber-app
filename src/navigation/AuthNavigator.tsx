import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { SplashScreen }   from "../screens/auth/SplashScreen";
import { EntradaScreen }  from "../screens/auth/EntradaScreen";
import { LoginScreen }    from "../screens/auth/LoginScreen";
import { RegistroScreen } from "../screens/auth/RegistroScreen";

const Stack = createStackNavigator();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash"   component={SplashScreen} />
      <Stack.Screen name="Entrada"  component={EntradaScreen} />
      <Stack.Screen name="Login"    component={LoginScreen} />
      <Stack.Screen name="Registro" component={RegistroScreen} />
    </Stack.Navigator>
  );
}