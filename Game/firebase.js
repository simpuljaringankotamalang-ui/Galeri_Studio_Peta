// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQxBYjA7HX_hEM25hrsUcpF0OlipRIvag",
  authDomain: "studio-peta.firebaseapp.com",
  projectId: "studio-peta",
  storageBucket: "studio-peta.firebasestorage.app",
  messagingSenderId: "897399674029",
  appId: "1:897399674029:web:c949f77926a3e6b3252224",
  measurementId: "G-Q6REQRPQJQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// Export biar bisa dipake file lain
export { db };
