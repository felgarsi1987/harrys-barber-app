import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

import { EmpleadoAgendaScreen }    from "../screens/empleado/EmpleadoAgendaScreen";
import { EmpleadoReservaScreen }   from "../screens/empleado/EmpleadoReservaScreen";
import { EmpleadoInventarioScreen } from "../screens/empleado/EmpleadoInventarioScreen";
import { EmpleadoPerfilScreen }    from "../screens/empleado/EmpleadoPerfilScreen";

const Tab = createBottomTabNavigator();

export function EmpleadoNavigator() {
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
            Agenda:     "event-note",
            "Nueva Cita": "add-circle-outline",
            Inventario: "inventory-2",
            Perfil:     "person-outline",
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
      <Tab.Screen name="Agenda"      component={EmpleadoAgendaScreen} />
      <Tab.Screen name="Nueva Cita"  component={EmpleadoReservaScreen} />
      <Tab.Screen name="Inventario"  component={EmpleadoInventarioScreen} />
      <Tab.Screen name="Perfil"      component={EmpleadoPerfilScreen} />
    </Tab.Navigator>
  );
}