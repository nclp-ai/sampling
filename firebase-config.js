const firebaseConfig = {
  apiKey: "AIzaSyCV7Me1aO_K_wZNy16qUNFiNz5-BXo2Kaw",
  authDomain: "sampling-distribution.firebaseapp.com",
  databaseURL: "https://sampling-distribution-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sampling-distribution",
  storageBucket: "sampling-distribution.firebasestorage.app",
  messagingSenderId: "202635276123",
  appId: "1:202635276123:web:12d19ebeb41ecdc794f47e"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
