import React, { useEffect, useState, useCallback } from "react";
import { View, StatusBar, Platform } from "react-native";
import * as SplashScreen   from "expo-splash-screen";
import * as Font           from "expo-font";
import * as Network        from "expo-network";
import * as NavigationBar  from "expo-navigation-bar";
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
    // Android: make both status bar AND navigation bar transparent
    // so the app content goes full screen and safe area insets
    // handle the actual padding correctly
    if (Platform.OS === "android") {
      StatusBar.setBackgroundColor("transparent", false);
      StatusBar.setTranslucent(true);
      // Make nav bar transparent so safe area insets work correctly
      NavigationBar.setPositionAsync("absolute").catch(() => {});
      NavigationBar.setBackgroundColorAsync("#00000000").catch(() => {});
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
