// ==========================================================
// SONGGUESS — RANGLISTA (globális + helyi/ország szerinti)
// ==========================================================
// Ez a fájl a script.js és a multiplayer.js UTÁN töltődik be, ezért szabadon használja az
// ott már definiált dolgokat: loadProfile(), getLevelInfo(), showScreen(), homeScreen,
// leaderboardScreen, refreshHomeUI(), generateDynamicBackground() (script.js), valamint
// escapeHtml(), mpAvatarLetter() (multiplayer.js). A Firebase-hez a firebase-config.js-ből:
// firebaseEnabled, firestoreDb, ensureFirebaseUserForMultiplayer().
//
// A "legjobb felhasználó" itt az összegyűjtött XP alapján dől el — ez már amúgy is a játék
// fő progressziós mércéje (profil / szint / rang rendszer), így ez a legkézenfekvőbb "ki a
// jobb játékos" mérőszám. Minden játékos bekerül a ranglistába — bejelentkezett fiókkal
// VAGY névtelen vendégként is —, ugyanazzal az anonim Firebase-azonosítóval, amit a
// Multiplayer is használ (ensureFirebaseUserForMultiplayer).
//
// FONTOS KORLÁT: mivel ennek az oldalnak nincs saját szervere (a kliens közvetlenül írja a
// Firestore-t), egy technikailag hozzáértő felhasználó a böngésző konzoljából elméletileg
// meghamisíthatná a saját XP-jét — ugyanez a korlát már eddig is fennállt a helyi/felhő
// profilnál, a ranglista csak láthatóbbá teszi. Egy teljesen csalásbiztos ranglistához
// szerver oldali (Cloud Function) érvényesítés kellene, ami túlmutat ennek a statikus
// oldalnak a keretein.
// ==========================================================

const LEADERBOARD_COLLECTION = 'leaderboard';
const LB_COUNTRY_CACHE_KEY = 'songuess_country_v1';
const LB_PAGE_SIZE = 50;

const goLeaderboardBtn = document.getElementById('go-leaderboard-btn');
const leaderboardBackBtn = document.getElementById('leaderboard-back-btn');
const lbScopeGlobal = document.getElementById('leaderboard-scope-global');
const lbScopeLocal = document.getElementById('leaderboard-scope-local');
const lbStatusMsg = document.getElementById('leaderboard-status-msg');
const lbLocalHint = document.getElementById('leaderboard-local-hint');
const lbList = document.getElementById('leaderboard-list');
const lbMyRow = document.getElementById('leaderboard-my-row');

// ==========================================
// ORSZÁG-MEGHATÁROZÁS (IP alapján, kulcs nélküli, CORS-barát szolgáltatással)
// ==========================================
// A "helyi" ranglistához tudnunk kell, melyik országból játszik valaki — ehhez nincs
// beépített böngésző-API (a nyelvi/időzóna-beállítás nem megbízható), ezért egy szabad,
// kulcs nélküli IP-geolokációs szolgáltatást hívunk meg. Az eredményt 30 napig gyorsítótárba
// tesszük, hogy ne kelljen minden ranglista-megnyitáskor újra lekérdezni.
async function detectCountryCode() {
    try {
        const cached = JSON.parse(localStorage.getItem(LB_COUNTRY_CACHE_KEY) || 'null');
        if (cached && cached.code && (Date.now() - cached.at) < 30 * 86400000) return cached.code;
    } catch (e) { /* no-op */ }
    try {
        const res = await fetch('https://get.geojs.io/v1/ip/country.json');
        const data = await res.json();
        const code = (data && data.country) || null;
        if (code) {
            try { localStorage.setItem(LB_COUNTRY_CACHE_KEY, JSON.stringify({ code, at: Date.now() })); } catch (e) { /* no-op */ }
        }
        return code;
    } catch (e) {
        return null;
    }
}

// ==========================================
// RANGLISTA-BEJEGYZÉS FELTÖLTÉSE
// ==========================================
// A script.js saveProfile()-ja hívja meg, valahányszor változik a profil (tehát az XP is) —
// best-effort, a háttérben, a felhasználó semmit nem vesz észre belőle.
let lbPushInFlight = false;
async function pushLeaderboardEntry(profile) {
    if (typeof firebaseEnabled === 'undefined' || !firebaseEnabled || !firestoreDb) return;
    if (lbPushInFlight) return; // egyszerre csak egy feltöltés fusson
    lbPushInFlight = true;
    try {
        const user = await ensureFirebaseUserForMultiplayer();
        if (!user) return;
        const countryCode = await detectCountryCode();
        await firestoreDb.collection(LEADERBOARD_COLLECTION).doc(user.uid).set({
            username: profile.username || 'Játékos',
            xp: profile.xp || 0,
            level: getLevelInfo(profile.xp || 0).level,
            countryCode: countryCode || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.warn('Nem sikerült frissíteni a ranglista-bejegyzést:', e);
    }
    lbPushInFlight = false;
}

// ==========================================
// MEGJELENÍTÉS
// ==========================================
function renderLbRow(entry, rank, myUid) {
    const isSelf = entry.id === myUid;
    const levelInfo = getLevelInfo(entry.xp || 0);
    return `<div class="lb-row${rank === 1 ? ' rank-1' : ''}${isSelf ? ' is-self' : ''}">
        <div class="lb-rank">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</div>
        <div class="lb-avatar">${escapeHtml(mpAvatarLetter(entry.username))}</div>
        <div class="lb-info">
            <div class="lb-name">${escapeHtml(entry.username || 'Játékos')}${isSelf ? ' (Te)' : ''}</div>
            <div class="lb-sub">${levelInfo.title.icon} ${levelInfo.level}. szint · ${levelInfo.title.title}</div>
        </div>
        <div class="lb-score">${entry.xp || 0} XP</div>
    </div>`;
}

async function loadLeaderboard(scope) {
    lbList.innerHTML = '';
    lbMyRow.classList.add('hidden');
    lbLocalHint.classList.add('hidden');
    lbStatusMsg.textContent = '⏳ Betöltés...';

    if (typeof firebaseEnabled === 'undefined' || !firebaseEnabled || !firestoreDb) {
        lbStatusMsg.textContent = 'A Ranglista még nincs beállítva ezen az oldalon (firebase-config.js).';
        return;
    }

    const user = await ensureFirebaseUserForMultiplayer();
    if (!user) {
        lbStatusMsg.textContent = 'Nem sikerült kapcsolódni a Ranglistához. Ellenőrizd az internetkapcsolatot.';
        return;
    }

    try {
        let entries = [];
        if (scope === 'local') {
            const countryCode = await detectCountryCode();
            if (!countryCode) {
                lbStatusMsg.textContent = 'Nem sikerült megállapítani, melyik országból játszol — próbáld a Globális nézetet.';
                return;
            }
            lbLocalHint.textContent = `📍 ${countryCode} — a Te országodból induló játékosok`;
            lbLocalHint.classList.remove('hidden');
            // Egyenlőség-szűrésnél (countryCode ==) szándékosan NEM használunk orderBy-t —
            // az Firestore-ban egy manuálisan létrehozandó composite indexet igényelne. A
            // rendezést ehelyett kliens oldalon végezzük a (max 300-as) letöltött listán.
            const snap = await firestoreDb.collection(LEADERBOARD_COLLECTION)
                .where('countryCode', '==', countryCode).limit(300).get();
            entries = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
            entries.sort((a, b) => (b.xp || 0) - (a.xp || 0));
        } else {
            const snap = await firestoreDb.collection(LEADERBOARD_COLLECTION)
                .orderBy('xp', 'desc').limit(LB_PAGE_SIZE).get();
            entries = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        }

        if (entries.length === 0) {
            lbStatusMsg.textContent = 'Még nincs elég adat ehhez a ranglistához.';
            return;
        }
        lbStatusMsg.textContent = '';

        const top = entries.slice(0, LB_PAGE_SIZE);
        lbList.innerHTML = top.map((entry, idx) => renderLbRow(entry, idx + 1, user.uid)).join('');

        const myIndex = entries.findIndex(e => e.id === user.uid);
        if (myIndex >= 0 && myIndex >= LB_PAGE_SIZE) {
            lbMyRow.innerHTML = renderLbRow(entries[myIndex], myIndex + 1, user.uid);
            lbMyRow.classList.remove('hidden');
        }
    } catch (e) {
        console.error(e);
        lbStatusMsg.textContent = 'Hiba történt a ranglista betöltésekor: ' + (e.message || e);
    }
}

function currentLbScope() { return lbScopeLocal.checked ? 'local' : 'global'; }

if (goLeaderboardBtn) {
    goLeaderboardBtn.addEventListener('click', () => {
        showScreen(leaderboardScreen);
        loadLeaderboard(currentLbScope());
    });
    leaderboardBackBtn.addEventListener('click', () => { refreshHomeUI(); generateDynamicBackground(); showScreen(homeScreen); });
    lbScopeGlobal.addEventListener('change', () => { if (lbScopeGlobal.checked) loadLeaderboard('global'); });
    lbScopeLocal.addEventListener('change', () => { if (lbScopeLocal.checked) loadLeaderboard('local'); });
}
