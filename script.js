// ==========================================
// 1. ITUNES API BEÁLLÍTÁSOK
// ==========================================
const CATEGORY_TERMS = {
    magyar: ['azahriah', 'desh', 'halott penz', 'korda gyorgy', 'valmar', 'wellhello', 'beton hofi', 'krubi', 'dzsudlo', 'majka', 'punnany massif', 'kowalsky meg a vega'],
    vilagslager: ['the weeknd', 'dua lipa', 'ed sheeran', 'coldplay', 'taylor swift', 'adele', 'bruno mars', 'rihanna'],
    rock_metal: ['queen', 'ac dc', 'metallica', 'guns n roses', 'linkin park', 'nirvana', 'iron maiden', 'red hot chili peppers'],
    hiphop_rap: ['eminem', 'kendrick lamar', 'drake', 'travis scott', 'jay z', 'dr dre', '50 cent', 'kanye west'],
    electronic: ['alan walker', 'avicii', 'david guetta', 'calvin harris', 'marshmello', 'daft punk', 'swedish house mafia', 'martin garrix'],
    jazz_soul: ['frank sinatra', 'ella fitzgerald', 'amy winehouse', 'stevie wonder', 'nina simone', 'ray charles'],
    classical_soundtrack: ['hans zimmer', 'john williams', 'ludovico einaudi', 'mozart', 'beethoven', 'yann tiersen'],
    latin: ['bad bunny', 'shakira', 'enrique iglesias', 'rosalia', 'luis fonsi', 'j balvin'],
    kpop: ['bts', 'blackpink', 'twice', 'stray kids', 'newjeans', 'txt'],
    retro: ['britney spears', 'backstreet boys', 'spice girls', 'nsync', 'abba', 'michael jackson'],
    gaming: ['hans zimmer', 'league of legends', 'c418 minecraft', 'fifa soundtrack', 'alan walker', 'imagine dragons', 'undertale soundtrack', 'zelda soundtrack'],
    all: ['pop hit 2024', 'top hits', 'rock classic', 'dance music', 'summer hits']
};

const CATEGORY_LABELS = {
    all: "Mindegyik keverve", magyar: "Magyar slágerek", vilagslager: "Világslágerek (Pop)",
    rock_metal: "Rock & Metal", hiphop_rap: "Hip-Hop & Rap", electronic: "Elektronikus / EDM",
    jazz_soul: "Jazz & Soul", classical_soundtrack: "Klasszikus & Filmzene", latin: "Latin",
    kpop: "K-Pop", retro: "90's / 2000's Retro", gaming: "Gaming & Sport"
};

const fallbackImg = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='100%25' height='100%25' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23555' font-family='sans-serif' font-size='40'%3E%E2%99%AB%3C/text%3E%3C/svg%3E";

function shuffleArray(arr, rng = Math.random) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function getRandomSongFromiTunes(category, excludeIds = new Set(), rng = Math.random) {
    const terms = CATEGORY_TERMS[category] || CATEGORY_TERMS['all'];
    const shuffledTerms = shuffleArray([...terms], rng);

    for (const term of shuffledTerms) {
        console.log(`Keresés indítása: ${term}...`);
        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=30`);
            const data = await response.json();

            const rawTracks = data.results.filter(track => track.previewUrl && !excludeIds.has(track.trackId));
            if (rawTracks.length === 0) {
                console.warn(`"${term}" kulcsszóhoz nincs több egyedi szám ebben a körben, próbálkozás másikkal...`);
                continue;
            }

            // Előnyben részesítjük azokat a találatokat, ahol a kulcsszó ténylegesen
            // az előadó nevében szerepel (kiszűri a véletlen cím-egyezéseket).
            const artistMatches = rawTracks.filter(track => track.artistName.toLowerCase().includes(term.toLowerCase()));
            const validTracks = artistMatches.length > 0 ? artistMatches : rawTracks;

            const randomTrack = validTracks[Math.floor(rng() * validTracks.length)];
            console.log(`Sikeres letöltés: ${randomTrack.artistName} - ${randomTrack.trackName}`);

            return {
                id: randomTrack.trackId,
                artist: randomTrack.artistName,
                title: randomTrack.trackName,
                src: randomTrack.previewUrl,
                cover: randomTrack.artworkUrl100.replace('100x100bb', '300x300bb')
            };
        } catch (error) {
            console.error("Hálózati hiba az iTunes lekérdezésnél:", error);
        }
    }
    return null;
}

async function searchiTunes(query) {
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`);
        const data = await response.json();
        if (!data.results) return [];
        return data.results.map(track => ({ artist: track.artistName, title: track.trackName, cover: track.artworkUrl100 }));
    } catch (error) {
        return [];
    }
}

async function getDistractorOptions(correctSong, category) {
    const terms = CATEGORY_TERMS[category] || CATEGORY_TERMS['all'];
    const term = terms[Math.floor(Math.random() * terms.length)];
    const correctFull = `${correctSong.artist} - ${correctSong.title}`.toLowerCase();
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=25`);
        const data = await response.json();
        const pool = (data.results || [])
            .filter(t => t.trackName && t.artistName)
            .map(t => `${t.artistName} - ${t.trackName}`)
            .filter(full => full.toLowerCase() !== correctFull);
        const uniquePool = [...new Set(pool)];
        shuffleArray(uniquePool);
        return uniquePool.slice(0, 3);
    } catch (error) {
        return [];
    }
}

// ==========================================
// 2. ÉLŐ HÁTTÉR GENERÁLÁSA (ismétlés nélkül)
// ==========================================
let backgroundImages = [];

async function loadBackgroundImages() {
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=top+hits&entity=song&limit=200`);
        const data = await res.json();
        const urls = data.results.map(t => t.artworkUrl100.replace('100x100bb', '300x300bb'));
        backgroundImages = [...new Set(urls)];
    } catch (e) {
        backgroundImages = [fallbackImg];
    }
    generateDynamicBackground();
}

function generateDynamicBackground() {
    const bgContainer = document.getElementById('dynamic-bg');
    bgContainer.innerHTML = '';
    if (backgroundImages.length === 0) backgroundImages = [fallbackImg];

    let bag = [];
    function refillBag() { bag = shuffleArray([...backgroundImages]); }
    function drawNext(lastImg) {
        if (bag.length === 0) refillBag();
        if (bag[bag.length - 1] === lastImg && bag.length > 1) {
            [bag[bag.length - 1], bag[bag.length - 2]] = [bag[bag.length - 2], bag[bag.length - 1]];
        }
        return bag.pop();
    }

    for (let i = 0; i < 15; i++) {
        const col = document.createElement('div');
        col.className = 'bg-column';
        let colHtml = '';
        let lastImg = null;
        for (let j = 0; j < 20; j++) {
            const imgUrl = drawNext(lastImg);
            lastImg = imgUrl;
            colHtml += `<img src="${imgUrl}" onerror="this.onerror=null; this.src='${fallbackImg}'">`;
        }
        col.innerHTML = colHtml;
        bgContainer.appendChild(col);
    }
}
loadBackgroundImages();

// ==========================================
// 3. PROFIL / XP / SZINT / JELVÉNY RENDSZER
// ==========================================
const PROFILE_STORAGE_KEY = 'songuess_profile_v1';

function pad2(n) { return String(n).padStart(2, '0'); }
function getDateStr(d) { return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`; }

function defaultProfile() {
    return {
        xp: 0, gamesPlayed: 0, totalCorrect: 0, totalWrong: 0, totalFlawless: 0,
        bestStreakEver: 0, hardcoreWins: 0, perfectGames: 0,
        dailyStreakCurrent: 0, dailyStreakBest: 0, lastDailyDateStr: null, lastDailyResult: null,
        categoriesPlayed: [], badges: []
    };
}

function loadProfile() {
    try {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        if (!raw) return defaultProfile();
        const parsed = JSON.parse(raw);
        return Object.assign(defaultProfile(), parsed);
    } catch (e) {
        return defaultProfile();
    }
}

function saveProfile(profile) {
    try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
        console.warn('Nem sikerült menteni a profilt (localStorage nem elérhető).', e);
    }
    // Ha be van jelentkezve a felhasználó, a mentés a felhőbe is elmegy (best-effort, a háttérben).
    if (typeof firebaseEnabled !== 'undefined' && firebaseEnabled && currentUser) {
        pushCloudProfile(currentUser.uid, profile);
    }
}

// ==========================================
// 3b. FIÓK / BEJELENTKEZÉS / FELHŐ-SZINKRON (Firebase)
// ==========================================
let currentUser = null; // firebase.User | null — vendég módban null marad

// Két profil (helyi + felhő) összefésülése úgy, hogy sose vesszen el haladás:
// minden számlálóból a nagyobbat tartjuk meg, a listákat (jelvények, kategóriák) egyesítjük,
// a napi kihívás állapotát pedig aszerint, melyik a frissebb dátumú.
function mergeProfiles(local, cloud) {
    if (!cloud) return local;
    if (!local) return cloud;

    const merged = {
        xp: Math.max(local.xp || 0, cloud.xp || 0),
        gamesPlayed: Math.max(local.gamesPlayed || 0, cloud.gamesPlayed || 0),
        totalCorrect: Math.max(local.totalCorrect || 0, cloud.totalCorrect || 0),
        totalWrong: Math.max(local.totalWrong || 0, cloud.totalWrong || 0),
        totalFlawless: Math.max(local.totalFlawless || 0, cloud.totalFlawless || 0),
        bestStreakEver: Math.max(local.bestStreakEver || 0, cloud.bestStreakEver || 0),
        hardcoreWins: Math.max(local.hardcoreWins || 0, cloud.hardcoreWins || 0),
        perfectGames: Math.max(local.perfectGames || 0, cloud.perfectGames || 0),
        categoriesPlayed: [...new Set([...(local.categoriesPlayed || []), ...(cloud.categoriesPlayed || [])])],
        badges: [...new Set([...(local.badges || []), ...(cloud.badges || [])])],
        username: cloud.username || local.username
    };

    // A napi sorozat és a napi eredmény attól függ, melyik oldalon frissebb a dátum
    const localDate = local.lastDailyDateStr || '';
    const cloudDate = cloud.lastDailyDateStr || '';
    if (localDate >= cloudDate) {
        merged.dailyStreakCurrent = local.dailyStreakCurrent || 0;
        merged.lastDailyDateStr = local.lastDailyDateStr || null;
        merged.lastDailyResult = local.lastDailyResult || null;
    } else {
        merged.dailyStreakCurrent = cloud.dailyStreakCurrent || 0;
        merged.lastDailyDateStr = cloud.lastDailyDateStr || null;
        merged.lastDailyResult = cloud.lastDailyResult || null;
    }
    merged.dailyStreakBest = Math.max(local.dailyStreakBest || 0, cloud.dailyStreakBest || 0);

    return Object.assign(defaultProfile(), merged);
}

async function pullCloudProfile(uid) {
    if (!firestoreDb) return null;
    try {
        const doc = await firestoreDb.collection('users').doc(uid).get();
        return doc.exists ? doc.data() : null;
    } catch (e) {
        console.warn('Nem sikerült lekérni a felhő-profilt:', e);
        return null;
    }
}

async function pushCloudProfile(uid, profile) {
    if (!firestoreDb) return;
    try {
        await firestoreDb.collection('users').doc(uid).set(profile);
    } catch (e) {
        console.warn('Nem sikerült elmenteni a profilt a felhőbe:', e);
    }
}

// Bejelentkezéskor: helyi + felhő profil összefésülése, majd mindkét helyre visszaírás
async function syncOnLogin(user) {
    syncStatusMsg.textContent = 'Szinkronizálás...';
    const local = loadProfile();
    const cloud = await pullCloudProfile(user.uid);
    const merged = mergeProfiles(local, cloud);
    saveProfile(merged); // localStorage + (mivel currentUser már be van állítva) felhő is
    syncStatusMsg.textContent = '✅ Szinkronizálva';
    refreshHomeUI();
}

function friendlyAuthError(error) {
    const map = {
        'auth/email-already-in-use': 'Ez az email cím már foglalt — próbálj bejelentkezni helyette.',
        'auth/invalid-email': 'Érvénytelen email cím formátum.',
        'auth/weak-password': 'A jelszónak legalább 6 karakter hosszúnak kell lennie.',
        'auth/wrong-password': 'Hibás jelszó.',
        'auth/user-not-found': 'Nincs ilyen email címmel regisztrált fiók.',
        'auth/invalid-credential': 'Hibás email cím vagy jelszó.',
        'auth/too-many-requests': 'Túl sok próbálkozás — várj egy kicsit, majd próbáld újra.',
        'auth/popup-closed-by-user': 'A bejelentkezési ablak bezáródott, mielőtt befejeződött volna.',
        'auth/network-request-failed': 'Hálózati hiba — ellenőrizd az internetkapcsolatot.'
    };
    return map[error.code] || 'Hiba történt: ' + error.message;
}

function updateAccountUI() {
    if (!accountLoggedOut) return; // ha nincs Firebase bekötve, ezek az elemek nincsenek is kezelve
    if (currentUser) {
        accountLoggedOut.classList.add('hidden');
        accountLoggedIn.classList.remove('hidden');
        accountEmailDisplay.textContent = currentUser.email || currentUser.displayName || 'Bejelentkezve';
    } else {
        accountLoggedOut.classList.remove('hidden');
        accountLoggedIn.classList.add('hidden');
        syncStatusMsg.textContent = '';
    }
}

// --- Szint / XP görbe ---
function xpForNextLevel(level) { return 150 + (level - 1) * 100; }

const RANK_TITLES = [
    { min: 1, title: "Fülhallgatós Újonc", icon: "🎧" },
    { min: 3, title: "Refrén Vadász", icon: "🎵" },
    { min: 5, title: "Dallam Detektív", icon: "🔍" },
    { min: 8, title: "Ritmus Mester", icon: "🥁" },
    { min: 12, title: "Zenei Guru", icon: "🧠" },
    { min: 16, title: "Legendás Fül", icon: "👑" },
    { min: 20, title: "Songguess Ikon", icon: "🌟" },
];
function rankTitleForLevel(level) {
    let current = RANK_TITLES[0];
    for (const r of RANK_TITLES) { if (level >= r.min) current = r; }
    return current;
}
function getLevelInfo(totalXp) {
    let level = 1;
    let remaining = totalXp;
    while (remaining >= xpForNextLevel(level)) {
        remaining -= xpForNextLevel(level);
        level++;
    }
    return { level, xpIntoLevel: remaining, xpNeeded: xpForNextLevel(level), title: rankTitleForLevel(level) };
}

const STEP_XP_TABLE = [100, 85, 70, 55, 40, 25];
function xpForRound(isWin, isFlawless, step) {
    if (!isWin) return 5;
    let base = STEP_XP_TABLE[step] ?? 25;
    if (isFlawless) base += 50;
    return base;
}

// --- Jelvények ---
const BADGES = [
    { id: 'first_win', icon: '🥇', name: 'Első Találat', desc: 'Találd el az első számot!' },
    { id: 'flawless_5', icon: '⚡', name: 'Ötös Fogás', desc: 'Érj el 5 flawless találatot összesen.' },
    { id: 'streak_10', icon: '🔥', name: 'Tűzcsóva', desc: 'Érj el 10-es combót egy játékon belül.' },
    { id: 'daily_3', icon: '📅', name: 'Kitartó', desc: 'Játssz Napi Kihívást 3 egymást követő napon.' },
    { id: 'daily_7', icon: '🗓️', name: 'Egy Hetes Menetrend', desc: 'Játssz Napi Kihívást 7 egymást követő napon.' },
    { id: 'category_explorer', icon: '🧭', name: 'Zenei Felfedező', desc: 'Próbáld ki mind a 12 kategóriát.' },
    { id: 'hundred_correct', icon: '💯', name: 'Százas', desc: 'Érj el összesen 100 helyes találatot.' },
    { id: 'hardcore_win', icon: '☠️', name: 'Vér és Verejték', desc: 'Nyerj egy kört Hardcore módban.' },
    { id: 'perfect_game', icon: '🏆', name: 'Tökéletes Kazetta', desc: 'Legyen flawless minden köröd egy játékban.' },
];

function checkAndAwardBadges(profile, eventFlags = {}) {
    const newly = [];
    const unlock = (id) => { if (!profile.badges.includes(id)) { profile.badges.push(id); newly.push(id); } };
    if (profile.totalCorrect >= 1) unlock('first_win');
    if (profile.totalFlawless >= 5) unlock('flawless_5');
    if (profile.bestStreakEver >= 10) unlock('streak_10');
    if (profile.dailyStreakCurrent >= 3) unlock('daily_3');
    if (profile.dailyStreakCurrent >= 7) unlock('daily_7');
    if (profile.categoriesPlayed.length >= 12) unlock('category_explorer');
    if (profile.totalCorrect >= 100) unlock('hundred_correct');
    if (eventFlags.hardcoreWin) unlock('hardcore_win');
    if (eventFlags.perfectGame) unlock('perfect_game');
    return newly;
}

// --- Napi Kihívás: determinisztikus seed és kategória-rotáció ---
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function getDailySeedNumber() {
    const dateStr = getDateStr(new Date());
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) seed = (seed * 31 + dateStr.charCodeAt(i)) | 0;
    return seed;
}
const DAILY_CATEGORY_ORDER = Object.keys(CATEGORY_TERMS);
function getDailyCategory() {
    const d = new Date();
    const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    return DAILY_CATEGORY_ORDER[dayOfYear % DAILY_CATEGORY_ORDER.length];
}

function roundEmoji(r) {
    if (!r.win) return '🟥';
    if (r.flawless) return '🟩';
    if (r.step <= 2) return '🟨';
    return '🟧';
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch (e2) {
            return false;
        }
    }
}

// ==========================================
// 4. JÁTÉK VÁLTOZÓK ÉS DOM ELEMEK
// ==========================================
const successSound = new Audio("data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
successSound.volume = 0.5;

let config = { username: "Játékos", rounds: 5, timeLimit: 0, volume: 0.5, category: "all", mode: "classic", hardcore: false, isDaily: false };
let stats = { correct: 0, wrong: 0, maxStreak: 0 };
let currentRoundNum = 1;
let currentStreak = 0;
let currentSong = null;
let correctAnswerFull = "";
let choiceLocked = false;
let usedSongIds = new Set();
let roundResults = [];
let sessionFlawlessCount = 0;
let dailyRngInstance = null;

const homeScreen = document.getElementById('home-screen');
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const statsScreen = document.getElementById('stats-screen');
const profileScreen = document.getElementById('profile-screen');

const categoryInput = document.getElementById('category-input');
const volumeInput = document.getElementById('volume-input');
const volumeLabel = document.getElementById('volume-label');
const inGameVolumeInput = document.getElementById('in-game-volume-input');
const hardcoreInput = document.getElementById('hardcore-input');
const startGameBtn = document.getElementById('start-game-btn');
const audioPlayer = document.getElementById('audio-player');
const playBtn = document.getElementById('play-btn');
const skipBtn = document.getElementById('skip-btn');
const submitBtn = document.getElementById('submit-btn');
const guessInput = document.getElementById('guess-input');
const autocompleteList = document.getElementById('autocomplete-list');
const messageDisplay = document.getElementById('message-display');
const timeDisplay = document.getElementById('time-display');
const audioProgressFill = document.getElementById('audio-progress-fill');
const roundCounterDisplay = document.getElementById('round-counter-display');
const countdownDisplay = document.getElementById('countdown-display');
const streakDisplay = document.getElementById('streak-display');
const hardcoreBadge = document.getElementById('hardcore-badge');
const dailyModeBadge = document.getElementById('daily-mode-badge');
const cassette = document.getElementById('cassette-visualizer');
const modalOverlay = document.getElementById('result-modal');
const modalBox = document.getElementById('modal-content');
const resultCover = document.getElementById('result-cover');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const nextRoundBtn = document.getElementById('next-round-btn');
const backArrowBtn = document.getElementById('back-arrow-btn');
const confirmModal = document.getElementById('confirm-modal');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmLeaveBtn = document.getElementById('confirm-leave-btn');
const classicInputArea = document.getElementById('classic-input-area');
const choiceInputArea = document.getElementById('choice-input-area');

const goSetupBtn = document.getElementById('go-setup-btn');
const setupBackBtn = document.getElementById('setup-back-btn');
const dailyStartBtn = document.getElementById('daily-start-btn');
const dailyDoneArea = document.getElementById('daily-done-area');
const dailyDoneEmojis = document.getElementById('daily-done-emojis');
const dailyDoneScore = document.getElementById('daily-done-score');
const dailyShareAgainBtn = document.getElementById('daily-share-again-btn');
const dailyCategoryLabel = document.getElementById('daily-category-label');
const dailyStreakFlame = document.getElementById('daily-streak-flame');
const profileChipBtn = document.getElementById('profile-chip-btn');
const profileChipIcon = document.getElementById('profile-chip-icon');
const profileChipLevel = document.getElementById('profile-chip-level');
const profileBackBtn = document.getElementById('profile-back-btn');

const statsTitle = document.getElementById('stats-title');
const statsShareGrid = document.getElementById('stats-share-grid');
const statXp = document.getElementById('stat-xp');
const levelUpBanner = document.getElementById('level-up-banner');
const badgeUnlockArea = document.getElementById('badge-unlock-area');
const shareResultBtn = document.getElementById('share-result-btn');
const shareResultMsg = document.getElementById('share-result-msg');
const backToHomeBtn = document.getElementById('back-to-home-btn');

const profileLevelNum = document.getElementById('profile-level-num');
const profileRankIcon = document.getElementById('profile-rank-icon');
const profileRankTitle = document.getElementById('profile-rank-title');
const profileXpBarFill = document.getElementById('profile-xp-bar-fill');
const profileXpText = document.getElementById('profile-xp-text');
const profileGames = document.getElementById('profile-games');
const profileCorrect = document.getElementById('profile-correct');
const profileBestStreak = document.getElementById('profile-best-streak');
const profileDailyStreak = document.getElementById('profile-daily-streak');
const badgeGrid = document.getElementById('badge-grid');

// Fiók / bejelentkezés DOM elemek
const accountLoggedOut = document.getElementById('account-logged-out');
const accountLoggedIn = document.getElementById('account-logged-in');
const authModeLogin = document.getElementById('auth-mode-login');
const authModeSignup = document.getElementById('auth-mode-signup');
const authEmailInput = document.getElementById('auth-email-input');
const authPasswordInput = document.getElementById('auth-password-input');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const googleSigninBtn = document.getElementById('google-signin-btn');
const authErrorMsg = document.getElementById('auth-error-msg');
const accountEmailDisplay = document.getElementById('account-email-display');
const syncStatusMsg = document.getElementById('sync-status-msg');
const signOutBtn = document.getElementById('sign-out-btn');

const timeIntervals = [0.5, 1, 2, 4, 8, 15];
let currentStep = 0;
let isPlaying = false;
let animationFrameId;
let countdownInterval;
let remainingGuessTime = 0;

// ==========================================
// 5. KÉPERNYŐVÁLTÁS
// ==========================================
const ALL_SCREENS = [homeScreen, setupScreen, gameScreen, statsScreen, profileScreen];
function showScreen(screenElement) {
    ALL_SCREENS.forEach(s => s.classList.remove('active'));
    screenElement.classList.add('active');
}

function updateVolume(val) {
    const vol = val / 100;
    audioPlayer.volume = vol;
    config.volume = vol;
    volumeInput.value = val;
    inGameVolumeInput.value = val;
    volumeLabel.textContent = `${val}%`;
}
volumeInput.addEventListener('input', (e) => updateVolume(e.target.value));
inGameVolumeInput.addEventListener('input', (e) => updateVolume(e.target.value));

// ==========================================
// 6. KEZDŐLAP RENDERELÉSE
// ==========================================
function refreshHomeUI() {
    const profile = loadProfile();
    const todayStr = getDateStr(new Date());
    const alreadyPlayed = profile.lastDailyDateStr === todayStr;
    const catKey = getDailyCategory();

    dailyCategoryLabel.textContent = CATEGORY_LABELS[catKey] || catKey;
    dailyStreakFlame.textContent = `🔥 ${profile.dailyStreakCurrent}`;

    if (alreadyPlayed && profile.lastDailyResult) {
        dailyStartBtn.classList.add('hidden');
        dailyDoneArea.classList.remove('hidden');
        dailyDoneEmojis.textContent = profile.lastDailyResult.emojis.join(' ');
        dailyDoneScore.textContent = `${profile.lastDailyResult.correct}/${profile.lastDailyResult.total} helyes — ${profile.lastDailyResult.categoryLabel}`;
    } else {
        dailyStartBtn.classList.remove('hidden');
        dailyDoneArea.classList.add('hidden');
    }

    const levelInfo = getLevelInfo(profile.xp);
    profileChipLevel.textContent = levelInfo.level;
    profileChipIcon.textContent = levelInfo.title.icon;
}

goSetupBtn.addEventListener('click', () => showScreen(setupScreen));
setupBackBtn.addEventListener('click', () => showScreen(homeScreen));
profileChipBtn.addEventListener('click', () => { renderProfileScreen(); showScreen(profileScreen); });
profileBackBtn.addEventListener('click', () => { refreshHomeUI(); showScreen(homeScreen); });
backToHomeBtn.addEventListener('click', () => { refreshHomeUI(); generateDynamicBackground(); showScreen(homeScreen); });

dailyShareAgainBtn.addEventListener('click', async () => {
    const profile = loadProfile();
    if (!profile.lastDailyResult) return;
    const r = profile.lastDailyResult;
    const text = `Songguess Napi Kihívás 🎧 (${r.categoryLabel})\n${r.emojis.join(' ')}\n${r.correct}/${r.total} helyes\n🔥 ${profile.dailyStreakCurrent} napos sorozat`;
    const ok = await copyToClipboard(text);
    dailyShareAgainBtn.textContent = ok ? '✅ Vágólapra másolva!' : '⚠️ Másolás sikertelen';
    setTimeout(() => { dailyShareAgainBtn.textContent = '📋 Eredmény másolása'; }, 2000);
});

// ==========================================
// 7. JÁTÉK INDÍTÁSA (Egyéni és Napi)
// ==========================================
function resetSessionState() {
    stats = { correct: 0, wrong: 0, maxStreak: 0 };
    currentRoundNum = 1;
    currentStreak = 0;
    usedSongIds = new Set();
    roundResults = [];
    sessionFlawlessCount = 0;
    streakDisplay.classList.add('hidden');
    updateVolume(volumeInput.value);
}

startGameBtn.addEventListener('click', async () => {
    config.username = document.getElementById('username-input').value || "Játékos";
    config.rounds = parseInt(document.getElementById('rounds-input').value) || 5;
    config.timeLimit = parseInt(document.getElementById('time-limit-input').value) || 0;
    config.category = categoryInput.value;
    config.mode = document.querySelector('input[name="game-mode"]:checked').value;
    config.hardcore = hardcoreInput.checked;
    config.isDaily = false;
    dailyRngInstance = null;

    resetSessionState();

    hardcoreBadge.classList.toggle('hidden', !config.hardcore);
    dailyModeBadge.classList.add('hidden');
    skipBtn.classList.toggle('hidden', config.hardcore);

    showScreen(gameScreen);
    playBtn.disabled = true; skipBtn.disabled = true; submitBtn.disabled = true; guessInput.disabled = true;
    await startRound();
});

dailyStartBtn.addEventListener('click', async () => {
    const profile = loadProfile();
    const todayStr = getDateStr(new Date());
    if (profile.lastDailyDateStr === todayStr) { refreshHomeUI(); return; }

    config.username = profile.username || "Játékos";
    config.category = getDailyCategory();
    config.mode = 'classic';
    config.hardcore = false;
    config.timeLimit = 0;
    config.rounds = 5;
    config.isDaily = true;
    dailyRngInstance = mulberry32(getDailySeedNumber());

    resetSessionState();

    hardcoreBadge.classList.add('hidden');
    dailyModeBadge.classList.remove('hidden');
    dailyModeBadge.textContent = `📅 NAPI KIHÍVÁS · ${CATEGORY_LABELS[config.category]}`;
    skipBtn.classList.remove('hidden');

    showScreen(gameScreen);
    playBtn.disabled = true; skipBtn.disabled = true; submitBtn.disabled = true; guessInput.disabled = true;
    await startRound();
});

// ==========================================
// 8. KÖR LOGIKA
// ==========================================
async function startRound() {
    currentStep = 0;
    guessInput.value = '';
    choiceLocked = false;
    cassette.classList.remove('spinning');
    autocompleteList.innerHTML = '';

    const isChoiceMode = config.mode === 'choice';
    classicInputArea.classList.toggle('hidden', isChoiceMode);
    choiceInputArea.classList.toggle('hidden', !isChoiceMode);
    submitBtn.classList.toggle('hidden', isChoiceMode);
    choiceInputArea.innerHTML = '';

    messageDisplay.textContent = 'Kazetta tekerése az Apple szervereiről...';
    messageDisplay.style.color = "var(--gold)";

    const rng = (config.isDaily && dailyRngInstance) ? dailyRngInstance : Math.random;
    currentSong = await getRandomSongFromiTunes(config.category, usedSongIds, rng);

    if (!currentSong) {
        messageDisplay.textContent = 'Elfogytak az egyedi számok ebben a kategóriában! Próbálj másik kategóriát vagy kevesebb kört.';
        messageDisplay.style.color = "var(--danger)";
        return;
    }

    usedSongIds.add(currentSong.id);
    correctAnswerFull = `${currentSong.artist} - ${currentSong.title}`.toLowerCase();

    if (isChoiceMode) {
        const distractors = await getDistractorOptions(currentSong, config.category);
        const options = shuffleArray([`${currentSong.artist} - ${currentSong.title}`, ...distractors]);
        renderChoices(options);
    }

    playBtn.disabled = false;
    skipBtn.disabled = config.hardcore ? true : false;
    submitBtn.disabled = false;
    guessInput.disabled = false;

    messageDisplay.textContent = '';
    audioPlayer.src = currentSong.src;
    playBtn.textContent = "▶ Lejátszás";
    audioProgressFill.style.width = "0%";
    roundCounterDisplay.textContent = `${currentRoundNum}. Kör / ${config.rounds}`;

    clearInterval(countdownInterval);
    if (config.timeLimit > 0) {
        remainingGuessTime = config.timeLimit;
        countdownDisplay.classList.remove('hidden');
        countdownDisplay.textContent = `⏱️ ${remainingGuessTime}s`;
        countdownDisplay.style.color = "";
        countdownInterval = setInterval(() => {
            remainingGuessTime--;
            countdownDisplay.textContent = `⏱️ ${remainingGuessTime}s`;
            if (remainingGuessTime <= 10) countdownDisplay.style.color = "var(--danger)";
            if (remainingGuessTime <= 0) {
                clearInterval(countdownInterval);
                endRound(false, "Lejárt az idő!");
            }
        }, 1000);
    } else {
        countdownDisplay.classList.add('hidden');
    }
    updateUI();
}

function renderChoices(options) {
    choiceInputArea.innerHTML = '';
    options.forEach(optionText => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = optionText;
        btn.addEventListener('click', () => handleChoiceClick(btn, optionText));
        choiceInputArea.appendChild(btn);
    });
}

function handleChoiceClick(btn, optionText) {
    if (choiceLocked) return;
    choiceLocked = true;
    skipBtn.disabled = true;

    const isCorrect = optionText.toLowerCase() === correctAnswerFull;
    const allButtons = choiceInputArea.querySelectorAll('.choice-btn');
    allButtons.forEach(b => {
        b.disabled = true;
        if (b.textContent.toLowerCase() === correctAnswerFull) b.classList.add('correct');
    });
    if (!isCorrect) btn.classList.add('wrong');

    if (isCorrect) {
        if (currentStep === 0) endRound(true, "FLAWLESS! 🔥 Telitalálat!", true);
        else endRound(true, "Gratulálok, eltaláltad!");
    } else {
        setTimeout(() => endRound(false, "Nem talált — de ez van, jöhet a következő!"), 700);
    }
}

function formatTime(seconds) {
    const secs = Math.floor(seconds);
    const ms = Math.floor((seconds - secs) * 10);
    return `0:${secs < 10 ? '0' : ''}${secs}.${ms}`;
}

function updateUI() {
    const currentLimit = timeIntervals[currentStep];
    timeDisplay.textContent = `${formatTime(audioPlayer.currentTime)} / ${formatTime(currentLimit)}`;
    for (let i = 0; i <= 5; i++) {
        const step = document.getElementById(`step-${i}`);
        if (i <= currentStep) step.classList.add('active');
        else step.classList.remove('active');
    }
}

function animateProgress() {
    if (isPlaying) {
        const currentTime = audioPlayer.currentTime;
        const currentLimit = timeIntervals[currentStep];
        audioProgressFill.style.width = `${(currentTime / 15) * 100}%`;
        timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(currentLimit)}`;
        if (currentTime >= currentLimit) {
            audioPlayer.pause();
            audioPlayer.currentTime = currentLimit;
            isPlaying = false;
            cassette.classList.remove('spinning');
            playBtn.textContent = "▶ Újrahallgatás";
        }
    }
    animationFrameId = requestAnimationFrame(animateProgress);
}
requestAnimationFrame(animateProgress);

playBtn.addEventListener('click', () => {
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        cassette.classList.remove('spinning');
        playBtn.textContent = "▶ Folytatás";
        return;
    }
    if (audioPlayer.currentTime >= timeIntervals[currentStep]) audioPlayer.currentTime = 0;
    audioPlayer.play();
    isPlaying = true;
    cassette.classList.add('spinning');
    playBtn.textContent = "⏸ Szünet";
});

function advanceGame() {
    if (config.hardcore) return;
    if (currentStep < timeIntervals.length - 1) {
        currentStep++;
        updateUI();
        messageDisplay.textContent = "+ Időkeret feloldva";
        messageDisplay.style.color = "var(--gold)";
        guessInput.value = '';
    } else {
        endRound(false, "Sajnos nem sikerült!");
    }
}
skipBtn.addEventListener('click', advanceGame);

submitBtn.addEventListener('click', () => {
    const guess = guessInput.value.trim().toLowerCase();
    if (!guess) return;
    if (correctAnswerFull.includes(guess) || guess.includes(correctAnswerFull)) {
        if (currentStep === 0) endRound(true, "FLAWLESS! 🔥 Telitalálat!", true);
        else endRound(true, "Gratulálok, eltaláltad!");
    } else if (config.hardcore) {
        endRound(false, "Rossz tipp — Hardcore mód!");
    } else {
        advanceGame();
    }
});

// ==========================================
// 9. KÖR VÉGE
// ==========================================
function endRound(isWin, msgText, isFlawless = false) {
    isPlaying = false;
    audioPlayer.pause();
    cassette.classList.remove('spinning');
    clearInterval(countdownInterval);

    skipBtn.disabled = true;
    submitBtn.disabled = true;
    guessInput.disabled = true;
    autocompleteList.innerHTML = '';
    choiceInputArea.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

    roundResults.push({ win: isWin, step: currentStep, flawless: !!isFlawless });
    if (isWin && isFlawless) sessionFlawlessCount++;

    modalBox.className = 'modal-box p-4 p-md-5 rounded-4 shadow-lg text-center';

    if (isWin) {
        stats.correct++;
        currentStreak++;
        if (currentStreak > stats.maxStreak) stats.maxStreak = currentStreak;

        successSound.currentTime = 0;
        successSound.play().catch(e => console.log(e));

        streakDisplay.classList.remove('hidden');
        streakDisplay.textContent = `🔥 Streak: ${currentStreak}`;
        streakDisplay.classList.remove('combo-pop');
        void streakDisplay.offsetWidth;
        streakDisplay.classList.add('combo-pop');

        if (isFlawless) modalBox.classList.add('flawless-state');
        else modalBox.classList.add('win-state');
    } else {
        stats.wrong++;
        currentStreak = 0;
        streakDisplay.classList.add('hidden');
        modalBox.classList.add('lose-state');
    }

    resultCover.onerror = function () { this.onerror = null; this.src = fallbackImg; };
    resultCover.src = currentSong.cover;
    resultTitle.textContent = `${currentSong.artist} - ${currentSong.title}`;
    resultMessage.textContent = msgText;
    nextRoundBtn.textContent = (currentRoundNum >= config.rounds) ? "Statisztikák mutatása" : "Következő kör";
    setTimeout(() => { modalOverlay.classList.add('show'); }, 300);
}

nextRoundBtn.addEventListener('click', async () => {
    modalOverlay.classList.remove('show');
    if (currentRoundNum >= config.rounds) {
        showStats();
    } else {
        currentRoundNum++;
        playBtn.disabled = true; skipBtn.disabled = true; submitBtn.disabled = true; guessInput.disabled = true;
        await startRound();
    }
});

// ==========================================
// 10. STATISZTIKA / PROFIL FRISSÍTÉS / MEGOSZTÁS
// ==========================================
function showStats() {
    const profile = loadProfile();
    const xpBefore = profile.xp;
    const levelBefore = getLevelInfo(xpBefore).level;

    profile.gamesPlayed += 1;
    profile.totalCorrect += stats.correct;
    profile.totalWrong += stats.wrong;
    profile.totalFlawless += sessionFlawlessCount;
    profile.bestStreakEver = Math.max(profile.bestStreakEver, stats.maxStreak);
    if (!profile.categoriesPlayed.includes(config.category)) profile.categoriesPlayed.push(config.category);

    let sessionXp = 0;
    roundResults.forEach(r => { sessionXp += xpForRound(r.win, r.flawless, r.step); });
    if (config.isDaily) sessionXp += 50; // napi kihívás teljesítési bónusz
    profile.xp += sessionXp;

    const eventFlags = {};
    if (config.hardcore && stats.correct > 0) { profile.hardcoreWins += 1; eventFlags.hardcoreWin = true; }
    const isPerfectGame = stats.correct === config.rounds && sessionFlawlessCount === config.rounds;
    if (isPerfectGame) { profile.perfectGames += 1; eventFlags.perfectGame = true; }

    if (config.isDaily) {
        const todayStr = getDateStr(new Date());
        const yestStr = getDateStr(new Date(Date.now() - 86400000));
        if (profile.lastDailyDateStr !== todayStr) {
            profile.dailyStreakCurrent = (profile.lastDailyDateStr === yestStr) ? profile.dailyStreakCurrent + 1 : 1;
            if (profile.dailyStreakCurrent > profile.dailyStreakBest) profile.dailyStreakBest = profile.dailyStreakCurrent;
            profile.lastDailyDateStr = todayStr;
        }
        profile.lastDailyResult = {
            dateStr: profile.lastDailyDateStr,
            categoryKey: config.category,
            categoryLabel: CATEGORY_LABELS[config.category] || config.category,
            emojis: roundResults.map(roundEmoji),
            correct: stats.correct,
            total: config.rounds
        };
    }
    profile.username = config.username;

    const newBadges = checkAndAwardBadges(profile, eventFlags);
    saveProfile(profile);

    const levelAfter = getLevelInfo(profile.xp).level;

    // --- UI render ---
    statsTitle.textContent = config.isDaily ? "NAPI KIHÍVÁS" : "JÁTÉK VÉGE";
    document.getElementById('stats-username').textContent = config.username;
    statsShareGrid.textContent = roundResults.map(roundEmoji).join(' ');
    document.getElementById('stat-total').textContent = config.rounds;
    document.getElementById('stat-correct').textContent = stats.correct;
    document.getElementById('stat-max-streak').textContent = `${stats.maxStreak} 🔥`;
    statXp.textContent = `+${sessionXp} XP`;

    let acc = Math.round((stats.correct / config.rounds) * 100);
    document.getElementById('stat-accuracy').textContent = `${acc}%`;
    document.getElementById('stat-accuracy').style.color = acc >= 50 ? "var(--accent-2)" : "var(--danger)";

    if (levelAfter > levelBefore) {
        const info = getLevelInfo(profile.xp);
        levelUpBanner.textContent = `🎉 Szintet léptél! ${info.title.icon} ${levelAfter}. szint — ${info.title.title}`;
        levelUpBanner.classList.remove('hidden');
    } else {
        levelUpBanner.classList.add('hidden');
    }

    if (newBadges.length > 0) {
        badgeUnlockArea.innerHTML = '<p style="font-weight:700; margin-bottom:8px;">🏅 Új jelvény feloldva!</p>';
        newBadges.forEach(id => {
            const b = BADGES.find(x => x.id === id);
            if (!b) return;
            const el = document.createElement('div');
            el.className = 'badge-unlock-item';
            el.innerHTML = `<span class="icon">${b.icon}</span><span class="info"><strong>${b.name}</strong><small>${b.desc}</small></span>`;
            badgeUnlockArea.appendChild(el);
        });
        badgeUnlockArea.classList.remove('hidden');
    } else {
        badgeUnlockArea.classList.add('hidden');
    }

    shareResultMsg.textContent = '';
    showScreen(statsScreen);
}

shareResultBtn.addEventListener('click', async () => {
    const header = config.isDaily
        ? `Songguess Napi Kihívás 🎧 (${CATEGORY_LABELS[config.category]})`
        : `Songguess Egyéni Játék 🎧 (${CATEGORY_LABELS[config.category] || config.category})`;
    const text = `${header}\n${roundResults.map(roundEmoji).join(' ')}\n${stats.correct}/${config.rounds} helyes`;
    const ok = await copyToClipboard(text);
    shareResultMsg.textContent = ok ? '📋 Vágólapra másolva!' : text;
});

// ==========================================
// 11. VISSZA A KEZDŐLAPRA (kör közben, megerősítéssel)
// ==========================================
function resetGameRuntimeState() {
    isPlaying = false;
    audioPlayer.pause();
    audioPlayer.src = '';
    cassette.classList.remove('spinning');
    clearInterval(countdownInterval);
    clearTimeout(typingTimer);
    autocompleteList.innerHTML = '';
    modalOverlay.classList.remove('show');
    streakDisplay.classList.add('hidden');
    messageDisplay.textContent = '';
}

backArrowBtn.addEventListener('click', () => { confirmModal.classList.add('show'); });
confirmCancelBtn.addEventListener('click', () => { confirmModal.classList.remove('show'); });
confirmLeaveBtn.addEventListener('click', () => {
    confirmModal.classList.remove('show');
    resetGameRuntimeState();
    refreshHomeUI();
    generateDynamicBackground();
    showScreen(homeScreen);
});

// ==========================================
// 12. PROFIL KÉPERNYŐ RENDERELÉSE
// ==========================================
function renderProfileScreen() {
    const profile = loadProfile();
    const levelInfo = getLevelInfo(profile.xp);

    updateAccountUI();

    profileLevelNum.textContent = levelInfo.level;
    profileRankIcon.textContent = levelInfo.title.icon;
    profileRankTitle.textContent = `${levelInfo.title.icon} ${levelInfo.title.title}`;
    profileXpBarFill.style.width = `${Math.min(100, (levelInfo.xpIntoLevel / levelInfo.xpNeeded) * 100)}%`;
    profileXpText.textContent = `${levelInfo.xpIntoLevel} / ${levelInfo.xpNeeded} XP`;

    profileGames.textContent = profile.gamesPlayed;
    profileCorrect.textContent = profile.totalCorrect;
    profileBestStreak.textContent = `${profile.bestStreakEver} 🔥`;
    profileDailyStreak.textContent = `${profile.dailyStreakCurrent} nap (legjobb: ${profile.dailyStreakBest})`;

    badgeGrid.innerHTML = '';
    BADGES.forEach(b => {
        const unlocked = profile.badges.includes(b.id);
        const col = document.createElement('div');
        col.className = 'col';
        const el = document.createElement('div');
        el.className = 'badge-item ' + (unlocked ? 'unlocked' : 'locked');
        el.innerHTML = `<span class="badge-icon">${unlocked ? b.icon : '🔒'}</span><span class="badge-name">${b.name}</span><span class="badge-desc">${b.desc}</span>`;
        col.appendChild(el);
        badgeGrid.appendChild(col);
    });
}

// ==========================================
// 13. AUTOCOMPLETE KERESŐ
// ==========================================
let typingTimer;
guessInput.addEventListener('input', function () {
    clearTimeout(typingTimer);
    const val = this.value;
    autocompleteList.innerHTML = '';
    if (!val) return;
    typingTimer = setTimeout(async () => {
        const results = await searchiTunes(val);
        results.forEach(song => {
            const fullSongText = `${song.artist} - ${song.title}`;
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'autocomplete-item text-white';
            suggestionItem.innerHTML = `
                <img src="${song.cover}" onerror="this.onerror=null; this.src='${fallbackImg}'">
                <div>
                    <span class="fw-bold d-block">${song.title}</span>
                    <span class="small text-secondary">${song.artist}</span>
                </div>
            `;
            suggestionItem.addEventListener('click', function () {
                guessInput.value = fullSongText;
                autocompleteList.innerHTML = '';
            });
            autocompleteList.appendChild(suggestionItem);
        });
    }, 400);
});

document.addEventListener('click', function (e) {
    if (e.target !== guessInput && !autocompleteList.contains(e.target)) autocompleteList.innerHTML = '';
});

// ==========================================
// 14. FIÓK / BEJELENTKEZÉS ESEMÉNYKEZELŐK
// ==========================================
function setAuthMode(mode) {
    authErrorMsg.textContent = '';
    authSubmitBtn.textContent = mode === 'signup' ? 'Regisztráció' : 'Bejelentkezés';
    authPasswordInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
}
if (authModeLogin) {
    authModeLogin.addEventListener('change', () => setAuthMode('login'));
    authModeSignup.addEventListener('change', () => setAuthMode('signup'));

    authSubmitBtn.addEventListener('click', async () => {
        const email = authEmailInput.value.trim();
        const password = authPasswordInput.value;
        authErrorMsg.textContent = '';

        if (!firebaseEnabled) {
            authErrorMsg.textContent = 'A fiók-funkció még nincs beállítva ezen az oldalon (firebase-config.js).';
            return;
        }
        if (!email || !password) {
            authErrorMsg.textContent = 'Add meg az email címed és a jelszavad.';
            return;
        }

        authSubmitBtn.disabled = true;
        try {
            if (authModeSignup.checked) {
                await firebaseAuth.createUserWithEmailAndPassword(email, password);
            } else {
                await firebaseAuth.signInWithEmailAndPassword(email, password);
            }
            authEmailInput.value = '';
            authPasswordInput.value = '';
        } catch (e) {
            authErrorMsg.textContent = friendlyAuthError(e);
        }
        authSubmitBtn.disabled = false;
    });

    googleSigninBtn.addEventListener('click', async () => {
        authErrorMsg.textContent = '';
        if (!firebaseEnabled) {
            authErrorMsg.textContent = 'A fiók-funkció még nincs beállítva ezen az oldalon (firebase-config.js).';
            return;
        }
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            await firebaseAuth.signInWithPopup(provider);
        } catch (e) {
            authErrorMsg.textContent = friendlyAuthError(e);
        }
    });

    signOutBtn.addEventListener('click', async () => {
        try {
            await firebaseAuth.signOut();
        } catch (e) {
            console.warn('Kijelentkezési hiba:', e);
        }
    });

    // Bejelentkezés-állapot figyelése: ez fut le lapbetöltéskor is, és minden
    // be-/kijelentkezéskor. Bejelentkezéskor összefésüli a helyi és felhő-profilt.
    if (firebaseEnabled && firebaseAuth) {
        firebaseAuth.onAuthStateChanged(async (user) => {
            currentUser = user;
            updateAccountUI();
            if (user) {
                await syncOnLogin(user);
            }
        });
    }
}

// ==========================================
// 15. INDÍTÁS
// ==========================================
refreshHomeUI();
