import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, signOut } from "firebase/auth";
import { getStorage } from "firebase/storage";

function requireFirebaseEnv(name: string, value: string | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(
      `[Firebase] Missing ${name}. Add it to .env or .env.local and restart the Vite dev server.`,
    );
  }

  return normalizedValue;
}

export const firebaseConfig: FirebaseOptions = {
  apiKey: requireFirebaseEnv(
    "VITE_FIREBASE_API_KEY",
    import.meta.env.VITE_FIREBASE_API_KEY,
  ),
  authDomain: requireFirebaseEnv(
    "VITE_FIREBASE_AUTH_DOMAIN",
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  ),
  projectId: requireFirebaseEnv(
    "VITE_FIREBASE_PROJECT_ID",
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
  ),
  storageBucket: requireFirebaseEnv(
    "VITE_FIREBASE_STORAGE_BUCKET",
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  ),
  appId: requireFirebaseEnv(
    "VITE_FIREBASE_APP_ID",
    import.meta.env.VITE_FIREBASE_APP_ID,
  ),
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
};

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);

export async function clearFirebaseAuthSession() {
  if (!firebaseAuth.currentUser) {
    return;
  }

  await signOut(firebaseAuth);
}
