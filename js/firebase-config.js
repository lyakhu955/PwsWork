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

// Firestore database instance
const db = firebase.firestore();

// Enable offline persistence for better UX
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence failed: multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence not available in this browser');
    }
});

console.log('🔥 Firebase initialized — project:', firebaseConfig.projectId);
