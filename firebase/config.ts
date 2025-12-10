// FIX: Use Firebase v9 compat imports to support v8 syntax.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAgFzoQVo72efNbTRYMO76h5oms3QPhGK4",
  authDomain: "deeppos-system.firebaseapp.com",
  projectId: "deeppos-system",
  storageBucket: "deeppos-system.firebasestorage.app",
  messagingSenderId: "538229284129",
  appId: "1:538229284129:web:dc44844164e091e90ff260",
  measurementId: "G-9HWEF3CL2T"
};

// Initialize Firebase
// FIX: Use v8 initialization and prevent re-initialization on hot reloads.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}


// Initialize Cloud Firestore and get a reference to the service
// FIX: Use v8 syntax to get firestore instance.
export const db = firebase.firestore();