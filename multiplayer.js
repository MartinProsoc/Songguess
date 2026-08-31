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
const mpCategoryInput = document.getElementById('mp-category-input');
const mpRoundsInput = document.getElementById('mp-rounds-input');
const mpTimeLimitInput = document.getElementById('mp-time-limit-input');
const mpMaxPlayersInput = document.getElementById('mp-maxplayers-input');
const mpHardcoreInput = document.getElementById('mp-hardcore-input');
const mpCreateConfirmBtn = document.getElementById('mp-create-confirm-btn');
const mpSetupErrorMsg = document.getElementById('mp-setup-error-msg');

const mpLobbyLeaveBtn = document.getElementById('mp-lobby-leave-btn');
const mpCodeDisplay = document.getElementById('mp-code-display');
const mpCopyCodeBtn = document.getElementById('mp-copy-code-btn');
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
let mpHostWatchdog = null;
let mpRoomData = null;
let mpPlayersCache = new Map(); // uid -> player data (mindig tartalmazza az 'id' mezőt is)
let mpLocalRound = 0;           // az utoljára ténylegesen elindított kör száma
let mpLastSeenStartedAtMillis = null;
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
            category: mpCategoryInput.value,
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

        await firestoreDb.collection('rooms').doc(code).collection('players').doc(user.uid).set({
            name,
            ready: true,
            score: 0, streak: 0, maxStreak: 0,
            roundsCompleted: 0, roundResults: [],
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

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
        const playersSnap = await firestoreDb.collection('rooms').doc(code).collection('players').get();
        if (playersSnap.size >= (room.config?.maxPlayers || 99)) { errorEl.textContent = 'Megtelt ez a szoba.'; return false; }

        const name = currentMpDisplayName();
        await firestoreDb.collection('rooms').doc(code).collection('players').doc(user.uid).set({
            name,
            ready: false,
            score: 0, streak: 0, maxStreak: 0,
            roundsCompleted: 0, roundResults: [],
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    enterRoom(code, room.hostUid === user.uid);
    return true;
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
            if (room.hostUid === user.uid) continue;
            const playersSnap = await doc.ref.collection('players').get();
            if (playersSnap.size < (room.config?.maxPlayers || 6)) {
                const name = currentMpDisplayName();
                await doc.ref.collection('players').doc(user.uid).set({
                    name, ready: false,
                    score: 0, streak: 0, maxStreak: 0,
                    roundsCompleted: 0, roundResults: [],
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                enterRoom(doc.id, false);
                joined = true;
                break;
            }
        }

        if (!joined) {
            // Nincs elérhető nyitott szoba — nyitunk egy újat, alapértelmezett beállításokkal,
            // és várunk, amíg mások is csatlakoznak (vagy magad indítod el kevesebb fővel).
            const config = { category: 'all', mode: 'classic', rounds: 5, timeLimit: 30, hardcore: false, maxPlayers: 6 };
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
            await firestoreDb.collection('rooms').doc(code).collection('players').doc(user.uid).set({
                name, ready: true, score: 0, streak: 0, maxStreak: 0,
                roundsCompleted: 0, roundResults: [],
                joinedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
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
    mpLastSeenStartedAtMillis = null;
    mpResultsProcessedKey = null;
    mpLocalRound = 0;

    detachMpListeners();
    mpUnsubRoom = mpRoomRef.onSnapshot(handleRoomSnapshot, (err) => console.warn('Szoba figyelési hiba:', err));
    mpUnsubPlayers = mpRoomRef.collection('players').onSnapshot(handlePlayersSnapshot, (err) => console.warn('Játékosok figyelési hiba:', err));

    mpShowScreen(mpLobbyScreen);
}

function detachMpListeners() {
    if (mpUnsubRoom) { mpUnsubRoom(); mpUnsubRoom = null; }
    if (mpUnsubPlayers) { mpUnsubPlayers(); mpUnsubPlayers = null; }
    if (mpHostWatchdog) { clearInterval(mpHostWatchdog); mpHostWatchdog = null; }
}

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

    if (mpRoomData.status === 'waiting') {
        renderLobby();
        if (!mpGameScreen.classList.contains('active') && !mpResultsScreen.classList.contains('active')) {
            mpShowScreen(mpLobbyScreen);
        }
    } else if (mpRoomData.status === 'starting') {
        renderLobby();
        mpLobbyHint.textContent = '🎛️ A gazda éppen előkészíti a kazettát (számok letöltése)...';
    } else if (mpRoomData.status === 'playing') {
        const startedAtMillis = mpRoomData.startedAt && mpRoomData.startedAt.toMillis ? mpRoomData.startedAt.toMillis() : null;
        if (startedAtMillis !== mpLastSeenStartedAtMillis) {
            mpLastSeenStartedAtMillis = startedAtMillis;
            resetMyStatsForNewGame();
        }
        if (mpRoomData.currentRound !== mpLocalRound) {
            startMpRound(mpRoomData.currentRound);
        }
        renderLiveLeaderboard();
        if (mpIsHost) startHostWatchdog();
    } else if (mpRoomData.status === 'finished') {
        if (mpHostWatchdog) { clearInterval(mpHostWatchdog); mpHostWatchdog = null; }
        renderMpResults();
        mpShowScreen(mpResultsScreen);
    }
}

function handlePlayersSnapshot(snap) {
    mpPlayersCache = new Map();
    snap.forEach(doc => mpPlayersCache.set(doc.id, Object.assign({ id: doc.id }, doc.data())));

    if (mpRoomData && mpRoomData.status === 'waiting') renderLobby();
    if (mpRoomData && mpRoomData.status === 'playing') {
        renderLiveLeaderboard();
        renderWaitingList();
        if (mpIsHost) maybeAdvanceRound();
    }
    if (mpRoomData && mpRoomData.status === 'finished') renderMpResults();
}

function resetMyStatsForNewGame() {
    mpMyScore = 0; mpMyStreak = 0; mpMyMaxStreak = 0; mpMyRoundResults = [];
    if (mpPlayerRef) {
        mpPlayerRef.update({ score: 0, streak: 0, maxStreak: 0, roundsCompleted: 0, roundResults: [] }).catch(e => console.warn(e));
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
        `🎧 ${CATEGORY_LABELS[cfg.category] || cfg.category}   ·   ${MP_MODE_LABELS[cfg.mode] || cfg.mode}\n` +
        `🔁 ${cfg.rounds} kör   ·   ⏱️ ${mpTimeLimitLabel(cfg.timeLimit)}${cfg.hardcore ? '   ·   ☠️ Hardcore' : ''}`;

    const players = Array.from(mpPlayersCache.values());
    mpPlayerCountEl.textContent = players.length;
    mpPlayerMaxEl.textContent = cfg.maxPlayers ?? '–';

    const myUid = firebaseAuth.currentUser && firebaseAuth.currentUser.uid;
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

mpReadyBtn.addEventListener('click', () => {
    if (!mpPlayerRef) return;
    const myUid = firebaseAuth.currentUser && firebaseAuth.currentUser.uid;
    const myPlayer = myUid ? mpPlayersCache.get(myUid) : null;
    const newReady = !(myPlayer && myPlayer.ready);
    mpPlayerRef.update({ ready: newReady }).catch(e => console.warn(e));
});

mpLobbyLeaveBtn.addEventListener('click', () => {
    if (!confirm('Biztosan kilépsz a szobából?')) return;
    leaveMpRoom(true);
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
        await mpRoomRef.update({ status: 'starting' });

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

function startHostWatchdog() {
    if (mpHostWatchdog) return;
    mpHostWatchdog = setInterval(() => {
        if (mpIsHost && mpRoomData && mpRoomData.status === 'playing') maybeAdvanceRound();
    }, 3000);
}

let mpAdvancing = false;
async function maybeAdvanceRound() {
    if (!mpIsHost || mpAdvancing || !mpRoomData || mpRoomData.status !== 'playing') return;
    const round = mpRoomData.currentRound;
    const players = Array.from(mpPlayersCache.values());
    if (players.length === 0) return;

    const allDone = players.every(p => (p.roundsCompleted || 0) >= round);

    const roundStartedMillis = mpRoomData.roundStartedAt && mpRoomData.roundStartedAt.toMillis ? mpRoomData.roundStartedAt.toMillis() : Date.now();
    const maxWaitMs = (mpRoomData.config.timeLimit > 0 ? mpRoomData.config.timeLimit + 20 : 45) * 1000;
    const timedOut = (Date.now() - roundStartedMillis) > maxWaitMs;

    if (!allDone && !timedOut) return;

    mpAdvancing = true;
    try {
        if (round >= mpRoomData.config.rounds) {
            await mpRoomRef.update({ status: 'finished', finishedAt: firebase.firestore.FieldValue.serverTimestamp() });
        } else {
            await mpRoomRef.update({ currentRound: round + 1, roundStartedAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    } catch (e) {
        console.warn('Nem sikerült léptetni a kört:', e);
    }
    mpAdvancing = false;
}

// ==========================================
// 11. KÖR LEJÁTSZÁSA
// ==========================================
function startMpRound(roundNum) {
    mpLocalRound = roundNum;
    mpRoundFinished = false;
    mpCurrentStep = 0;
    mpChoiceLocked = false;
    mpIsPlaying = false;
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
mpSkipBtn.addEventListener('click', advanceMpGame);

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

    const result = { win: isWin, step: mpCurrentStep, flawless: !!isFlawless };
    mpMyRoundResults.push(result);

    if (isWin) {
        mpMyScore++; mpMyStreak++;
        if (mpMyStreak > mpMyMaxStreak) mpMyMaxStreak = mpMyStreak;
        mpStreakDisplay.classList.remove('hidden');
        mpStreakDisplay.textContent = `🔥 Streak: ${mpMyStreak}`;
        mpMessageDisplay.style.color = 'var(--accent-2)';
    } else {
        mpMyStreak = 0;
        mpStreakDisplay.classList.add('hidden');
        mpMessageDisplay.style.color = 'var(--danger)';
    }
    mpMessageDisplay.textContent = `${msgText}  —  ${mpCurrentSong.artist} - ${mpCurrentSong.title}`;

    if (mpPlayerRef) {
        mpPlayerRef.update({
            score: mpMyScore, streak: mpMyStreak, maxStreak: mpMyMaxStreak,
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
    const players = Array.from(mpPlayersCache.values());
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
    const myUid = firebaseAuth.currentUser && firebaseAuth.currentUser.uid;
    const players = Array.from(mpPlayersCache.values())
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
    const myUid = firebaseAuth.currentUser && firebaseAuth.currentUser.uid;
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
    // különben minden onSnapshot-frissítéskor újra hozzáadná az XP-t.
    const resultsKey = mpRoomCode + '_' + (mpRoomData.startedAt && mpRoomData.startedAt.toMillis ? mpRoomData.startedAt.toMillis() : mpLocalRound);
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
    if (!profile.categoriesPlayed.includes(mpRoomData.config.category)) profile.categoriesPlayed.push(mpRoomData.config.category);
    profile.xp += sessionXp;
    profile.username = currentMpDisplayName();

    const newBadges = checkAndAwardBadges(profile, { mpDebut: true, mpChampion: isChampion });
    saveProfile(profile);

    let xpText = `+${sessionXp} XP${isChampion ? ' (🥇 bajnoki bónusz +30 benne)' : ''}`;
    if (newBadges.length > 0) {
        const names = newBadges.map(id => (BADGES.find(b => b.id === id) || {}).name).filter(Boolean);
        if (names.length) xpText += `\n🏅 Új jelvény: ${names.join(', ')}`;
    }
    mpResultsXp.textContent = xpText;
}

mpResultsHomeBtn.addEventListener('click', () => {
    leaveMpRoom(true);
    refreshHomeUI();
    generateDynamicBackground();
    mpShowScreen(homeScreen);
});

// ==========================================
// 15. KILÉPÉS / TAKARÍTÁS
// ==========================================
mpGameLeaveBtn.addEventListener('click', () => {
    if (!confirm('Biztosan kilépsz a szobából? A jelenlegi menetben elveszik a helyed.')) return;
    leaveMpRoom(true);
    refreshHomeUI();
    generateDynamicBackground();
    mpShowScreen(homeScreen);
});

function leaveMpRoom(deleteRoomIfHost) {
    mpAudioPlayer.pause();
    clearInterval(mpCountdownInterval);
    clearTimeout(mpTypingTimer);

    const roomRefToClean = mpRoomRef;
    const playerRefToClean = mpPlayerRef;
    const wasHost = mpIsHost;

    detachMpListeners();

    if (playerRefToClean) playerRefToClean.delete().catch(() => {});
    // Megjegyzés: ha a gazda törli a szobát, a többi játékos "players" al-dokumentuma technikailag
    // árván marad a Firestore-ban (a biztonsági szabályok miatt csak a saját dokumentumát törölheti
    // bárki), de mivel a szoba dokumentuma nélkül ezek soha többé nem lesznek elérve/lekérdezve,
    // ez ártalmatlan — egy éles, nagy forgalmú verzióhoz egy időzített Cloud Function javasolt a
    // régi szobák takarítására.
    if (wasHost && deleteRoomIfHost && roomRefToClean) roomRefToClean.delete().catch(() => {});

    cleanupMpLocalState();
}

function cleanupMpLocalState() {
    mpRoomCode = null; mpRoomRef = null; mpPlayerRef = null; mpIsHost = false;
    mpRoomData = null; mpPlayersCache = new Map();
    mpLocalRound = 0; mpLastSeenStartedAtMillis = null; mpResultsProcessedKey = null;
    mpMyScore = 0; mpMyStreak = 0; mpMyMaxStreak = 0; mpMyRoundResults = [];
    mpAdvancing = false;
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
