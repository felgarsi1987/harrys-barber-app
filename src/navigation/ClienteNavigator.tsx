import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator }     from "@react-navigation/stack";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

import { ClienteHomeScreen }       from "../screens/cliente/ClienteHomeScreen";
import { ClienteAgendarScreen }    from "../screens/cliente/ClienteAgendarScreen";
import { ClienteCarritoScreen }    from "../screens/cliente/ClienteCarritoScreen";
import { ClienteSaldoScreen }      from "../screens/cliente/ClienteSaldoScreen";
import { ClientePerfilScreen }     from "../screens/cliente/ClientePerfilScreen";
import { ClienteHistorialScreen }  from "../screens/cliente/ClienteHistorialScreen";

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

function ClienteTabs() {
  const c = useThemeColors();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor:  c.border,
          borderTopWidth:  1,
          height:          60,
          paddingBottom:   8,
        },
        tabBarActiveTintColor:   c.amber,
        tabBarInactiveTintColor: c.sub,
        tabBarLabelStyle: {
          fontSize:   10,
          fontFamily: "SpaceGrotesk_500Medium",
        },
        tabBarIcon: ({ color }) => {
          const icons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
            Inicio:  "home",
            Agendar: "event-available",
            Carrito: "shopping-cart",
            Saldo:   "account-balance-wallet",
            Perfil:  "person-outline",
          };
          return (
            <MaterialIcons
              name={icons[route.name] ?? "circle"}
              size={22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Inicio"  component={ClienteHomeScreen} />
      <Tab.Screen name="Agendar" component={ClienteAgendarScreen} />
      <Tab.Screen name="Carrito" component={ClienteCarritoScreen} />
      <Tab.Screen name="Saldo"   component={ClienteSaldoScreen} />
      <Tab.Screen name="Perfil"  component={ClientePerfilScreen} />
    </Tab.Navigator>
  );
}

export function ClienteNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClienteTabs"      component={ClienteTabs} />
      <Stack.Screen name="ClienteHistorial" component={ClienteHistorialScreen} />
    </Stack.Navigator>
  );
}
