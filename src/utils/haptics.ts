import * as Haptics from "expo-haptics";

// Wrapper seguro: si el dispositivo no soporta háptica, no pasa nada.
export const haptics = {
  light:     () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {} },
  medium:    () => { try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {} },
  selection: () => { try { Haptics.selectionAsync(); } catch {} },
  success:   () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {} },
  warning:   () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch {} },
  error:     () => { try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {} },
};
