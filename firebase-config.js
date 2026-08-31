// ==========================================
// FIREBASE BEÁLLÍTÁSOK
// ==========================================
// Ezt a fájlt kell kitöltened a SAJÁT Firebase-projekted adataival.
// Honnan szerezd meg: Firebase Console → (a projekted) → ⚙️ Project settings
// → lent "Your apps" → a webapp ikonja → "firebaseConfig" objektum.
//
// Amíg ez placeholder ("IDE_MASOLD_BE") marad, a bejelentkezés/felhő-mentés
// funkció automatikusan kikapcsolt állapotban marad, a játék pedig simán
// tovább működik helyi (vendég) módban — semmi nem törik el emiatt.

const firebaseConfig = {
    apiKey: "AIzaSyBRf97dQLGgd5eSGcuedequB0udQV_nkoE",
    authDomain: "songguess-fb73d.firebaseapp.com",
    projectId: "songguess-fb73d",
    storageBucket: "songguess-fb73d.firebasestorage.app",
    messagingSenderId: "80553742438",
    appId: "1:80553742438:web:00be6858e38bf38cad1da7"
};

// Ne nyúlj hozzá az alábbi részhez — ez inicializálja a Firebase-t,
// ha a fenti adatok ki vannak töltve.
let firebaseEnabled = false;
let firebaseAuth = null;
let firestoreDb = null;

if (firebaseConfig.apiKey !== "IDE_MASOLD_BE") {
    try {
        firebase.initializeApp(firebaseConfig);
        firebaseAuth = firebase.auth();
        firestoreDb = firebase.firestore();
        firebaseEnabled = true;
    } catch (e) {
        console.warn("Firebase inicializálás sikertelen:", e);
    }
} else {
    console.info("Firebase nincs beállítva (firebase-config.js) — a játék vendég módban fut, fiók-funkció nélkül.");
}

// ==========================================
// MULTIPLAYER: anonim bejelentkezés
// ==========================================
// A Multiplayer (élő szoba / gyors játék) funkcióhoz minden felhasználónak — bejelentkezett
// fiókkal rendelkezőnek és vendégnek is — szüksége van egy Firebase Auth UID-ra, mert a
// Firestore biztonsági szabályok csak hitelesített felhasználóknak engedik a szoba-adatok
// olvasását/írását. Ha valaki nincs bejelentkezve saját fiókkal, ez a függvény "névtelen"
// (anonymous) Firebase-munkamenetet indít neki a háttérben — ehhez a Firebase Console-ban
// engedélyezni kell az "Anonymous" bejelentkezési szolgáltatót:
// Firebase Console → Authentication → Sign-in method → Anonymous → Enable.
//
// Ha a fiók-funkció (firebase-config.js) egyáltalán nincs beállítva, a Multiplayer sem tud
// működni, hiszen nincs felhő-adatbázis a szobák szinkronizálásához — ilyenkor ez a függvény
// null-lal tér vissza, a multiplayer.js pedig ezt jelzi is a felhasználónak.
async function ensureFirebaseUserForMultiplayer() {
    if (!firebaseEnabled || !firebaseAuth) return null;
    if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
    try {
        const result = await firebaseAuth.signInAnonymously();
        return result.user;
    } catch (e) {
        console.warn("Nem sikerült névtelen munkamenetet indítani a Multiplayerhez:", e);
        return null;
    }
}
