import { initializeApp, type FirebaseApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword, 
    signOut as firebaseSignOut, 
    type Auth, 
    type User 
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { writable, type Writable } from 'svelte/store';

// Get Firebase config from .env variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate that all necessary Firebase config values are present
for (const [key, value] of Object.entries(firebaseConfig)) {
  if (key !== 'measurementId' && !value) { // measurementId is optional
    throw new Error(`Missing Firebase config value for ${key}. Please check your .env file.`);
  }
}

// Initialize Firebase
let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Failed to initialize Firebase app:", e);
  throw new Error("Firebase initialization failed. Check your Firebase configuration and .env file.");
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// Svelte stores for authentication state
export const currentUser: Writable<User | null> = writable(null);
export const isLoadingAuth: Writable<boolean> = writable(true);
export const authError: Writable<Error | null | unknown> = writable(null); // Can store FirebaseError or general Error

// Listener for authentication state changes
onAuthStateChanged(auth, (user) => {
  currentUser.set(user);
  isLoadingAuth.set(false);
  authError.set(null); // Clear any previous error on auth state change
}, (error) => {
  console.error('Firebase onAuthStateChanged error:', error);
  authError.set(error);
  currentUser.set(null);
  isLoadingAuth.set(false);
});

// Login function
export async function loginWithEmailPassword(email: string, password: string): Promise<void> {
  isLoadingAuth.set(true);
  authError.set(null);
  try {
    await firebaseSignInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged will handle setting currentUser and isLoadingAuth to false
  } catch (error) {
    console.error('Firebase login error:', error);
    authError.set(error);
    isLoadingAuth.set(false);
    throw error; // Re-throw for the component to handle if needed
  }
}

// Logout function
export async function logoutUser(): Promise<void> {
  isLoadingAuth.set(true);
  authError.set(null);
  try {
    await firebaseSignOut(auth);
    // onAuthStateChanged will handle setting currentUser to null and isLoadingAuth to false
  } catch (error) {
    console.error('Firebase logout error:', error);
    authError.set(error);
    isLoadingAuth.set(false);
    throw error; // Re-throw for the component to handle if needed
  }
}

// Example of how you might fetch user profile data from Firestore
// export async function getUserProfile(uid: string) {
//   if (!uid) return null;
//   try {
//     const docRef = doc(db, 'rapidtools_users', uid);
//     const docSnap = await getDoc(docRef);
//     if (docSnap.exists()) {
//       return { uid, ...docSnap.data() };
//     } else {
//       console.log("No such user profile document in Firestore!");
//       return null;
//     }
//   } catch (error) {
//     console.error("Error getting user profile from Firestore:", error);
//     return null;
//   }
// } 