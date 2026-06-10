import React, { useEffect, useState, useCallback } from "react";
import { View, StatusBar, Platform } from "react-native";
import * as SplashScreen  from "expo-splash-screen";
import * as Font          from "expo-font";
import * as Network       from "expo-network";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from "@expo-google-fonts/space-grotesk";
import { Syne_700Bold, Syne_800ExtraBold } from "@expo-google-fonts/syne";
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
      SpaceGrotesk_400Regular,
      SpaceGrotesk_500Medium,
      SpaceGrotesk_600SemiBold,
      Syne_700Bold,
      Syne_800ExtraBold,
    }).then(() => setFontsLoaded(true));
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
