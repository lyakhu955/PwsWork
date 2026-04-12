/* ========================================
   PWSWORK - FIREBASE CONFIG
   Firebase Initialization & Firestore DB
   ======================================== */

const firebaseConfig = {
    apiKey: "AIzaSyBji5aS5igcHbZCtQHz7Je6wbNzpDrAhPk",
    authDomain: "pwswo-6128f.firebaseapp.com",
    projectId: "pwswo-6128f",
    storageBucket: "pwswo-6128f.firebasestorage.app",
    messagingSenderId: "225349266473",
    appId: "1:225349266473:web:55c8a489670b49f53b0038",
    measurementId: "G-VTDXG2WTPX"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firestore database instance with offline cache
const db = firebase.firestore();
db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    merge: true
});

console.log('🔥 Firebase initialized — project:', firebaseConfig.projectId);
