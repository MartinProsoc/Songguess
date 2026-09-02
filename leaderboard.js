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
// jobb játékos" mérőszám.
//
// KIZÁRÓLAG bejelentkezett (nem névtelen) fiókok kerülnek fel a ranglistára — vendégként a
// névtelen Firebase-azonosító böngészőhöz/eszközhöz kötött lenne, könnyen duplikálódna
// (töröld a böngészőadatokat, és máris "új" játékos lennél), és nem lenne mögötte a
// script.js-ben bevezetett, szűrt/kötelező felhasználónév sem. Ezt a szabályt a
// firestore.rules is kikényszeríti (nem csak a kliensoldali ellenőrzés).
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
const lbScopeWeekly = document.getElementById('leaderboard-scope-weekly');
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
// HETI RANGLISTA — ISO hét-azonosító
// ==========================================
// A "heti" ranglistához nem egy külön gyűjtemény kell, csak egy pillanatkép arról, mennyi
// XP-vel indult a játékos a JELENLEGI ISO-hét elején (weekStartXp) — a heti XP ennek és a
// mostani XP-nek a különbsége (weeklyXp), amit KÜLÖN mezőként tárolunk (nem számolt
// értékként), hogy a Firestore egyszerű orderBy-jal tudjon rendezni rá, összetett index
// nélkül. Amint egy új hét kezdődik, a weekId eltér a tárolttól, és a pillanatkép
// automatikusan újraindul.
function getIsoWeekId(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ==========================================
// RANGLISTA-BEJEGYZÉS FELTÖLTÉSE
// ==========================================
// A script.js saveProfile()-ja hívja meg, valahányszor változik a profil (tehát az XP is) —
// best-effort, a háttérben, a felhasználó semmit nem vesz észre belőle.
let lbPushInFlight = false;
async function pushLeaderboardEntry(profile) {
    if (typeof firebaseEnabled === 'undefined' || !firebaseEnabled || !firestoreDb) return;
    // Csak valódi (nem névtelen) fiókok kerülnek fel a ranglistára — vendégként/anonim
    // munkamenettel ez a függvény csendben nem csinál semmit.
    if (!currentUser || currentUser.isAnonymous) return;
    if (lbPushInFlight) return; // egyszerre csak egy feltöltés fusson
    lbPushInFlight = true;
    try {
        const countryCode = await detectCountryCode();
        const ref = firestoreDb.collection(LEADERBOARD_COLLECTION).doc(currentUser.uid);
        const existingSnap = await ref.get();
        const existing = existingSnap.exists ? existingSnap.data() : null;
        const weekId = getIsoWeekId(new Date());
        const xp = profile.xp || 0;
        // Ha ugyanabban a héten vagyunk, mint a tárolt pillanatkép, megtartjuk azt — különben
        // (új hét, vagy még sosem volt bejegyzés) a MOSTANI XP-től indul a heti számláló.
        const weekStartXp = (existing && existing.weekId === weekId && typeof existing.weekStartXp === 'number')
            ? existing.weekStartXp
            : xp;
        const weeklyXp = Math.max(0, xp - weekStartXp);

        await ref.set({
            username: profile.username || 'Játékos',
            xp,
            level: getLevelInfo(xp).level,
            countryCode: countryCode || null,
            weekId, weekStartXp, weeklyXp,
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
function renderLbRow(entry, rank, myUid, scoreField) {
    const isSelf = entry.id === myUid;
    const levelInfo = getLevelInfo(entry.xp || 0);
    const scoreValue = scoreField === 'weeklyXp' ? (entry.weeklyXp || 0) : (entry.xp || 0);
    return `<div class="lb-row${rank === 1 ? ' rank-1' : ''}${isSelf ? ' is-self' : ''}">
        <div class="lb-rank">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</div>
        <div class="lb-avatar">${escapeHtml(mpAvatarLetter(entry.username))}</div>
        <div class="lb-info">
            <div class="lb-name">${escapeHtml(entry.username || 'Játékos')}${isSelf ? ' (Te)' : ''}</div>
            <div class="lb-sub">${levelInfo.title.icon} ${levelInfo.level}. szint · ${levelInfo.title.title}</div>
        </div>
        <div class="lb-score">${scoreValue} XP</div>
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

    // Olvasáshoz elég egy névtelen munkamenet is (ez elégíti ki a Firestore-szabály "be van
    // jelentkezve" feltételét, hogy egyáltalán listázni lehessen a ranglistát) — de a
    // ranglistán MAGÁN csak valódi (nem névtelen) fiókok jelennek meg, lásd
    // pushLeaderboardEntry(). A "ez az én sorom" kiemeléshez ezért NEM ezt az esetleg
    // névtelen munkamenet-azonosítót használjuk, hanem kizárólag a valódi fiók uid-ját.
    const authUser = await ensureFirebaseUserForMultiplayer();
    if (!authUser) {
        lbStatusMsg.textContent = 'Nem sikerült kapcsolódni a Ranglistához. Ellenőrizd az internetkapcsolatot.';
        return;
    }
    const myUid = (currentUser && !currentUser.isAnonymous) ? currentUser.uid : null;

    try {
        let entries = [];
        let scoreField = 'xp';
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
        } else if (scope === 'weekly') {
            scoreField = 'weeklyXp';
            lbLocalHint.textContent = `📅 ${getIsoWeekId(new Date())} — ezen a héten szerzett XP alapján`;
            lbLocalHint.classList.remove('hidden');
            const snap = await firestoreDb.collection(LEADERBOARD_COLLECTION)
                .orderBy('weeklyXp', 'desc').limit(LB_PAGE_SIZE).get();
            entries = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
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
        lbList.innerHTML = top.map((entry, idx) => renderLbRow(entry, idx + 1, myUid, scoreField)).join('');

        const myIndex = myUid ? entries.findIndex(e => e.id === myUid) : -1;
        if (myIndex >= 0 && myIndex >= LB_PAGE_SIZE) {
            lbMyRow.innerHTML = renderLbRow(entries[myIndex], myIndex + 1, myUid, scoreField);
            lbMyRow.classList.remove('hidden');
        }
    } catch (e) {
        console.error(e);
        lbStatusMsg.textContent = 'Hiba történt a ranglista betöltésekor: ' + (e.message || e);
    }
}

function currentLbScope() {
    if (lbScopeWeekly && lbScopeWeekly.checked) return 'weekly';
    if (lbScopeLocal.checked) return 'local';
    return 'global';
}

if (goLeaderboardBtn) {
    goLeaderboardBtn.addEventListener('click', () => {
        showScreen(leaderboardScreen);
        loadLeaderboard(currentLbScope());
    });
    leaderboardBackBtn.addEventListener('click', () => { refreshHomeUI(); generateDynamicBackground(); showScreen(homeScreen); });
    lbScopeGlobal.addEventListener('change', () => { if (lbScopeGlobal.checked) loadLeaderboard('global'); });
    lbScopeLocal.addEventListener('change', () => { if (lbScopeLocal.checked) loadLeaderboard('local'); });
    if (lbScopeWeekly) {
        lbScopeWeekly.addEventListener('change', () => { if (lbScopeWeekly.checked) loadLeaderboard('weekly'); });
    }
}
