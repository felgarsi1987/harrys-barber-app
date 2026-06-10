import React, { useEffect, useState, useCallback } from "react";
import { View, StatusBar, Platform } from "react-native";
import * as SplashScreen  from "expo-splash-screen";
import * as Font          from "expo-font";
import * as Network       from "expo-network";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator }     from "./src/navigation/RootNavigator";
import { SinConexionScreen } from "./src/screens/errors/SinConexionScreen";

SplashScreen.preventAutoHideAsync();

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
    })
      .then(() => setFontsLoaded(true))
      .catch(() => setFontsLoaded(true));

    setTimeout(() => setFontsLoaded(true), 3000);
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setSinConexion(!state.isConnected);
    } catch { setSinConexion(false); }
  };

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
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
