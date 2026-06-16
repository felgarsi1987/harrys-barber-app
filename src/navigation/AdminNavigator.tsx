import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator }     from "@react-navigation/stack";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../hooks/useThemeColors";
import { TabIcon } from "../components/ui/TabIcon";

import { AdminDashboardScreen }  from "../screens/admin/AdminDashboardScreen";
import { AdminReservasScreen }   from "../screens/admin/AdminReservasScreen";
import { AdminPagosScreen }      from "../screens/admin/AdminPagosScreen";
import { AdminClientesScreen }   from "../screens/admin/AdminClientesScreen";
import { AdminPerfilScreen }     from "../screens/admin/AdminPerfilScreen";
import { AdminHorarioScreen }       from "../screens/admin/AdminHorarioScreen";
import { EmpleadoAgendaScreen }     from "../screens/empleado/EmpleadoAgendaScreen";
import { AdminEmpleadosScreen }     from "../screens/admin/AdminEmpleadosScreen";
import { AdminInventarioScreen }    from "../screens/admin/AdminInventarioScreen";
import { AdminEventosScreen }       from "../screens/admin/AdminEventosScreen";
import { AdminNuevaReservaScreen }  from "../screens/admin/AdminNuevaReservaScreen";
import { AdminBalancesScreen }      from "../screens/admin/AdminBalancesScreen";
import { AdminServiciosScreen }     from "../screens/admin/AdminServiciosScreen";
import { AdminAsignarReservaScreen }from "../screens/admin/AdminAsignarReservaScreen";
import { PedidosScreen }             from "../screens/shared/PedidosScreen";
import { EntretenimientoScreen }     from "../screens/shared/EntretenimientoScreen";

function AdminPedidosGestScreen() {
  return <PedidosScreen mode="admin" showBackHeader={false} />;
}

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ── Tab raíz ──────────────────────────────────────────────────
function AdminTabs() {
  const c      = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor:  c.border,
          borderTopWidth:  1,
          height:          60 + insets.bottom,
          paddingBottom:   8 + insets.bottom,
        },
        tabBarActiveTintColor:   c.amber,
        tabBarInactiveTintColor: c.sub,
        tabBarLabelStyle: { fontSize: 10 },
        tabBarIcon: ({ color, focused }) => {
          const icons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
            Dashboard:       "dashboard",
            Reservas:        "event-available",
            Agenda:          "calendar-today",
            Pedidos:         "receipt-long",
            Clientes:        "person-search",
            Entretenimiento: "sports-soccer",
            Perfil:          "manage-accounts",
          };
          return (
            <TabIcon name={icons[route.name] ?? "circle"} color={color} focused={focused} />
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard"       component={AdminDashboardScreen} />
      <Tab.Screen name="Reservas"        component={AdminReservasScreen} />
      <Tab.Screen name="Agenda"          component={EmpleadoAgendaScreen} />
      <Tab.Screen name="Pedidos"         component={AdminPedidosGestScreen} />
      <Tab.Screen name="Clientes"        component={AdminClientesScreen} />
      <Tab.Screen name="Entretenimiento" component={EntretenimientoScreen} />
      <Tab.Screen name="Perfil"          component={AdminPerfilScreen} />
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
      <Stack.Screen name="AdminAgenda"          component={EmpleadoAgendaScreen} />
      <Stack.Screen name="AdminBalances"        component={AdminBalancesScreen} />
      <Stack.Screen name="AdminServicios"       component={AdminServiciosScreen} />
      <Stack.Screen name="AdminAsignarReserva"  component={AdminAsignarReservaScreen} />
      <Stack.Screen name="Pagos"               component={AdminPagosScreen} />
    </Stack.Navigator>
  );
}
