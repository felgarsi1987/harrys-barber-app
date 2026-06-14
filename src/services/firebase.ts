import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            "AIzaSyClore_Urhw4CxP3U534brZLEbNct96yGo",
  authDomain:        "harrys-barber-app.firebaseapp.com",
  projectId:         "harrys-barber-app",
  storageBucket:     "harrys-barber-app.firebasestorage.app",
  messagingSenderId: "532202718754",
  appId:             "1:532202718754:web:b749e6a700d0447eb72c7b",
};

const isNew = !getApps().length;
const app: FirebaseApp = isNew ? initializeApp(firebaseConfig) : getApps()[0];

export const auth: Auth = isNew
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
export default app;