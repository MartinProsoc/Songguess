// ==========================================================
// SONGGUESS — MULTIPLAYER
// ==========================================================
// Ez a fájl a script.js UTÁN töltődik be, ezért ugyanabban a globális
// scope-ban fut, és szabadon használja a script.js-ben már definiált
// dolgokat: CATEGORY_TERMS, CATEGORY_LABELS, fallbackImg, shuffleArray(),
// getRandomSongFromiTunes(), getDistractorOptions(), searchiTunes(),
// loadProfile(), saveProfile(), getLevelInfo(), xpForRound(),
// checkAndAwardBadges(), roundEmoji(), copyToClipboard(), formatTime(),
// valamint a Firebase-hez a firebase-config.js-ből: firebaseEnabled,
// firebaseAuth, firestoreDb, ensureFirebaseUserForMultiplayer().
//
// Két játékmódot kínál:
//   1) Kódos szoba — a gazda létrehoz egy szobát, kap egy 6 jegyű kódot,
//      amit elküldhet a barátainak, ők a kóddal csatlakoznak.
//   2) Gyors játék — azonnal beültet egy nyitott, várakozó, nyilvános
//      szobába, vagy ha nincs egy sem, nyit egyet és arra vár, hogy
//      mások is csatlakozzanak.
//
// A szinkronizálás Firestore-on keresztül történik (nincs saját szerver):
// a "rooms/{kód}" dokumentum tárolja a beállításokat, a kör-állapotot és
// (indításkor legenerálva) az adott menethez tartozó számokat, hogy minden
// játékos garantáltan ugyanazt hallja. A kör-léptetést a szoba gazdájának
// kliense vezényli: amint mindenki végzett az aktuális körrel (vagy lejár
// egy biztonsági időkorlát), a gazda lépteti a következő körre — így nincs
// szükség szerver oldali logikára (Cloud Function) a menet lebonyolításához.
// ==========================================================

// ==========================================
// 0. SEGÉDFÜGGVÉNYEK
// ==========================================
function mpShowScreen(el) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function mpAvatarLetter(name) {
    const trimmed = (name || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // I, L, O, 0, 1 kihagyva (könnyen összekeverhetők)
function generateRoomCodeCandidate() {
    let code = '';
    for (let i = 0; i < 6; i++) code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
    return code;
}

const MP_TIME_INTERVALS = [0.5, 1, 2, 4, 8, 15];

const MP_MODE_LABELS = { classic: '✍️ Gépeld be', choice: '🔘 Feleletválasztós' };
function mpTimeLimitLabel(v) { return v > 0 ? `${v} mp` : 'Nincs időkorlát'; }

// A meghívó-link a jelenlegi oldal URL-jéből (protokoll+host+útvonal) épül fel, a szoba kódját
// egy "?room=KÓD" query paraméterben hordozva. Ha valaki megnyitja ezt a linket, az oldal
// betöltésekor (lásd a fájl végén a "LINK ALAPÚ MEGHÍVÁS" szakaszt) automatikusan megpróbál
// csatlakozni ehhez a szobához.
function buildRoomInviteLink(code) {
    return `${location.origin}${location.pathname}?room=${encodeURIComponent(code)}`;
}

// ==========================================
// 1. DOM ELEMEK
// ==========================================
const mpEntryScreen = document.getElementById('mp-entry-screen');
const mpSetupScreen = document.getElementById('mp-setup-screen');
const mpLobbyScreen = document.getElementById('mp-lobby-screen');
const mpGameScreen = document.getElementById('mp-game-screen');
const mpResultsScreen = document.getElementById('mp-results-screen');

const goMultiplayerBtn = document.getElementById('go-multiplayer-btn');
const mpEntryBackBtn = document.getElementById('mp-entry-back-btn');
const mpQuickplayBtn = document.getElementById('mp-quickplay-btn');
const mpCreateRoomBtn = document.getElementById('mp-create-room-btn');
const mpJoinCodeInput = document.getElementById('mp-join-code-input');
const mpJoinRoomBtn = document.getElementById('mp-join-room-btn');
const mpEntryErrorMsg = document.getElementById('mp-entry-error-msg');

const mpSetupBackBtn = document.getElementById('mp-setup-back-btn');
const mpUsernameInput = document.getElementById('mp-username-input');
const mpCategoryChipGrid = document.getElementById('mp-category-chip-grid');
const mpSelectedCategories = new Set(['all']);
renderCategoryChips(mpCategoryChipGrid, mpSelectedCategories);
const mpRoundsInput = document.getElementById('mp-rounds-input');
const mpTimeLimitInput = document.getElementById('mp-time-limit-input');
const mpMaxPlayersInput = document.getElementById('mp-maxplayers-input');
const mpHardcoreInput = document.getElementById('mp-hardcore-input');
const mpCreateConfirmBtn = document.getElementById('mp-create-confirm-btn');
const mpSetupErrorMsg = document.getElementById('mp-setup-error-msg');

const mpLobbyLeaveBtn = document.getElementById('mp-lobby-leave-btn');
const mpCodeDisplay = document.getElementById('mp-code-display');
const mpCopyCodeBtn = document.getElementById('mp-copy-code-btn');
const mpCopyLinkBtn = document.getElementById('mp-copy-link-btn');
const mpLobbySettingsSummary = document.getElementById('mp-lobby-settings-summary');
const mpPlayerCountEl = document.getElementById('mp-player-count');
const mpPlayerMaxEl = document.getElementById('mp-player-max');
const mpPlayerListEl = document.getElementById('mp-player-list');
const mpReadyBtn = document.getElementById('mp-ready-btn');
const mpStartBtn = document.getElementById('mp-start-btn');
const mpLobbyHint = document.getElementById('mp-lobby-hint');
const mpLobbyErrorMsg = document.getElementById('mp-lobby-error-msg');

const mpGameLeaveBtn = document.getElementById('mp-game-leave-btn');
const mpRoundCounterDisplay = document.getElementById('mp-round-counter-display');
const mpCountdownDisplay = document.getElementById('mp-countdown-display');
const mpLiveLeaderboard = document.getElementById('mp-live-leaderboard');
const mpStreakDisplay = document.getElementById('mp-streak-display');
const mpHardcoreBadge = document.getElementById('mp-hardcore-badge');
const mpAudioPlayer = document.getElementById('mp-audio-player');
const mpCassette = document.getElementById('mp-cassette-visualizer');
const mpAudioProgressFill = document.getElementById('mp-audio-progress-fill');
const mpTimeDisplay = document.getElementById('mp-time-display');
const mpClassicInputArea = document.getElementById('mp-classic-input-area');
const mpChoiceInputArea = document.getElementById('mp-choice-input-area');
const mpGuessInput = document.getElementById('mp-guess-input');
const mpAutocompleteList = document.getElementById('mp-autocomplete-list');
const mpSkipBtn = document.getElementById('mp-skip-btn');
const mpPlayBtn = document.getElementById('mp-play-btn');
const mpSubmitBtn = document.getElementById('mp-submit-btn');
const mpMessageDisplay = document.getElementById('mp-message-display');
const mpWaitingArea = document.getElementById('mp-waiting-area');
const mpWaitingList = document.getElementById('mp-waiting-list');

const mpFinalLeaderboard = document.getElementById('mp-final-leaderboard');
const mpResultsSkipKingEl = document.getElementById('mp-results-skip-king');
const mpResultsXp = document.getElementById('mp-results-xp');
const mpResultsRematchBtn = document.getElementById('mp-results-rematch-btn');
const mpResultsHomeBtn = document.getElementById('mp-results-home-btn');

// ==========================================
// 2. ÁLLAPOT
// ==========================================
let mpRoomCode = null;
let mpRoomRef = null;
let mpPlayerRef = null;
let mpIsHost = false;
let mpUnsubRoom = null;
let mpUnsubPlayers = null;
let mpWatchdog = null;
let mpRoomData = null;
let mpPlayersCache = new Map(); // uid -> player data (mindig tartalmazza az 'id' mezőt is)
let mpLocalRound = 0;           // az utoljára ténylegesen elindított kör száma
let mpLocalRoundStartedAt = 0;  // mikor indult nálunk (helyi óra szerint) az aktuális kör
let mpLastSeenGameKey = null;   // melyik menethez tartozik a jelenlegi helyi állapotunk
let mpResultsProcessedKey = null;

let mpCurrentSong = null;
let mpCorrectAnswerFull = '';
let mpCurrentStep = 0;
let mpChoiceLocked = false;
let mpRoundFinished = false;
let mpIsPlaying = false;
let mpCountdownInterval = null;
let mpRemainingTime = 0;
let mpTypingTimer = null;

let mpMyScore = 0;
let mpMyStreak = 0;
let mpMyMaxStreak = 0;
let mpMyRoundResults = [];
let mpRoundUsedSkip = false;   // ebben a körben nyomott-e Kihagyást (script.js Kihagyás-büntetőrendszere)
let mpSessionSkipCount = 0;    // hány Kihagyás történt EBBEN a menetben (cooldown-hoz)
let mpSkipCooldownToken = 0;   // új kör indulásakor érvényteleníti a folyamatban lévő cooldown-visszaszámlálót
let mpMySkipsUsed = 0;         // összes Kihagyás EBBEN a menetben (a "Kihagyás Király" végjáték-címkéhez)

// ==========================================
// 2/b. JELENLÉT ("ki van még tényleg a szobában?")
// ==========================================
// Egy böngészőfül bezárása / lefagyása után a játékos "players" dokumentuma bent
// ragadna a szobában, és a szoba örökre várna rá (nem lépne kört, nem lehetne indítani,
// a gyorsjáték pedig újra meg újra beültetne ebbe a halott szobába — pont ez okozta,
// hogy a gyorsjáték kódja nem változott, és senki nem volt gazda). Ezért minden kliens
// rendszeresen frissíti a saját "lastSeen" bélyegét: akinek ez elavult, azt kilépettnek
// tekintjük, és a gazda szerepét / a szoba sorsát eszerint rendezzük.
const MP_PRESENCE_STALE_MS = 45000;   // ennyi némaság után tekintünk valakit eltűntnek
const MP_PRESENCE_PING_MS = 8000;     // ilyen sűrűn jelezzük, hogy még itt vagyunk
const MP_ROOM_GC_STALE_MS = 120000;   // ennyi után takarítható el egy magára maradt szoba
// A gazda leváltásához szándékosan hosszabb türelmi idő tartozik, mint a sima
// "eltűnt-e valaki" vizsgálathoz — a firestore.rules is 60 másodperctől engedi az
// átvételt, és ha a kliens ennél korábban próbálkozna, a szabály visszautasítaná.
const MP_HOST_TAKEOVER_STALE_MS = 65000;

// A "lastSeen" szerver-időbélyeg, a Date.now() viszont a kliens órája — egy elállított
// gépen a kettő percekkel is eltérhet, és akkor vagy mindenkit halottnak, vagy mindenkit
// örökké élőnek látnánk. Ezért a saját jelenlét-írásunk visszaolvasásából megbecsüljük az
// eltérést, és mindig ezzel korrigált "szerver-idővel" számolunk.
let mpClockSkewMs = 0;
let mpLastPresenceWriteAt = 0;

function mpMyUid() { return (firebaseAuth && firebaseAuth.currentUser) ? firebaseAuth.currentUser.uid : null; }
function mpServerNow() { return Date.now() + mpClockSkewMs; }
function mpTsMillis(ts) { return (ts && typeof ts.toMillis === 'function') ? ts.toMillis() : null; }

function mpPlayerIsLive(p, treatSelfAsLive = true, staleMs = MP_PRESENCE_STALE_MS) {
    if (!p) return false;
    if (treatSelfAsLive && p.id && p.id === mpMyUid()) return true;
    const seen = mpTsMillis(p.lastSeen);
    if (seen !== null) return (mpServerNow() - seen) < staleMs;
    // Nincs (még) lastSeen: vagy régebbi kliens, vagy épp most csatlakozott és a
    // szerver-időbélyeg még függőben van — a csatlakozás ideje alapján adunk türelmi időt.
    const joined = mpTsMillis(p.joinedAt);
    if (joined === null) return true;
    return (mpServerNow() - joined) < staleMs;
}

function mpLivePlayers() {
    return Array.from(mpPlayersCache.values()).filter(p => mpPlayerIsLive(p));
}

// Szoba TÖRLÉSÉHEZ ennél szigorúbb bizonyíték kell, mint a sima "élő-e még" vizsgálathoz:
// csak arról jelentjük ki, hogy biztosan elment, akinek VAN jelenlét-bélyege, és az elavult.
// Akinek egyáltalán nincs lastSeen mezője (mert még a régi kliensverziót futtatja), azt
// sosem tekintjük eltűntnek — inkább maradjon ott egy fölösleges szoba, mint hogy egy élő
// váróterem eltűnjön az ott ülők alól.
function mpPlayerIsDefinitelyGone(p, staleMs) {
    const seen = mpTsMillis(p && p.lastSeen);
    if (seen === null) return false;
    return (mpServerNow() - seen) >= staleMs;
}

// Ki legyen a következő gazda? Mindig ugyanaz a sorrend minden kliensen (belépési idő,
// döntetlennél az uid), így nem fordulhat elő, hogy ketten egyszerre vegyék át a szerepet.
function mpHostSuccessor(players) {
    const sorted = players.slice().sort((a, b) => {
        const ja = mpTsMillis(a.joinedAt);
        const jb = mpTsMillis(b.joinedAt);
        const A = ja === null ? Number.MAX_SAFE_INTEGER : ja;
        const B = jb === null ? Number.MAX_SAFE_INTEGER : jb;
        if (A !== B) return A - B;
        return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
    return sorted[0] || null;
}

function mpHostIsGone(staleMs = MP_PRESENCE_STALE_MS) {
    if (!mpRoomData || !mpRoomData.hostUid) return true;
    const host = mpPlayersCache.get(mpRoomData.hostUid);
    return !mpPlayerIsLive(host, true, staleMs);
}

function touchMpPresence() {
    if (!mpPlayerRef) return;
    mpLastPresenceWriteAt = Date.now();
    mpPlayerRef.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
}

function mpNewPlayerDoc(name, ready) {
    return {
        name,
        ready: !!ready,
        score: 0, streak: 0, maxStreak: 0, skipsUsed: 0,
        roundsCompleted: 0, roundResults: [],
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    };
}

// A menet azonosítója. FONTOS, hogy ez egy sima (kliens által generált) szöveg legyen, ne
// szerver-időbélyeg: a szerver-időbélyeg ugyanis a saját írásunk visszajelzéséig "null"-ként
// látszik a helyi pillanatképben, és csak másodpercekkel később válik valódi értékké — ez a
// késleltetett váltás okozta, hogy a gazda kliense az első kör KÖZBEN indított új menetet
// érzékelt, és lenullázta a saját, már beküldött köreredményét (lásd resetMyStatsForNewGame).
function generateGameId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
function mpGameKey() {
    if (!mpRoomData) return null;
    return mpRoomData.gameId || ('t' + mpTsMillis(mpRoomData.startedAt));
}

// ==========================================
// 3. FIREBASE-KÉSZENLÉT
// ==========================================
async function requireMultiplayerReady(errorEl) {
    if (typeof firebaseEnabled === 'undefined' || !firebaseEnabled || !firestoreDb) {
        if (errorEl) errorEl.textContent = 'A Multiplayer még nincs beállítva ezen az oldalon (töltsd ki a firebase-config.js-t, és engedélyezd az "Anonymous" bejelentkezést a Firebase Console-ban).';
        return null;
    }
    const user = await ensureFirebaseUserForMultiplayer();
    if (!user) {
        if (errorEl) errorEl.textContent = 'Nem sikerült kapcsolódni a Multiplayer szolgáltatáshoz. Ellenőrizd az internetkapcsolatot, és hogy az "Anonymous" bejelentkezés engedélyezve van-e a Firebase projektben.';
        return null;
    }
    return user;
}

// Szoba létrehozásakor a gazda kifejezetten látja és szerkesztheti a mp-setup-screen
// felhasználónév-mezőjét, ezért az a mérvadó. Csatlakozásnál / gyorsjátéknál viszont ezt a
// mezőt a felhasználó soha nem is látja, ott a mentett profilnév a helyes forrás.
function hostDisplayNameFromSetup() {
    return (mpUsernameInput && mpUsernameInput.value.trim()) || loadProfile().username || 'Játékos';
}
function currentMpDisplayName() {
    return loadProfile().username || 'Játékos';
}

// ==========================================
// 4. NAVIGÁCIÓ
// ==========================================
goMultiplayerBtn.addEventListener('click', () => {
    mpEntryErrorMsg.textContent = '';
    mpJoinCodeInput.value = '';
    mpShowScreen(mpEntryScreen);
});
mpEntryBackBtn.addEventListener('click', () => { refreshHomeUI(); generateDynamicBackground(); mpShowScreen(homeScreen); });
mpSetupBackBtn.addEventListener('click', () => mpShowScreen(mpEntryScreen));

mpCreateRoomBtn.addEventListener('click', () => {
    mpSetupErrorMsg.textContent = '';
    const profile = loadProfile();
    mpUsernameInput.value = profile.username || 'Játékos';
    mpShowScreen(mpSetupScreen);
});

// ==========================================
// 5. SZOBA LÉTREHOZÁSA
// ==========================================
mpCreateConfirmBtn.addEventListener('click', async () => {
    mpSetupErrorMsg.textContent = '';
    mpCreateConfirmBtn.disabled = true;
    try {
        const user = await requireMultiplayerReady(mpSetupErrorMsg);
        if (!user) { mpCreateConfirmBtn.disabled = false; return; }

        const config = {
            category: Array.from(mpSelectedCategories),
            mode: document.querySelector('input[name="mp-game-mode"]:checked').value,
            rounds: Math.min(15, Math.max(1, parseInt(mpRoundsInput.value) || 5)),
            timeLimit: parseInt(mpTimeLimitInput.value) || 0,
            hardcore: mpHardcoreInput.checked,
            maxPlayers: parseInt(mpMaxPlayersInput.value) || 4
        };
        const name = hostDisplayNameFromSetup();

        // Egyedi, még nem foglalt kód keresése (pár próbálkozás bőven elég egy 6 jegyű,
        // ~30^6 lehetőséget rejtő kódtérben).
        let code = null;
        for (let attempt = 0; attempt < 6; attempt++) {
            const candidate = generateRoomCodeCandidate();
            const existing = await firestoreDb.collection('rooms').doc(candidate).get();
            if (!existing.exists) { code = candidate; break; }
        }
        if (!code) throw new Error('Nem sikerült egyedi szobakódot generálni, próbáld újra.');

        await firestoreDb.collection('rooms').doc(code).set({
            code,
            hostUid: user.uid,
            hostName: name,
            isQuick: false,
            status: 'waiting',
            config,
            currentRound: 0,
            songs: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await firestoreDb.collection('rooms').doc(code).collection('players').doc(user.uid).set(mpNewPlayerDoc(name, true));

        enterRoom(code, true);
    } catch (e) {
        console.error(e);
        mpSetupErrorMsg.textContent = 'Hiba történt a szoba létrehozásakor: ' + (e.message || e);
    }
    mpCreateConfirmBtn.disabled = false;
});

// ==========================================
// 6. CSATLAKOZÁS KÓDDAL
// ==========================================
mpJoinRoomBtn.addEventListener('click', async () => {
    mpEntryErrorMsg.textContent = '';
    const code = mpJoinCodeInput.value.trim().toUpperCase();
    if (!code) { mpEntryErrorMsg.textContent = 'Add meg a szoba kódját.'; return; }

    mpJoinRoomBtn.disabled = true;
    try {
        const user = await requireMultiplayerReady(mpEntryErrorMsg);
        if (!user) { mpJoinRoomBtn.disabled = false; return; }
        await joinRoomByCode(code, user, mpEntryErrorMsg);
    } catch (e) {
        console.error(e);
        mpEntryErrorMsg.textContent = 'Hiba történt a csatlakozáskor: ' + (e.message || e);
    }
    mpJoinRoomBtn.disabled = false;
});

async function joinRoomByCode(code, user, errorEl) {
    const roomSnap = await firestoreDb.collection('rooms').doc(code).get();
    if (!roomSnap.exists) { errorEl.textContent = 'Nincs ilyen kódú szoba.'; return false; }
    const room = roomSnap.data();

    const myExisting = await firestoreDb.collection('rooms').doc(code).collection('players').doc(user.uid).get();
    if (!myExisting.exists) {
        if (room.status !== 'waiting') { errorEl.textContent = 'Ez a szoba már elindult vagy már véget ért.'; return false; }
        // A férőhelyszámításnál csak az élő játékosok számítanak: a bezárt fülek után
        // bent ragadt "szellem" dokumentumok különben feleslegesen tömítenék a szobát.
        const live = await fetchLivePlayers(firestoreDb.collection('rooms').doc(code));
        if (live.length >= (room.config?.maxPlayers || 99)) { errorEl.textContent = 'Megtelt ez a szoba.'; return false; }

        const name = currentMpDisplayName();
        await firestoreDb.collection('rooms').doc(code).collection('players').doc(user.uid).set(mpNewPlayerDoc(name, false));
    }

    enterRoom(code, room.hostUid === user.uid);
    return true;
}

// A szoba játékosainak lekérdezése + szűrése azokra, akik tényleg jelen vannak.
// (Belépés előtt még nincs onSnapshot-feliratkozásunk, ezért kell az egyszeri lekérés.)
async function fetchLivePlayers(roomRef) {
    const snap = await roomRef.collection('players').get();
    const players = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    return players.filter(p => mpPlayerIsLive(p));
}

// ==========================================
// 7. GYORS JÁTÉK
// ==========================================
mpQuickplayBtn.addEventListener('click', async () => {
    mpEntryErrorMsg.textContent = '';
    mpQuickplayBtn.disabled = true;
    mpQuickplayBtn.textContent = '🔎 Keresés...';
    try {
        const user = await requireMultiplayerReady(mpEntryErrorMsg);
        if (!user) { resetQuickplayBtn(); return; }

        // Több '==' feltétel Firestore-ban rendezés (orderBy) nélkül nem igényel
        // manuális composite indexet, ezért nem használunk itt orderBy-t.
        const candidates = await firestoreDb.collection('rooms')
            .where('isQuick', '==', true)
            .where('status', '==', 'waiting')
            .limit(10)
            .get();

        let joined = false;
        for (const doc of candidates.docs) {
            const room = doc.data();

            const playersSnap = await doc.ref.collection('players').get();
            const allPlayers = playersSnap.docs.map(d => Object.assign({ id: d.id }, d.data()));

            // 1) Kihalt szoba? Takarítsuk el. Ha valaki bezárta a fület (nem a "Kilépés"
            //    gombbal ment ki), a szoba dokumentuma bent maradt az adatbázisban — és a
            //    gyorsjáték újra meg újra ebbe ültetett be mindenkit: ugyanaz a szobakód,
            //    gazda nélkül, tehát senki nem tudta elindítani a játékot. Fontos, hogy a
            //    saját magunkra vonatkozó kivételt itt NEM alkalmazzuk (mpPlayerIsLive
            //    második paramétere), különben a mi saját, ott ragadt szellem-dokumentumunk
            //    tartaná életben örökre a halott szobát.
            const roomIsDead = allPlayers.length === 0
                || allPlayers.every(p => mpPlayerIsDefinitelyGone(p, MP_ROOM_GC_STALE_MS));
            if (roomIsDead) {
                await doc.ref.delete().catch(() => {});
                continue;
            }

            // 2) A saját, korábbi szobánkba ne ültessük vissza magunkat.
            if (room.hostUid === user.uid) continue;

            // 3) Haldokló szoba: már senki nem jelentkezett be az utóbbi percben, de a
            //    törléshez még nem járt le a türelmi idő. Ne szálljunk be — inkább nyitunk
            //    egy vadonatúj szobát, és ezt egy későbbi keresés takarítja el.
            const live = allPlayers.filter(p => mpPlayerIsLive(p, false));
            if (live.length === 0) continue;

            // 4) Csak az élő játékosok foglalnak helyet.
            if (live.length >= (room.config?.maxPlayers || 6)) continue;

            const name = currentMpDisplayName();
            await doc.ref.collection('players').doc(user.uid).set(mpNewPlayerDoc(name, false));
            enterRoom(doc.id, room.hostUid === user.uid);
            joined = true;
            break;
        }

        if (!joined) {
            // Nincs elérhető nyitott szoba — nyitunk egy újat (mindig FRISS kóddal),
            // alapértelmezett beállításokkal, és várunk, amíg mások is csatlakoznak
            // (vagy magad indítod el kevesebb fővel).
            const config = { category: ['all'], mode: 'classic', rounds: 5, timeLimit: 30, hardcore: false, maxPlayers: 6 };
            const name = currentMpDisplayName();
            let code = null;
            for (let attempt = 0; attempt < 6; attempt++) {
                const candidate = generateRoomCodeCandidate();
                const existing = await firestoreDb.collection('rooms').doc(candidate).get();
                if (!existing.exists) { code = candidate; break; }
            }
            if (!code) throw new Error('Nem sikerült szobát nyitni, próbáld újra.');

            await firestoreDb.collection('rooms').doc(code).set({
                code, hostUid: user.uid, hostName: name, isQuick: true, status: 'waiting',
                config, currentRound: 0, songs: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await firestoreDb.collection('rooms').doc(code).collection('players').doc(user.uid).set(mpNewPlayerDoc(name, true));
            enterRoom(code, true);
        }
    } catch (e) {
        console.error(e);
        mpEntryErrorMsg.textContent = 'Hiba történt a gyors játék keresésekor: ' + (e.message || e);
    }
    resetQuickplayBtn();
});
function resetQuickplayBtn() { mpQuickplayBtn.disabled = false; mpQuickplayBtn.textContent = '⚡ Gyors játék'; }

// ==========================================
// 8. SZOBÁBA LÉPÉS / LISTENEREK FELIRATKOZÁSA
// ==========================================
function enterRoom(code, isHost) {
    mpRoomCode = code;
    mpIsHost = isHost;
    mpRoomRef = firestoreDb.collection('rooms').doc(code);
    mpPlayerRef = mpRoomRef.collection('players').doc(firebaseAuth.currentUser.uid);
    mpLastSeenGameKey = null;
    mpResultsProcessedKey = null;
    mpLocalRound = 0;
    mpLocalRoundStartedAt = 0;
    mpAdvancingRound = 0;
    mpHostClaimAt = 0;

    detachMpListeners();
    mpUnsubRoom = mpRoomRef.onSnapshot(handleRoomSnapshot, (err) => console.warn('Szoba figyelési hiba:', err));
    mpUnsubPlayers = mpRoomRef.collection('players').onSnapshot(handlePlayersSnapshot, (err) => console.warn('Játékosok figyelési hiba:', err));
    startMpHeartbeat();
    startMpWatchdog();

    mpShowScreen(mpLobbyScreen);
}

function detachMpListeners() {
    if (mpUnsubRoom) { mpUnsubRoom(); mpUnsubRoom = null; }
    if (mpUnsubPlayers) { mpUnsubPlayers(); mpUnsubPlayers = null; }
    if (mpWatchdog) { clearInterval(mpWatchdog); mpWatchdog = null; }
    stopMpHeartbeat();
}

// A valós idejű Firestore-kapcsolat (onSnapshot) egyes mobil böngészőkön háttérbe kerüléskor,
// akkumulátorkímélő módban vagy ingadozó hálózaton időlegesen felfüggesztődhet — ilyenkor a
// kliens nem kapja meg azonnal pl. a "elindult a játék" frissítést, és a váróteremben ragad,
// míg a többiek már a menetben vannak. Ez ellen két biztonsági háló van:
//   1) egy ~4 másodperces "szívverés", ami manuálisan is újralekérdezi a szoba állapotát,
//   2) amint az oldal újra láthatóvá válik (visszaváltasz a fülre/appra), azonnali frissítés.
// Ugyanez a szívverés viszi a saját jelenlét-bélyegünket (lastSeen) is, amiből a többiek
// látják, hogy még a szobában vagyunk — ez alapján megy a gazda-átadás és a kihalt szobák
// takarítása.
let mpHeartbeatInterval = null;
let mpHeartbeatTick = 0;
function startMpHeartbeat() {
    if (mpHeartbeatInterval) return;
    mpHeartbeatTick = 0;
    touchMpPresence();
    mpHeartbeatInterval = setInterval(() => {
        if (mpRoomRef) mpRoomRef.get().then(handleRoomSnapshot).catch(() => {});
        if (mpRoomRef) mpRoomRef.collection('players').get().then(handlePlayersSnapshot).catch(() => {});
        // 4 mp-enként frissítünk, de jelenlétet csak minden második körben írunk (≈8 mp),
        // hogy ne terheljük feleslegesen írásokkal a Firestore-t.
        if ((mpHeartbeatTick++ % Math.round(MP_PRESENCE_PING_MS / 4000)) === 0) touchMpPresence();
    }, 4000);
}
function stopMpHeartbeat() {
    if (mpHeartbeatInterval) { clearInterval(mpHeartbeatInterval); mpHeartbeatInterval = null; }
}
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && mpRoomRef) {
        touchMpPresence();
        mpRoomRef.get().then(handleRoomSnapshot).catch(() => {});
        mpRoomRef.collection('players').get().then(handlePlayersSnapshot).catch(() => {});
    }
});

// Ha valaki egyszerűen bezárja a fület (nem a "Kilépés" gombbal megy ki), próbáljuk meg
// azonnal kivenni a szobából. Ez a kérés nem mindig ér célba (a böngésző bármikor
// elvághatja a lap bezárásakor), ezért NEM támaszkodunk rá: a lastSeen elavulása a
// tényleges biztonsági háló, ez csak felgyorsítja a dolgot.
//
// A persisted === true eset KIMARAD: ilyenkor a lap csak a böngésző vissza-gombos
// gyorsítótárába (bfcache) került — iOS Safariban ez teljesen hétköznapi —, és bármikor
// visszatérhet. Ott nem szabad kirakni a játékost a szobából.
window.addEventListener('pagehide', (e) => {
    if (e.persisted) return;
    if (mpRoomRef) leaveMpRoom();
});

function handleRoomSnapshot(snap) {
    if (!snap.exists) {
        if (mpRoomCode) {
            const wasHost = mpIsHost;
            cleanupMpLocalState();
            mpShowScreen(mpEntryScreen);
            mpEntryErrorMsg.textContent = wasHost ? '' : 'A szoba gazdája bezárta a szobát.';
        }
        return;
    }
    mpRoomData = snap.data();
    // A gazda szerepe menet közben is átszállhat (ha a régi gazda kilép vagy eltűnik),
    // ezért mindig a szoba dokumentuma a mérvadó, nem a belépéskori feltételezés.
    mpIsHost = !!(mpRoomData.hostUid && mpRoomData.hostUid === mpMyUid());

    if (mpRoomData.status === 'waiting') {
        renderLobby();
        if (!mpGameScreen.classList.contains('active') && !mpResultsScreen.classList.contains('active')) {
            mpShowScreen(mpLobbyScreen);
        }
    } else if (mpRoomData.status === 'starting') {
        renderLobby();
        mpLobbyHint.textContent = '🎛️ A gazda éppen előkészíti a kazettát (számok letöltése)...';
    } else if (mpRoomData.status === 'playing') {
        // A menetet a gazda által generált gameId azonosítja. Korábban a startedAt
        // szerver-időbélyeg volt az azonosító, ami a saját írás visszaigazolásáig null-ként
        // látszott — ezért a gazda kliense másodpercekkel a kör INDULÁSA UTÁN érzékelt
        // "új menetet", és lenullázta a saját, addigra már beküldött roundsCompleted
        // értékét. Így a gazda soha nem számított késznek, és az első kör után nem lépett
        // tovább a játék. Safariban ez sokkal gyakoribb volt, mert ott a Firestore
        // kapcsolatfelvétele (a long-polling-ra való visszaesés miatt) akár 10+ másodpercig
        // is eltarthat, tehát a visszaigazolás bőven a tippelés utánra csúszott.
        const gameKey = mpGameKey();
        if (gameKey !== mpLastSeenGameKey) {
            mpLastSeenGameKey = gameKey;
            mpLocalRound = 0;
            mpAdvancingRound = 0;
            resetMyStatsForNewGame();
        }
        // Szigorúan csak ELŐRE lépünk: egy késve érkező (vagy gyorsítótárból jövő) régi
        // pillanatkép nem indíthatja újra a már lejátszott kört.
        if (mpRoomData.currentRound > mpLocalRound) {
            startMpRound(mpRoomData.currentRound);
        }
        if (mpAdvancingRound && mpAdvancingRound < mpRoomData.currentRound) mpAdvancingRound = 0;
        renderLiveLeaderboard();
    } else if (mpRoomData.status === 'finished') {
        renderMpResults();
        mpShowScreen(mpResultsScreen);
    }
}

function handlePlayersSnapshot(snap) {
    mpPlayersCache = new Map();
    snap.forEach(doc => mpPlayersCache.set(doc.id, Object.assign({ id: doc.id }, doc.data())));

    // A saját, visszaolvasott lastSeen-ünkből megbecsüljük a kliens- és a szerveróra
    // eltérését, hogy a "ki van még itt?" számítás elállított órájú gépen se boruljon fel.
    const myUid = mpMyUid();
    const mine = myUid ? mpPlayersCache.get(myUid) : null;
    const mineSeen = mine ? mpTsMillis(mine.lastSeen) : null;
    if (mineSeen !== null && mpLastPresenceWriteAt) mpClockSkewMs = mineSeen - mpLastPresenceWriteAt;

    if (mpRoomData && mpRoomData.status === 'waiting') renderLobby();
    if (mpRoomData && mpRoomData.status === 'playing') {
        renderLiveLeaderboard();
        renderWaitingList();
    }
    if (mpRoomData && mpRoomData.status === 'finished') renderMpResults();

    maybeClaimHost();
    if (mpRoomData && mpRoomData.status === 'playing') maybeAdvanceRound();
}

function resetMyStatsForNewGame() {
    mpMyScore = 0; mpMyStreak = 0; mpMyMaxStreak = 0; mpMyRoundResults = [];
    mpSessionSkipCount = 0; mpMySkipsUsed = 0;
    if (mpPlayerRef) {
        mpPlayerRef.update({ score: 0, streak: 0, maxStreak: 0, skipsUsed: 0, roundsCompleted: 0, roundResults: [] }).catch(e => console.warn(e));
    }
}

// ==========================================
// 9. VÁRÓTEREM (LOBBY) MEGJELENÍTÉSE
// ==========================================
function renderLobby() {
    if (!mpRoomData) return;
    const cfg = mpRoomData.config || {};
    mpCodeDisplay.textContent = mpRoomData.code || mpRoomCode;
    mpLobbySettingsSummary.textContent =
        `🎧 ${categoryLabelFor(cfg.category)}   ·   ${MP_MODE_LABELS[cfg.mode] || cfg.mode}\n` +
        `🔁 ${cfg.rounds} kör   ·   ⏱️ ${mpTimeLimitLabel(cfg.timeLimit)}${cfg.hardcore ? '   ·   ☠️ Hardcore' : ''}`;

    // Csak azokat listázzuk, akik tényleg jelen vannak — a bezárt fülek után bent ragadt
    // "szellem" játékosok különben örökre blokkolnák az indítást (rájuk várna a szoba).
    const players = mpLivePlayers();
    mpPlayerCountEl.textContent = players.length;
    mpPlayerMaxEl.textContent = cfg.maxPlayers ?? '–';

    const myUid = mpMyUid();
    mpPlayerListEl.innerHTML = players.map(p => {
        const isHostRow = p.id === mpRoomData.hostUid;
        const isSelf = p.id === myUid;
        const tag = isHostRow
            ? '<span class="mp-player-tag host">👑 Gazda</span>'
            : (p.ready ? '<span class="mp-player-tag ready">✅ Kész</span>' : '<span class="mp-player-tag waiting">⏳ Vár</span>');
        return `<div class="mp-player-row${isSelf ? ' is-self' : ''}">
            <div class="mp-player-avatar">${escapeHtml(mpAvatarLetter(p.name))}</div>
            <div class="mp-player-name">${escapeHtml(p.name || 'Játékos')}${isSelf ? ' (Te)' : ''}</div>
            ${tag}
        </div>`;
    }).join('');

    const myPlayer = myUid ? mpPlayersCache.get(myUid) : null;
    const amHost = mpRoomData.hostUid === myUid;

    mpReadyBtn.classList.toggle('hidden', amHost);
    mpStartBtn.classList.toggle('hidden', !amHost);

    if (!amHost && myPlayer) {
        mpReadyBtn.textContent = myPlayer.ready ? '❌ Mégsem vagyok kész' : '✅ Kész vagyok';
    }

    if (amHost) {
        const nonHostPlayers = players.filter(p => p.id !== mpRoomData.hostUid);
        const allReady = nonHostPlayers.every(p => p.ready);
        const enoughPlayers = players.length >= 2;
        const canStart = enoughPlayers && allReady && mpRoomData.status === 'waiting';
        mpStartBtn.disabled = !canStart;
        if (!enoughPlayers) mpLobbyHint.textContent = 'Legalább 2 játékos kell az induláshoz — küldd el a kódot!';
        else if (!allReady) mpLobbyHint.textContent = 'Várakozás, hogy mindenki jelezze: kész.';
        else mpLobbyHint.textContent = mpRoomData.status === 'waiting' ? 'Mindenki kész — indíthatod a játékot!' : '';
    } else if (mpHostIsGone()) {
        mpLobbyHint.textContent = '⏳ A szoba gazdája eltűnt — a rendszer mindjárt átadja a jogot valaki másnak...';
    } else {
        mpLobbyHint.textContent = 'Várakozás, hogy a gazda elindítsa a játékot...';
    }
}

mpCopyCodeBtn.addEventListener('click', async () => {
    if (!mpRoomData) return;
    const ok = await copyToClipboard(mpRoomData.code || mpRoomCode);
    mpCopyCodeBtn.textContent = ok ? '✅ Vágólapra másolva!' : '⚠️ Másolás sikertelen';
    setTimeout(() => { mpCopyCodeBtn.textContent = '📋 Kód másolása'; }, 2000);
});

mpCopyLinkBtn.addEventListener('click', async () => {
    if (!mpRoomData) return;
    const link = buildRoomInviteLink(mpRoomData.code || mpRoomCode);
    const ok = await copyToClipboard(link);
    mpCopyLinkBtn.textContent = ok ? '✅ Vágólapra másolva!' : '⚠️ Másolás sikertelen';
    setTimeout(() => { mpCopyLinkBtn.textContent = '🔗 Link másolása'; }, 2000);
});

mpReadyBtn.addEventListener('click', () => {
    if (!mpPlayerRef) return;
    const myUid = mpMyUid();
    const myPlayer = myUid ? mpPlayersCache.get(myUid) : null;
    const newReady = !(myPlayer && myPlayer.ready);
    mpPlayerRef.update({ ready: newReady }).catch(e => console.warn(e));
});

mpLobbyLeaveBtn.addEventListener('click', () => {
    if (!confirm('Biztosan kilépsz a szobából?')) return;
    leaveMpRoom();
    mpShowScreen(mpEntryScreen);
});

// ==========================================
// 10. JÁTÉK INDÍTÁSA (gazda)
// ==========================================
mpStartBtn.addEventListener('click', async () => {
    if (!mpIsHost || !mpRoomData) return;
    await beginMultiplayerRound();
});

mpResultsRematchBtn.addEventListener('click', async () => {
    if (!mpIsHost || !mpRoomData) return;
    mpResultsRematchBtn.disabled = true;
    await beginMultiplayerRound();
    mpResultsRematchBtn.disabled = false;
});

async function beginMultiplayerRound() {
    mpStartBtn.disabled = true;
    mpLobbyErrorMsg.textContent = '';
    try {
        await mpRoomRef.update({ status: 'starting', startingAt: firebase.firestore.FieldValue.serverTimestamp() });

        const cfg = mpRoomData.config;
        const usedIds = new Set();
        const songs = [];
        const choiceOptions = cfg.mode === 'choice' ? [] : null;

        for (let i = 0; i < cfg.rounds; i++) {
            const song = await getRandomSongFromiTunes(cfg.category, usedIds, Math.random);
            if (!song) throw new Error('Nem sikerült elég egyedi számot találni ehhez a kategóriához — próbálj kevesebb kört vagy másik kategóriát.');
            usedIds.add(song.id);
            songs.push(song);
            if (cfg.mode === 'choice') {
                const distractors = await getDistractorOptions(song, cfg.category);
                const options = shuffleArray([`${song.artist} - ${song.title}`, ...distractors]);
                // FONTOS: a Firestore nem támogat "beágyazott tömböt" (tömb közvetlenül egy másik
                // tömb elemeként) — ezért az egyes körök opció-tömbjét egy objektumba csomagoljuk
                // ({ options: [...] }), nem közvetlenül tömbként tesszük a choiceOptions tömbbe.
                choiceOptions.push({ options });
            }
        }

        const updateData = {
            songs, status: 'playing', currentRound: 1,
            gameId: generateGameId(),
            startedAt: firebase.firestore.FieldValue.serverTimestamp(),
            roundStartedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (choiceOptions) updateData.choiceOptions = choiceOptions;
        await mpRoomRef.update(updateData);
    } catch (e) {
        console.error(e);
        mpLobbyErrorMsg.textContent = 'Hiba történt indításkor: ' + (e.message || e);
        try { await mpRoomRef.update({ status: 'waiting' }); } catch (e2) { /* no-op */ }
    }
    mpStartBtn.disabled = false;
}

// Az őrszem MINDEN kliensen fut (nem csak a gazdáén), mert a gazda-átvételt is ez hajtja:
// ha a gazda eltűnik, valakinek észre kell vennie és át kell vennie a szerepét.
function startMpWatchdog() {
    if (mpWatchdog) return;
    mpWatchdog = setInterval(() => {
        if (!mpRoomData) return;
        maybeClaimHost();
        if (mpRoomData.status === 'playing') maybeAdvanceRound();
        if (mpRoomData.status === 'starting') maybeRecoverStuckStart();
    }, 3000);
}

// ---- Gazda-átvétel ----------------------------------------------------------
// Ha a gazda kilépett vagy eltűnt (bezárta a fület, lefagyott a kapcsolata), a szobában
// maradt játékosok közül a "legrégebbi" veszi át a szerepet. A sorrend minden kliensen
// ugyanaz (belépési idő, döntetlennél uid), így nem próbálja meg egyszerre több ember.
let mpHostClaimAt = 0;
function maybeClaimHost() {
    if (!mpRoomRef || !mpRoomData || mpIsHost) return;
    if (mpRoomData.status === 'finished') return;
    if (!mpHostIsGone(MP_HOST_TAKEOVER_STALE_MS)) return;

    const me = mpMyUid();
    if (!me || !mpPlayersCache.has(me)) return;

    const successor = mpHostSuccessor(mpLivePlayers().filter(p => p.id !== mpRoomData.hostUid));
    if (!successor || successor.id !== me) return;

    // Ne bombázzuk az adatbázist: két próbálkozás között legyen legalább 5 másodperc.
    if (Date.now() - mpHostClaimAt < 5000) return;
    mpHostClaimAt = Date.now();

    mpRoomRef.update({ hostUid: me, hostName: currentMpDisplayName() })
        .then(() => { mpIsHost = true; })
        .catch(e => console.warn('Nem sikerült átvenni a gazda szerepét:', e));
}

// Ha a gazda pont a számok letöltése ("starting") közben tűnt el, a szoba örökre ebben az
// állapotban ragadna — az új gazda ilyenkor visszaállítja a szobát várakozóra.
function maybeRecoverStuckStart() {
    if (!mpIsHost || !mpRoomRef || !mpRoomData || mpRoomData.status !== 'starting') return;
    const startingMillis = mpTsMillis(mpRoomData.startingAt);
    if (startingMillis === null || (mpServerNow() - startingMillis) < 90000) return;
    mpRoomRef.update({ status: 'waiting' }).catch(() => {});
}

// ---- Kör-léptetés -----------------------------------------------------------
let mpAdvancingRound = 0; // melyik körből próbálunk épp továbblépni (0 = egyikből sem)
async function maybeAdvanceRound() {
    if (!mpIsHost || !mpRoomRef || !mpRoomData || mpRoomData.status !== 'playing') return;
    const round = mpRoomData.currentRound;
    if (mpAdvancingRound === round) return;

    // Csak azokra várunk, akik tényleg jelen vannak. Aki bezárta a fület, arra a szoba
    // korábban a teljes időkorlát lejártáig várt (vagy örökre, ha nem volt időkorlát).
    const players = mpLivePlayers();
    if (players.length === 0) return;

    const allDone = players.every(p => (p.roundsCompleted || 0) >= round);

    // A szerver-időbélyeg a saját írásunk visszaigazolásáig null — ilyenkor a helyi
    // körindítás időpontjából számolunk, különben a biztonsági időkorlát sosem járna le.
    const roundStartedMillis = mpTsMillis(mpRoomData.roundStartedAt);
    const referenceMillis = roundStartedMillis !== null
        ? (roundStartedMillis - mpClockSkewMs)
        : (mpLocalRoundStartedAt || Date.now());
    const maxWaitMs = (mpRoomData.config.timeLimit > 0 ? mpRoomData.config.timeLimit + 20 : 45) * 1000;
    const timedOut = (Date.now() - referenceMillis) > maxWaitMs;

    if (!allDone && !timedOut) return;

    mpAdvancingRound = round;
    // Ha az írás beragadna (pl. akadozó mobilhálózaton), pár másodperc múlva
    // engedjük újrapróbálni — az őrszem 3 mp-enként úgyis visszatér ide.
    const releaseGuard = setTimeout(() => { if (mpAdvancingRound === round) mpAdvancingRound = 0; }, 8000);
    try {
        if (round >= mpRoomData.config.rounds) {
            await mpRoomRef.update({ status: 'finished', finishedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
            await mpRoomRef.update({ currentRound: round + 1, roundStartedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    } catch (e) {
        console.warn('Nem sikerült léptetni a kört:', e);
        clearTimeout(releaseGuard);
        if (mpAdvancingRound === round) mpAdvancingRound = 0;
    }
}

// ==========================================
// 11. KÖR LEJÁTSZÁSA
// ==========================================
function startMpRound(roundNum) {
    mpLocalRound = roundNum;
    mpLocalRoundStartedAt = Date.now();
    mpRoundFinished = false;
    mpCurrentStep = 0;
    mpChoiceLocked = false;
    mpIsPlaying = false;
    mpRoundUsedSkip = false;
    mpSkipCooldownToken++; // érvényteleníti egy esetleges, előző körből még futó cooldown-visszaszámlálót
    mpGuessInput.value = '';
    mpAutocompleteList.innerHTML = '';
    mpWaitingArea.classList.add('hidden');
    mpMessageDisplay.textContent = '';
    mpCassette.classList.remove('spinning');

    const cfg = mpRoomData.config;
    const song = mpRoomData.songs && mpRoomData.songs[roundNum - 1];
    if (!song) return;
    mpCurrentSong = song;
    mpCorrectAnswerFull = `${song.artist} - ${song.title}`.toLowerCase();

    const isChoiceMode = cfg.mode === 'choice';
    mpClassicInputArea.classList.toggle('hidden', isChoiceMode);
    mpChoiceInputArea.classList.toggle('hidden', !isChoiceMode);
    mpSubmitBtn.classList.toggle('hidden', isChoiceMode);
    mpChoiceInputArea.innerHTML = '';
    if (isChoiceMode) {
        const roundChoiceData = mpRoomData.choiceOptions && mpRoomData.choiceOptions[roundNum - 1];
        const options = (roundChoiceData && roundChoiceData.options) || [];
        renderMpChoices(options);
    }

    mpHardcoreBadge.classList.toggle('hidden', !cfg.hardcore);
    mpSkipBtn.classList.toggle('hidden', cfg.hardcore);
    mpStreakDisplay.classList.add('hidden');

    mpPlayBtn.disabled = false;
    mpSkipBtn.disabled = !!cfg.hardcore;
    mpSkipBtn.textContent = 'Kihagyás';
    mpSubmitBtn.disabled = false;
    mpGuessInput.disabled = false;

    mpAudioPlayer.pause();
    mpAudioPlayer.src = song.src;
    mpPlayBtn.textContent = '▶ Lejátszás';
    mpAudioProgressFill.style.width = '0%';
    mpRoundCounterDisplay.textContent = `${roundNum}. Kör / ${cfg.rounds}`;
    mpTimeDisplay.textContent = `0:00.0 / ${formatTime(MP_TIME_INTERVALS[0])}`;
    for (let i = 0; i <= 5; i++) {
        const step = document.getElementById(`mp-step-${i}`);
        if (step) step.classList.toggle('active', i === 0);
    }

    clearInterval(mpCountdownInterval);
    if (cfg.timeLimit > 0) {
        mpRemainingTime = cfg.timeLimit;
        mpCountdownDisplay.classList.remove('hidden');
        mpCountdownDisplay.textContent = `⏱️ ${mpRemainingTime}s`;
        mpCountdownDisplay.style.color = '';
        mpCountdownInterval = setInterval(() => {
            mpRemainingTime--;
            mpCountdownDisplay.textContent = `⏱️ ${mpRemainingTime}s`;
            if (mpRemainingTime <= 10) mpCountdownDisplay.style.color = 'var(--danger)';
            if (mpRemainingTime <= 0) { clearInterval(mpCountdownInterval); endMpRound(false, 'Lejárt az idő!'); }
        }, 1000);
    } else {
        mpCountdownDisplay.classList.add('hidden');
    }

    mpShowScreen(mpGameScreen);
    renderLiveLeaderboard();
}

function renderMpChoices(options) {
    mpChoiceInputArea.innerHTML = '';
    options.forEach(optionText => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = optionText;
        btn.addEventListener('click', () => handleMpChoiceClick(btn, optionText));
        mpChoiceInputArea.appendChild(btn);
    });
}

function handleMpChoiceClick(btn, optionText) {
    if (mpChoiceLocked) return;
    mpChoiceLocked = true;
    mpSkipBtn.disabled = true;

    const isCorrect = optionText.toLowerCase() === mpCorrectAnswerFull;
    mpChoiceInputArea.querySelectorAll('.choice-btn').forEach(b => {
        b.disabled = true;
        if (b.textContent.toLowerCase() === mpCorrectAnswerFull) b.classList.add('correct');
    });
    if (!isCorrect) btn.classList.add('wrong');

    if (isCorrect) {
        if (mpCurrentStep === 0) endMpRound(true, 'FLAWLESS! 🔥 Telitalálat!', true);
        else endMpRound(true, 'Gratulálok, eltaláltad!');
    } else {
        setTimeout(() => endMpRound(false, 'Nem talált — de ez van, jöhet a következő!'), 700);
    }
}

// --- lejátszás animáció (saját, független ciklus) ---
function animateMpProgress() {
    if (mpIsPlaying) {
        const currentTime = mpAudioPlayer.currentTime;
        const currentLimit = MP_TIME_INTERVALS[mpCurrentStep];
        mpAudioProgressFill.style.width = `${(currentTime / 15) * 100}%`;
        mpTimeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(currentLimit)}`;
        if (currentTime >= currentLimit) {
            mpAudioPlayer.pause();
            mpAudioPlayer.currentTime = currentLimit;
            mpIsPlaying = false;
            mpCassette.classList.remove('spinning');
            mpPlayBtn.textContent = '▶ Újrahallgatás';
        }
    }
    requestAnimationFrame(animateMpProgress);
}
requestAnimationFrame(animateMpProgress);

mpPlayBtn.addEventListener('click', () => {
    if (mpIsPlaying) {
        mpAudioPlayer.pause();
        mpIsPlaying = false;
        mpCassette.classList.remove('spinning');
        mpPlayBtn.textContent = '▶ Folytatás';
        return;
    }
    if (mpAudioPlayer.currentTime >= MP_TIME_INTERVALS[mpCurrentStep]) mpAudioPlayer.currentTime = 0;
    mpAudioPlayer.play();
    mpIsPlaying = true;
    mpCassette.classList.add('spinning');
    mpPlayBtn.textContent = '⏸ Szünet';
});

function advanceMpGame() {
    if (mpRoomData.config.hardcore) return;
    if (mpCurrentStep < MP_TIME_INTERVALS.length - 1) {
        mpCurrentStep++;
        const step = document.getElementById(`mp-step-${mpCurrentStep}`);
        if (step) step.classList.add('active');
        mpMessageDisplay.textContent = '+ Időkeret feloldva';
        mpMessageDisplay.style.color = 'var(--gold)';
        mpGuessInput.value = '';
    } else {
        endMpRound(false, 'Sajnos nem sikerült!');
    }
}
// Ha valaki egy menetben túl sokszor nyomja a Kihagyást, rövid várakozást (cooldown) kap
// a gombra — ez fékezi a spam-kattintgatást (lásd script.js triggerSkipCooldown, ugyanaz
// a mechanika, csak multiplayer-változatban).
function triggerMpSkipCooldown() {
    mpSessionSkipCount++;
    if (mpSessionSkipCount <= SKIP_COOLDOWN_SESSION_THRESHOLD) return;
    const myToken = ++mpSkipCooldownToken;
    mpSkipBtn.disabled = true;
    let remaining = SKIP_COOLDOWN_SECONDS;
    mpSkipBtn.textContent = `⏳ ${remaining}mp`;
    const tick = setInterval(() => {
        if (myToken !== mpSkipCooldownToken) { clearInterval(tick); return; } // közben új kör indult
        remaining--;
        if (remaining <= 0) {
            clearInterval(tick);
            mpSkipBtn.textContent = 'Kihagyás';
            if (!mpRoomData.config.hardcore) mpSkipBtn.disabled = false;
        } else {
            mpSkipBtn.textContent = `⏳ ${remaining}mp`;
        }
    }, 1000);
}

mpSkipBtn.addEventListener('click', () => {
    mpRoundUsedSkip = true;
    mpMySkipsUsed++;
    triggerMpSkipCooldown();
    advanceMpGame();
});

mpSubmitBtn.addEventListener('click', () => {
    const guess = mpGuessInput.value.trim().toLowerCase();
    if (!guess) return;
    if (mpCorrectAnswerFull.includes(guess) || guess.includes(mpCorrectAnswerFull)) {
        if (mpCurrentStep === 0) endMpRound(true, 'FLAWLESS! 🔥 Telitalálat!', true);
        else endMpRound(true, 'Gratulálok, eltaláltad!');
    } else if (mpRoomData.config.hardcore) {
        endMpRound(false, 'Rossz tipp — Hardcore mód!');
    } else {
        advanceMpGame();
    }
});

// ==========================================
// 12. KÖR VÉGE — saját eredmény írása Firestore-ba
// ==========================================
function endMpRound(isWin, msgText, isFlawless = false) {
    if (mpRoundFinished) return;
    mpRoundFinished = true;

    mpIsPlaying = false;
    mpAudioPlayer.pause();
    mpCassette.classList.remove('spinning');
    clearInterval(mpCountdownInterval);

    mpSkipBtn.disabled = true;
    mpSubmitBtn.disabled = true;
    mpGuessInput.disabled = true;
    mpAutocompleteList.innerHTML = '';
    mpChoiceInputArea.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

    const result = { win: isWin, step: mpCurrentStep, flawless: !!isFlawless, usedSkip: mpRoundUsedSkip };
    mpMyRoundResults.push(result);
    let mpStreakBrokenBySkip = false;

    if (isWin) {
        mpMyScore++;
        // Egy Kihagyás — akkor is, ha végül eltaláltad — megtöri a sorozatot/combót,
        // ugyanúgy, mint solo módban (lásd script.js endRound).
        if (mpRoundUsedSkip) {
            mpStreakBrokenBySkip = mpMyStreak > 0;
            mpMyStreak = 0;
        } else {
            mpMyStreak++;
            if (mpMyStreak > mpMyMaxStreak) mpMyMaxStreak = mpMyStreak;
        }
        if (mpMyStreak > 0) {
            mpStreakDisplay.classList.remove('hidden');
            mpStreakDisplay.textContent = `🔥 Streak: ${mpMyStreak}`;
        } else {
            mpStreakDisplay.classList.add('hidden');
        }
        mpMessageDisplay.style.color = 'var(--accent-2)';
    } else {
        mpMyStreak = 0;
        mpStreakDisplay.classList.add('hidden');
        mpMessageDisplay.style.color = 'var(--danger)';
    }
    if (mpStreakBrokenBySkip) msgText += ' (a Kihagyás megtörte a sorozatod)';
    mpMessageDisplay.textContent = `${msgText}  —  ${mpCurrentSong.artist} - ${mpCurrentSong.title}`;

    if (mpPlayerRef) {
        mpPlayerRef.update({
            score: mpMyScore, streak: mpMyStreak, maxStreak: mpMyMaxStreak, skipsUsed: mpMySkipsUsed,
            roundsCompleted: mpLocalRound, roundResults: mpMyRoundResults
        }).catch(e => console.warn('Nem sikerült menteni a kör eredményét:', e));
    }

    setTimeout(() => {
        mpMessageDisplay.textContent = '';
        mpWaitingArea.classList.remove('hidden');
        renderWaitingList();
    }, 1800);
}

function renderWaitingList() {
    if (!mpRoomData) return;
    const round = mpLocalRound;
    const players = mpLivePlayers();
    const done = players.filter(p => (p.roundsCompleted || 0) >= round).map(p => p.name || 'Játékos');
    const pending = players.filter(p => (p.roundsCompleted || 0) < round).map(p => p.name || 'Játékos');
    let text = `✅ Végzett: ${done.length ? done.map(escapeHtml).join(', ') : '—'}`;
    if (pending.length) text += `\n⏳ Még játszik: ${pending.map(escapeHtml).join(', ')}`;
    mpWaitingList.innerHTML = text.replace(/\n/g, '<br>');
}

// ==========================================
// 13. ÉLŐ RANGLISTA (játék közben)
// ==========================================
function renderLiveLeaderboard() {
    if (!mpRoomData) return;
    const myUid = mpMyUid();
    const players = mpLivePlayers()
        .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.maxStreak || 0) - (a.maxStreak || 0));

    mpLiveLeaderboard.innerHTML = players.map((p, idx) => {
        const isSelf = p.id === myUid;
        return `<div class="mp-lb-chip${isSelf ? ' is-self' : ''}">
            <span class="mp-lb-rank">${idx + 1}.</span>
            <span class="mp-lb-name">${escapeHtml(p.name || 'Játékos')}</span>
            <span class="mp-lb-score">${p.score || 0}</span>
        </div>`;
    }).join('');
}

// ==========================================
// 14. VÉGEREDMÉNY
// ==========================================
function renderMpResults() {
    if (!mpRoomData) return;
    const myUid = mpMyUid();
    const players = Array.from(mpPlayersCache.values())
        .sort((a, b) => (b.score || 0) - (a.score || 0) || (b.maxStreak || 0) - (a.maxStreak || 0));

    mpFinalLeaderboard.innerHTML = players.map((p, idx) => {
        const isSelf = p.id === myUid;
        const rank = idx + 1;
        return `<div class="mp-final-row${rank === 1 ? ' rank-1' : ''}${isSelf ? ' is-self' : ''}">
            <div class="mp-final-rank">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</div>
            <div class="mp-final-info">
                <div class="mp-final-name">${escapeHtml(p.name || 'Játékos')}${isSelf ? ' (Te)' : ''}</div>
                <div class="mp-final-sub">${p.score || 0}/${mpRoomData.config.rounds} helyes · max streak 🔥 ${p.maxStreak || 0}</div>
            </div>
            <div class="mp-final-score">${p.score || 0}</div>
        </div>`;
    }).join('');

    mpResultsRematchBtn.classList.toggle('hidden', mpRoomData.hostUid !== myUid);

    // A saját profilt (XP, jelvények) csak EGYSZER frissítjük ehhez a lejátszott menethez,
    // különben minden onSnapshot-frissítéskor újra hozzáadná az XP-t. A kulcs a menet
    // gameId-ja: a korábbi startedAt-alapú kulcs a saját írás visszaigazolásakor
    // megváltozott (null → valódi időbélyeg), és emiatt kétszer is beszámíthatta az XP-t.
    const resultsKey = mpRoomCode + '_' + mpGameKey();
    if (mpResultsProcessedKey === resultsKey) return;
    mpResultsProcessedKey = resultsKey;

    const myPlayer = myUid ? mpPlayersCache.get(myUid) : null;
    const myRank = players.findIndex(p => p.id === myUid) + 1;
    const myResults = (myPlayer && myPlayer.roundResults) || mpMyRoundResults || [];

    const profile = loadProfile();
    let sessionXp = 0;
    let correctCount = 0, wrongCount = 0, flawlessCount = 0, maxStreakThisGame = 0;
    myResults.forEach(r => {
        sessionXp += xpForRound(r.win, r.flawless, r.step);
        if (r.win) correctCount++; else wrongCount++;
        if (r.win && r.flawless) flawlessCount++;
    });
    maxStreakThisGame = (myPlayer && myPlayer.maxStreak) || mpMyMaxStreak || 0;

    const isChampion = myRank === 1 && players.length >= 2;
    if (isChampion) sessionXp += 30;

    profile.gamesPlayed += 1;
    profile.totalCorrect += correctCount;
    profile.totalWrong += wrongCount;
    profile.totalFlawless += flawlessCount;
    profile.bestStreakEver = Math.max(profile.bestStreakEver, maxStreakThisGame);
    (Array.isArray(mpRoomData.config.category) ? mpRoomData.config.category : [mpRoomData.config.category]).forEach(catKey => {
        if (!profile.categoriesPlayed.includes(catKey)) profile.categoriesPlayed.push(catKey);
    });

    // A Kihagyás-arányt ELŐBB frissítjük ezzel a menettel, hogy a szorzó már a legfrissebb
    // állapotot tükrözze — lásd script.js "3e. KIHAGYÁS-BÜNTETŐRENDSZER".
    profile.roundsPlayed = (profile.roundsPlayed || 0) + myResults.length;
    profile.roundsSkipped = (profile.roundsSkipped || 0) + myResults.filter(r => r.usedSkip).length;
    const skipMultiplier = skipRateMultiplier(profile);
    sessionXp = Math.round(sessionXp * skipMultiplier);

    profile.xp += sessionXp;
    profile.username = currentMpDisplayName();

    const newBadges = checkAndAwardBadges(profile, { mpDebut: true, mpChampion: isChampion });
    saveProfile(profile);

    let xpText = `+${sessionXp} XP${isChampion ? ' (🥇 bajnoki bónusz +30 benne)' : ''}`;
    if (skipMultiplier < 1) xpText += `\n⚠️ -${Math.round((1 - skipMultiplier) * 100)}% a gyakori Kihagyás miatt`;
    if (newBadges.length > 0) {
        const names = newBadges.map(id => (BADGES.find(b => b.id === id) || {}).name).filter(Boolean);
        if (names.length) xpText += `\n🏅 Új jelvény: ${names.join(', ')}`;
    }
    mpResultsXp.textContent = xpText;

    // "Kihagyás Király" — ki skippelt a legtöbbet ebben a menetben (csak akkor jelenik
    // meg, ha legalább valaki tényleg használt Kihagyást, és legalább 2 játékos volt).
    if (mpResultsSkipKingEl && players.length >= 2) {
        const topSkipper = players.reduce((max, p) => (p.skipsUsed || 0) > (max.skipsUsed || 0) ? p : max, players[0]);
        if ((topSkipper.skipsUsed || 0) > 0) {
            mpResultsSkipKingEl.textContent = `🐌 Kihagyás Király: ${topSkipper.name || 'Játékos'} (${topSkipper.skipsUsed} Kihagyás)`;
            mpResultsSkipKingEl.classList.remove('hidden');
        } else {
            mpResultsSkipKingEl.classList.add('hidden');
        }
    }
}

mpResultsHomeBtn.addEventListener('click', () => {
    leaveMpRoom();
    refreshHomeUI();
    generateDynamicBackground();
    mpShowScreen(homeScreen);
});

// ==========================================
// 15. KILÉPÉS / TAKARÍTÁS
// ==========================================
mpGameLeaveBtn.addEventListener('click', () => {
    if (!confirm('Biztosan kilépsz a szobából? A jelenlegi menetben elveszik a helyed.')) return;
    leaveMpRoom();
    refreshHomeUI();
    generateDynamicBackground();
    mpShowScreen(homeScreen);
});

function leaveMpRoom() {
    mpAudioPlayer.pause();
    clearInterval(mpCountdownInterval);
    clearTimeout(mpTypingTimer);

    const roomRefToClean = mpRoomRef;
    const playerRefToClean = mpPlayerRef;
    const wasHost = mpIsHost;
    const myUid = mpMyUid();
    const remaining = mpLivePlayers().filter(p => p.id !== myUid);

    detachMpListeners();

    if (playerRefToClean) playerRefToClean.delete().catch(() => {});

    // Ha még egyetlen játékos-pillanatképet sem kaptunk, nem tudjuk, ki van bent — ilyenkor
    // csak akkor nyúlunk a szobához, ha mi magunk vagyunk a gazdája.
    const knowWhoIsHere = mpPlayersCache.size > 0 || wasHost;

    if (roomRefToClean) {
        if (remaining.length === 0 && knowWhoIsHere) {
            // Én voltam az utolsó — a szobának nincs többé értelme, töröljük. Enélkül a
            // kiürült (főleg gyorsjáték-) szobák bent maradtak az adatbázisban, és a
            // következő gyorsjáték-kereső újra beleült egy halott, gazda nélküli szobába
            // (ugyanazzal a kóddal), ahol senki nem tudta elindítani a játékot.
            roomRefToClean.delete().catch(() => {});
        } else if (wasHost) {
            // Nem zárjuk be a szobát a többiek feje fölött: a gazda szerepét átadjuk a
            // legrégebb óta bent lévő játékosnak.
            const successor = mpHostSuccessor(remaining);
            roomRefToClean.update({
                hostUid: successor.id,
                hostName: successor.name || 'Játékos'
            }).catch(e => console.warn('Nem sikerült átadni a gazda szerepét:', e));
        }
        // Megjegyzés: a szoba törlésekor a többi játékos "players" al-dokumentuma technikailag
        // árván marad a Firestore-ban (a biztonsági szabályok miatt csak a saját dokumentumát
        // törölheti bárki), de mivel a szoba dokumentuma nélkül ezek soha többé nem lesznek
        // lekérdezve, ez ártalmatlan.
    }

    cleanupMpLocalState();
}

function cleanupMpLocalState() {
    mpRoomCode = null; mpRoomRef = null; mpPlayerRef = null; mpIsHost = false;
    mpRoomData = null; mpPlayersCache = new Map();
    mpLocalRound = 0; mpLocalRoundStartedAt = 0;
    mpLastSeenGameKey = null; mpResultsProcessedKey = null;
    mpMyScore = 0; mpMyStreak = 0; mpMyMaxStreak = 0; mpMyRoundResults = [];
    mpAdvancingRound = 0; mpHostClaimAt = 0; mpLastPresenceWriteAt = 0;
}

// ==========================================
// 16. AUTOCOMPLETE (Multiplayer klasszikus mód)
// ==========================================
mpGuessInput.addEventListener('input', function () {
    clearTimeout(mpTypingTimer);
    const val = this.value;
    mpAutocompleteList.innerHTML = '';
    if (!val) return;
    mpTypingTimer = setTimeout(async () => {
        const results = await searchiTunes(val);
        results.forEach(song => {
            const fullSongText = `${song.artist} - ${song.title}`;
            const item = document.createElement('div');
            item.className = 'autocomplete-item text-white';
            item.innerHTML = `
                <img src="${song.cover}" onerror="this.onerror=null; this.src='${fallbackImg}'">
                <div>
                    <span class="fw-bold d-block">${escapeHtml(song.title)}</span>
                    <span class="small text-secondary">${escapeHtml(song.artist)}</span>
                </div>
            `;
            item.addEventListener('click', function () {
                mpGuessInput.value = fullSongText;
                mpAutocompleteList.innerHTML = '';
            });
            mpAutocompleteList.appendChild(item);
        });
    }, 400);
});

document.addEventListener('click', function (e) {
    if (e.target !== mpGuessInput && !mpAutocompleteList.contains(e.target)) mpAutocompleteList.innerHTML = '';
});

// ==========================================
// 17. LINK ALAPÚ MEGHÍVÁS (automatikus csatlakozás)
// ==========================================
// Ha valaki a "🔗 Link másolása" gombbal kapott linket nyitja meg (pl. ...?room=A7K2XQ),
// az oldal betöltésekor automatikusan megpróbáljuk beültetni a megfelelő szobába — nem kell
// neki külön beírnia a kódot. A "room" paramétert egyből ki is töröljük az URL-ből
// (history.replaceState), hogy egy véletlen frissítés (F5) ne próbáljon újra csatlakozni.
(function initRoomInviteLink() {
    let code = null;
    try {
        const params = new URLSearchParams(location.search);
        code = params.get('room');
    } catch (e) { /* régi böngészőknél a URLSearchParams hiányozhat — csendben kihagyjuk */ }

    if (!code) return;
    code = code.trim().toUpperCase();
    try { history.replaceState({}, '', location.pathname); } catch (e) { /* no-op */ }

    autoJoinFromInviteLink(code);
})();

async function autoJoinFromInviteLink(code) {
    mpShowScreen(mpEntryScreen);
    mpEntryErrorMsg.textContent = `Csatlakozás a(z) ${code} szobához...`;
    const user = await requireMultiplayerReady(mpEntryErrorMsg);
    if (!user) return;
    const joined = await joinRoomByCode(code, user, mpEntryErrorMsg);
    if (joined) mpEntryErrorMsg.textContent = '';
}
