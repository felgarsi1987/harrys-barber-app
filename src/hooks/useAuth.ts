import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { registerForPushNotifications } from "../services/notifications";

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    const unsub = store.initialize();
    return unsub;
  }, []);

  useEffect(() => {
    if (store.user?.uid) {
      registerForPushNotifications(store.user.uid).catch(() => {});
    }
  }, [store.user?.uid]);

  return store;
}