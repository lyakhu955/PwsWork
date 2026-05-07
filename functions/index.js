const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// Helper: get all FCM tokens from Firestore
async function getAllTokens() {
  const snapshot = await db.collection("fcm_tokens").get();
  const tokens = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.token) tokens.push({ id: doc.id, token: data.token });
  });
  return tokens;
}

// Helper: send notification to all devices
async function sendToAll(title, body, data) {
  const tokenDocs = await getAllTokens();
  if (tokenDocs.length === 0) return;

  const messaging = getMessaging();

  // Send to each token individually (handles failures gracefully)
  const results = await Promise.allSettled(
    tokenDocs.map(t =>
      messaging.send({
        token: t.token,
        notification: { title, body },
        data: data || {},
        webpush: {
          notification: {
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
            vibrate: [200, 100, 200],
            tag: data && data.tag ? data.tag : "pws-" + Date.now(),
            renotify: true,
            data: data || {}
          }
        }
      }).catch(err => {
        // If token is invalid, remove it
        if (
          err.code === "messaging/invalid-registration-token" ||
          err.code === "messaging/registration-token-not-registered"
        ) {
          console.log("Removing invalid token:", t.id);
          return db.collection("fcm_tokens").doc(t.id).delete();
        }
        console.error("FCM send error:", err.message);
      })
    )
  );

  console.log(`Sent to ${tokenDocs.length} devices, results:`, results.length);
}

// ==================== TRIGGERS ====================

// New assignment created
exports.onNewAssignment = onDocumentCreated("assignments/{docId}", async (event) => {
  const data = event.data.data();
  const workplace = data.workplace || "Lavoro";
  const date = data.date || "";

  // Format date nicely
  let dateLabel = date;
  if (date) {
    try {
      const d = new Date(date + "T00:00:00");
      dateLabel = d.toLocaleDateString("it-IT", {
        weekday: "long", day: "numeric", month: "long"
      });
    } catch (e) { /* keep raw */ }
  }

  await sendToAll(
    "📋 Nuovo Programma",
    `${workplace} — ${dateLabel}`,
    { page: "schedule", date: date, tag: "assignment-" + event.params.docId }
  );
});

// New availability request created
exports.onNewAvailability = onDocumentCreated("availabilities/{docId}", async (event) => {
  const data = event.data.data();
  const title = data.title || "Richiesta";
  const date = data.date || "";

  let dateLabel = date;
  if (date) {
    try {
      const d = new Date(date + "T00:00:00");
      dateLabel = d.toLocaleDateString("it-IT", {
        weekday: "long", day: "numeric", month: "long"
      });
    } catch (e) { /* keep raw */ }
  }

  await sendToAll(
    "🗓️ Nuova Disponibilità",
    `${title} — ${dateLabel}`,
    { page: "availabilities", tag: "avail-" + event.params.docId }
  );
});
