import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBIzGgljkmraNjcW6VegxAdx5DIiP0c8sM",
  authDomain: "gpa-tracker-41f4f.firebaseapp.com",
  projectId: "gpa-tracker-41f4f",
  storageBucket: "gpa-tracker-41f4f.firebasestorage.app",
  messagingSenderId: "110289852707",
  appId: "1:110289852707:web:52403c417bf5e931e05496",
  measurementId: "G-1T019CHGG8"
};

export const firebaseProjectId = firebaseConfig.projectId;

let firebaseInitError: string | null = null;
let authInstance;
let providerInstance;
let firestoreInstance;
let analyticsInstancePromise: Promise<Analytics | null>;

try {
  const app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  providerInstance = new GoogleAuthProvider();
  firestoreInstance = getFirestore(app);
  analyticsInstancePromise =
    typeof window === "undefined"
      ? Promise.resolve(null)
      : isSupported()
          .then((supported) => (supported ? getAnalytics(app) : null))
          .catch(() => null);
} catch (error) {
  firebaseInitError = error instanceof Error ? error.message : "Unknown Firebase initialization error.";
  throw error;
}

export { firebaseInitError };
export const auth = authInstance;
export const googleProvider = providerInstance;
export const db = firestoreInstance;
export const analyticsPromise = analyticsInstancePromise;
