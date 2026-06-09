import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator }     from "@react-navigation/stack";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeColors } from "../hooks/useThemeColors";

import { AdminDashboardScreen }  from "../screens/admin/AdminDashboardScreen";
import { AdminReservasScreen }   from "../screens/admin/AdminReservasScreen";
import { AdminPagosScreen }      from "../screens/admin/AdminPagosScreen";
import { AdminClientesScreen }   from "../screens/admin/AdminClientesScreen";
import { AdminPerfilScreen }     from "../screens/admin/AdminPerfilScreen";
import { AdminHorarioScreen }       from "../screens/admin/AdminHorarioScreen";
import { AdminEmpleadosScreen }     from "../screens/admin/AdminEmpleadosScreen";
import { AdminInventarioScreen }    from "../screens/admin/AdminInventarioScreen";
import { AdminEventosScreen }       from "../screens/admin/AdminEventosScreen";
import { AdminNuevaReservaScreen }  from "../screens/admin/AdminNuevaReservaScreen";

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Tab raíz ──────────────────────────────────────────────────
function AdminTabs() {
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
            Dashboard: "dashboard",
            Reservas:  "event-available",
            Pagos:     "payments",
            Clientes:  "person-search",
            Perfil:    "manage-accounts",
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
      <Tab.Screen name="Reservas"  component={AdminReservasScreen} />
      <Tab.Screen name="Pagos"     component={AdminPagosScreen} />
      <Tab.Screen name="Clientes"  component={AdminClientesScreen} />
      <Tab.Screen name="Perfil"    component={AdminPerfilScreen} />
    </Tab.Navigator>
  );
}

// ── Stack que envuelve las tabs + pantallas modales ───────────
export function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminTabs"          component={AdminTabs} />
      <Stack.Screen name="AdminHorario"        component={AdminHorarioScreen} />
      <Stack.Screen name="AdminEmpleados"      component={AdminEmpleadosScreen} />
      <Stack.Screen name="AdminInventario"     component={AdminInventarioScreen} />
      <Stack.Screen name="AdminEventos"        component={AdminEventosScreen} />
      <Stack.Screen name="AdminNuevaReserva"   component={AdminNuevaReservaScreen} />
    </Stack.Navigator>
  );
}
