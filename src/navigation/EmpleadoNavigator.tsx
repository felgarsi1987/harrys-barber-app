import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../hooks/useThemeColors";

import { EmpleadoDashboardScreen }  from "../screens/empleado/EmpleadoDashboardScreen";
import { EmpleadoAgendaScreen }    from "../screens/empleado/EmpleadoAgendaScreen";
import { EmpleadoReservaScreen }   from "../screens/empleado/EmpleadoReservaScreen";
import { EmpleadoInventarioScreen } from "../screens/empleado/EmpleadoInventarioScreen";
import { EmpleadoPerfilScreen }    from "../screens/empleado/EmpleadoPerfilScreen";
import { PedidosScreen }             from "../screens/shared/PedidosScreen";
import { EntretenimientoScreen }     from "../screens/shared/EntretenimientoScreen";

function EmpleadoPedidosScreen() {
  return <PedidosScreen mode="empleado" showBackHeader={false} />;
}

const Tab = createBottomTabNavigator();

export function EmpleadoNavigator() {
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
        tabBarIcon: ({ color }) => {
          const icons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
            Inicio:           "home",
            Agenda:           "event-note",
            "Nueva Cita":     "add-circle-outline",
            Inventario:       "inventory-2",
            Pedidos:          "receipt-long",
            Entretenimiento:  "sports-soccer",
            Perfil:           "person-outline",
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
      <Tab.Screen name="Inicio"            component={EmpleadoDashboardScreen} />
      <Tab.Screen name="Agenda"           component={EmpleadoAgendaScreen} />
      <Tab.Screen name="Nueva Cita"       component={EmpleadoReservaScreen} />
      <Tab.Screen name="Inventario"       component={EmpleadoInventarioScreen} />
      <Tab.Screen name="Pedidos"          component={EmpleadoPedidosScreen} />
      <Tab.Screen name="Entretenimiento"  component={EntretenimientoScreen} />
      <Tab.Screen name="Perfil"           component={EmpleadoPerfilScreen} />
    </Tab.Navigator>
  );
}