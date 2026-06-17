import React, { useEffect, useState, useCallback } from "react";
import { View, StatusBar, Platform } from "react-native";
import * as SplashScreen  from "expo-splash-screen";
import * as Font          from "expo-font";
import { Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator }     from "./src/navigation/RootNavigator";
import { SinConexionScreen } from "./src/screens/errors/SinConexionScreen";

const isNative = Platform.OS === "android" || Platform.OS === "ios";

if (isNative) {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [sinConexion, setSinConexion] = useState(false);

  useEffect(() => {
    if (Platform.OS === "android") {
      StatusBar.setBackgroundColor("transparent", false);
      StatusBar.setTranslucent(true);
    }

    Font.loadAsync({
      SpaceGrotesk_400Regular: require("./assets/fonts/SpaceGrotesk_400Regular.ttf"),
      SpaceGrotesk_500Medium:  require("./assets/fonts/SpaceGrotesk_500Medium.ttf"),
      SpaceGrotesk_600SemiBold:require("./assets/fonts/SpaceGrotesk_600SemiBold.ttf"),
      Syne_700Bold:            require("./assets/fonts/Syne_700Bold.ttf"),
      Syne_800ExtraBold:       require("./assets/fonts/Syne_800ExtraBold.ttf"),
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
    })
      .then(() => setFontsLoaded(true))
      .catch(() => setFontsLoaded(true));

    setTimeout(() => setFontsLoaded(true), 3000);
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (!isNative) return; // en web el navegador gestiona la conectividad
    try {
      const Network = await import("expo-network");
      const state = await Network.getNetworkStateAsync();
      setSinConexion(!state.isConnected);
    } catch { setSinConexion(false); }
  };

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && isNative) await SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded && isNative) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        {sinConexion
          ? <SinConexionScreen onRetry={() => { setSinConexion(false); checkConnection(); }} />
          : <RootNavigator />
        }
      </View>
    </SafeAreaProvider>
  );
}
