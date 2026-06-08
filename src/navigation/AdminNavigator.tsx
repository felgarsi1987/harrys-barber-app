import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

import { AdminDashboardScreen } from "../screens/admin/AdminDashboardScreen";
import { AdminEmpleadosScreen } from "../screens/admin/AdminEmpleadosScreen";
import { AdminHorarioScreen }   from "../screens/admin/AdminHorarioScreen";
import { AdminClientesScreen }  from "../screens/admin/AdminClientesScreen";
import { AdminPerfilScreen }    from "../screens/admin/AdminPerfilScreen";

const Tab = createBottomTabNavigator();

export function AdminNavigator() {
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
        tabBarActiveTintColor:   c.blue,
        tabBarInactiveTintColor: c.sub,
        tabBarLabelStyle: {
          fontSize:   10,
          fontFamily: "SpaceGrotesk_500Medium",
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
            Dashboard:  "dashboard",
            Empleados:  "people",
            Horario:    "schedule",
            Clientes:   "person-search",
            Perfil:     "manage-accounts",
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
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} />
      <Tab.Screen name="Empleados" component={AdminEmpleadosScreen} />
      <Tab.Screen name="Horario"   component={AdminHorarioScreen} />
      <Tab.Screen name="Clientes"  component={AdminClientesScreen} />
      <Tab.Screen name="Perfil"    component={AdminPerfilScreen} />
    </Tab.Navigator>
  );
}