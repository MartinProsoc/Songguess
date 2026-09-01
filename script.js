// ==========================================
// 1. ITUNES API BEÁLLÍTÁSOK
// ==========================================
const CATEGORY_TERMS = {
    magyar: ['azahriah', 'desh', 'halott penz', 'valmar', 'wellhello', 'beton hofi', 'krubi', 'dzsudlo', 'majka', 'punnany massif', 'kowalsky meg a vega', 'vini', 'fura csuka', 'bagossy brothers company'],
    magyar_2020: ['azahriah', 'desh', 'valmar', 'vini', 'fura csuka', 't. danny', 'bagossy brothers company', 'missh', 'byealex es a slepp', 'curtis'],
    magyar_retro: ['korda gyorgy', 'zoran', 'koncz zsuzsa', 'cserhati zsuzsa', 'omega egyuttes', 'locomotiv gt', 'neoton familia', 'hobo blues band', 'presser gabor', 'illes egyuttes'],
    vilagslager: ['the weeknd', 'dua lipa', 'ed sheeran', 'coldplay', 'taylor swift', 'adele', 'bruno mars', 'rihanna'],
    rock_metal: ['queen', 'ac dc', 'metallica', 'guns n roses', 'linkin park', 'nirvana', 'iron maiden', 'red hot chili peppers'],
    hiphop_rap: ['eminem', 'kendrick lamar', 'drake', 'travis scott', 'jay z', 'dr dre', '50 cent', 'kanye west'],
    electronic: ['alan walker', 'avicii', 'david guetta', 'calvin harris', 'marshmello', 'daft punk', 'swedish house mafia', 'martin garrix'],
    jazz_soul: ['frank sinatra', 'ella fitzgerald', 'amy winehouse', 'stevie wonder', 'nina simone', 'ray charles'],
    classical_soundtrack: ['hans zimmer', 'john williams', 'ludovico einaudi', 'mozart', 'beethoven', 'yann tiersen'],
    latin: ['bad bunny', 'shakira', 'enrique iglesias', 'rosalia', 'luis fonsi', 'j balvin'],
    kpop: ['bts', 'blackpink', 'twice', 'stray kids', 'newjeans', 'txt'],
    kulfoldi_retro: ['britney spears', 'backstreet boys', 'spice girls', 'nsync', 'abba', 'michael jackson', 'madonna', 'george michael'],
    gaming: ['hans zimmer', 'league of legends', 'c418 minecraft', 'fifa soundtrack', 'alan walker', 'imagine dragons', 'undertale soundtrack', 'zelda soundtrack'],
    all: ['pop hit 2024', 'top hits', 'rock classic', 'dance music', 'summer hits']
};

const CATEGORY_LABELS = {
    all: "Mindegyik keverve", magyar: "Magyar slágerek", magyar_2020: "Magyar 2020-2026",
    magyar_retro: "Magyar Retro", vilagslager: "Világslágerek (Pop)",
    rock_metal: "Rock & Metal", hiphop_rap: "Hip-Hop & Rap", electronic: "Elektronikus / EDM",
    jazz_soul: "Jazz & Soul", classical_soundtrack: "Klasszikus & Filmzene", latin: "Latin",
    kpop: "K-Pop", kulfoldi_retro: "Külföldi Retro (80's-2000's)", gaming: "Gaming & Sport"
};

const CATEGORY_ICONS = {
    all: "🎧", magyar: "🇭🇺", magyar_2020: "🆕", magyar_retro: "📻", vilagslager: "🌍",
    rock_metal: "🎸", hiphop_rap: "🎤", electronic: "🎛️", jazz_soul: "🎷",
    classical_soundtrack: "🎬", latin: "💃", kpop: "✨", kulfoldi_retro: "📼", gaming: "🎮"
};

// Több kategória is kiválasztható egyszerre (lásd renderCategoryChips) — ez az a
// segédfüggvény, ami a kiválasztott kategória-kulcsokból (vagy egyetlen kulcsból, a Napi
// Kihívás determinisztikus, mindig egyetlen kategóriát használ) összefésüli a lekérdezési
// kulcsszavakat, ismétlés nélkül.
function resolveCategoryTerms(categories) {
    const keys = Array.isArray(categories) ? categories : [categories];
    const validKeys = keys.filter(k => CATEGORY_TERMS[k]);
    const useKeys = validKeys.length ? validKeys : ['all'];
    const merged = [];
    useKeys.forEach(k => merged.push(...CATEGORY_TERMS[k]));
    return [...new Set(merged)];
}

function categoryLabelFor(categories) {
    const keys = Array.isArray(categories) ? categories : [categories];
    if (keys.length === 0) return CATEGORY_LABELS.all;
    return keys.map(k => CATEGORY_LABELS[k] || k).join(' + ');
}

const fallbackImg = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='100%25' height='100%25' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23555' font-family='sans-serif' font-size='40'%3E%E2%99%AB%3C/text%3E%3C/svg%3E";

// Az iTunes Search API alapértelmezés szerint az amerikai áruház katalógusát adja vissza
// (country param nélkül), ami két külön hibát is okozott:
//   1) egy magyar előadó (pl. Valmar) dala simán elveszett egy azonos című, sokkal
//      nagyobb (klasszikus/latin) nemzetközi katalógusú szám mellett — a "valencia"
//      keresésre az amerikai áruházból Valmar egyáltalán nem is szerepelt az első 25
//      találat között, a magyar (hu) áruházból viszont az 1. helyen jött ki;
//   2) egy magyar előadó neve összekeveredett egy hasonló nevű külföldi előadóval — a
//      "zoran" kulcsszóra az amerikai áruház egy horvát klasszikus gitárművészt (Zoran
//      Dukić) is behozott Zorán (a magyar énekes) helyett/mellett, a magyar áruházból
//      viszont mind a 15 találat kizárólag Zorántól jött.
// Mindkettőt élőben leteszteltem (lásd a beszélgetés jegyzeteit) — a magyar (hu) áruházra
// váltás mindkét esetet megoldja, és a nemzetközi kategóriák katalógusa (K-pop, Latin stb.)
// is ugyanolyan teljes marad rajta keresztül, tehát nincs hátránya.
const ITUNES_COUNTRY = 'hu';

function shuffleArray(arr, rng = Math.random) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Egy kulcsszóra (pl. "curtis") NEM elég, hogy valahol RÉSZKÉNT szerepeljen az előadó
// mezőben — egy teljesen más, véletlenül hasonló (vezeték)nevű nemzetközi előadó simán
// átcsúszna rajta (pl. "Struggle Jennings & Caitlynne Curtis" a "curtis" kulcsszóra, mert
// az "includes" ellenőrzés bárhol elfogadta a találatot). Ehelyett az előadó mezőt a
// gyakori közreműködés-jelölők (&, feat., ft., x, vessző, "és") mentén szegmensekre
// bontjuk, és csak akkor fogadjuk el a találatot, ha valamelyik TELJES szegmens pontosan
// (ékezet- és kis/nagybetű-függetlenül) megegyezik a keresett kulcsszóval. Így pl.
// "Majka, Curtis & Nika" jó (a "Curtis" önálló szegmens), "Struggle Jennings & Caitlynne
// Curtis" viszont kiesik (ott a "Caitlynne Curtis" egyetlen, oszthatatlan szegmens).
function normalizeForArtistMatch(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
function artistFieldMatchesTerm(artistName, term) {
    const normalizedTerm = normalizeForArtistMatch(term);
    const segments = (artistName || '').split(/,|&|\+|\bfeat\.?\b|\bft\.?\b|\bvs\.?\b|\bx\b| és /i);
    return segments.some(seg => normalizeForArtistMatch(seg) === normalizedTerm);
}

async function getRandomSongFromiTunes(category, excludeIds = new Set(), rng = Math.random) {
    const terms = resolveCategoryTerms(category);
    const shuffledTerms = shuffleArray([...terms], rng);

    for (const term of shuffledTerms) {
        console.log(`Keresés indítása: ${term}...`);
        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=30&country=${ITUNES_COUNTRY}`);
            const data = await response.json();

            const rawTracks = data.results.filter(track => track.previewUrl && !excludeIds.has(track.trackId));
            if (rawTracks.length === 0) {
                console.warn(`"${term}" kulcsszóhoz nincs több egyedi szám ebben a körben, próbálkozás másikkal...`);
                continue;
            }

            // Előnyben részesítjük azokat a találatokat, ahol a kulcsszó ténylegesen (pontos
            // szegmensként) az előadó nevében szerepel — lásd artistFieldMatchesTerm().
            const artistMatches = rawTracks.filter(track => artistFieldMatchesTerm(track.artistName, term));
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
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25&country=${ITUNES_COUNTRY}`);
        const data = await response.json();
        if (!data.results) return [];

        // Az iTunes keresés NEM népszerűség szerint rendez, hanem nyers szöveg-egyezés
        // alapján — emiatt pl. a "valencia" beírására egy évtizedes klasszikus/opera-feldolgozás
        // simán megelőzhet egy mai, ismertebb popszámot, csak mert több hasonló című klasszikus
        // felvétel van a katalógusban. Ezért itt újrarendezzük a nyers találatokat: előnyben
        // részesítjük a pontos cím-/előadó-egyezést, és hátrébb soroljuk a kevésbé "mainstream"
        // (klasszikus/opera/beszélt szöveg jellegű) műfajokat, amikre ritkán gondol a felhasználó,
        // amikor egy zeneszám címét vagy előadóját kezdi el beírni.
        const q = query.trim().toLowerCase();
        const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundaryRe = escapedQ ? new RegExp(`\\b${escapedQ}\\b`) : null;
        const NICHE_GENRES = ['classical', 'vocal', 'opera', 'spoken word', 'comedy', 'holiday', 'easy listening'];

        const scored = data.results.map((track, idx) => {
            const title = (track.trackName || '').toLowerCase();
            const artist = (track.artistName || '').toLowerCase();
            let score = 0;
            if (title === q) score += 50;
            else if (title.startsWith(q)) score += 30;
            else if (wordBoundaryRe && wordBoundaryRe.test(title)) score += 15;
            else if (title.includes(q)) score += 5;
            if (artist.startsWith(q)) score += 20;
            else if (artist.includes(q)) score += 8;
            const genre = (track.primaryGenreName || '').toLowerCase();
            if (NICHE_GENRES.some(g => genre.includes(g))) score -= 35;
            return { track, score, idx };
        });
        scored.sort((a, b) => (b.score - a.score) || (a.idx - b.idx));

        const seen = new Set();
        const ranked = [];
        for (const { track } of scored) {
            const key = `${track.artistName}||${track.trackName}`.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            ranked.push({ artist: track.artistName, title: track.trackName, cover: track.artworkUrl100 });
            if (ranked.length >= 6) break;
        }
        return ranked;
    } catch (error) {
        return [];
    }
}

async function getDistractorOptions(correctSong, category) {
    const terms = shuffleArray(resolveCategoryTerms(category));
    const correctFull = `${correctSong.artist} - ${correctSong.title}`.toLowerCase();

    // Több, EGYMÁSTÓL ELTÉRŐ kulcsszóból húzunk egy-egy találatot (nem csak egyetlen
    // kulcsszóból mind a hármat) — különben a 3 hibás válasz gyakran ugyanabból az
    // előadóból/stílusból jött (pl. mind Minecraft-zene), és a szemmel láthatóan "kilógó"
    // negyedik opció rögtön elárulta, melyik a helyes megfejtés. A lekérdezéseket
    // PÁRHUZAMOSAN indítjuk (nem egymás után várva rájuk), különben a multiplayer "kör
    // előkészítése" fázis (ami körönként hívja ezt) fölöslegesen lelassulna.
    const batchTerms = terms.slice(0, Math.min(5, terms.length));
    const batches = await Promise.all(batchTerms.map(async term => {
        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=15&country=${ITUNES_COUNTRY}`);
            const data = await response.json();
            return (data.results || [])
                .filter(t => t.trackName && t.artistName)
                .map(t => `${t.artistName} - ${t.trackName}`);
        } catch (error) {
            console.error("Hiba a válaszlehetőségek lekérésekor:", error);
            return [];
        }
    }));

    const chosen = [];
    const chosenFull = new Set([correctFull]);
    for (const pool of batches) {
        if (chosen.length >= 3) break;
        const filtered = shuffleArray(pool.filter(full => !chosenFull.has(full.toLowerCase())));
        if (filtered.length === 0) continue;
        chosen.push(filtered[0]);
        chosenFull.add(filtered[0].toLowerCase());
    }
    return chosen;
}

// ==========================================
// 2. ÉLŐ HÁTTÉR GENERÁLÁSA (ismétlés nélkül)
// ==========================================
let backgroundImages = [];

async function loadBackgroundImages() {
    try {
        const res = await fetch(`https://itunes.apple.com/search?term=top+hits&entity=song&limit=200&country=${ITUNES_COUNTRY}`);
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

    // A háttér-konténer -50%/-50%-tól indul, 200% széles/magas, és -20 fokkal el van forgatva.
    // Korábban az oszlopok száma (15) és a soronkénti képek száma (20) fixen be volt drótozva,
    // ezért nagyobb/szélesebb (pl. kiterített vagy ultrawide) ablakban a csempesor nem érte el
    // a tényleges lefedendő területet, és üres sáv maradt a jobb oldalon. Most az ablak tényleges
    // méretéhez igazítjuk mindkét irányban, bőséges tartalékkal a forgatás miatti extra igényre.
    const tileSize = 160, gapSize = 15, step = tileSize + gapSize;
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 1280;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 800;
    const cols = Math.min(40, Math.max(15, Math.ceil((viewportW * 2.3) / step)));
    const rowsPerCol = Math.min(40, Math.max(20, Math.ceil((viewportH * 2.3) / step)));

    for (let i = 0; i < cols; i++) {
        const col = document.createElement('div');
        col.className = 'bg-column';
        let colHtml = '';
        let lastImg = null;
        for (let j = 0; j < rowsPerCol; j++) {
            const imgUrl = drawNext(lastImg);
            lastImg = imgUrl;
            colHtml += `<img src="${imgUrl}" onerror="this.onerror=null; this.src='${fallbackImg}'">`;
        }
        col.innerHTML = colHtml;
        bgContainer.appendChild(col);
    }
}
loadBackgroundImages();

// Ablakméret-változáskor (pl. böngészőablak nagyítása/kiterítése) újrageneráljuk a hátteret,
// hogy mindig teljesen lefedje a látható területet. Debounce-olva, hogy húzás közben ne
// generáljon feleslegesen sokszor.
let bgResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(bgResizeTimer);
    bgResizeTimer = setTimeout(generateDynamicBackground, 350);
});

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
        categoriesPlayed: [], badges: [],
        // A "Kihagyás"-büntetőrendszerhez (lásd 3e. szakasz): élethosszig tartó, összes
        // lejátszott kör / ebből hányban használt Kihagyást — solo, napi és multiplayer
        // körök egyaránt beleszámítanak.
        roundsPlayed: 0, roundsSkipped: 0
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
    // A ranglista-bejegyzés frissítése (leaderboard.js, ami a script.js UTÁN töltődik be) —
    // best-effort, a háttérben; vendégként is bekerül (ugyanaz az anonim Firebase-azonosító,
    // amit a Multiplayer is használ).
    if (typeof pushLeaderboardEntry === 'function') {
        pushLeaderboardEntry(profile);
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
        roundsPlayed: Math.max(local.roundsPlayed || 0, cloud.roundsPlayed || 0),
        roundsSkipped: Math.max(local.roundsSkipped || 0, cloud.roundsSkipped || 0),
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

// ==========================================
// 3c. FELHASZNÁLÓNÉV-SZABÁLYOK (ez a név kerül ki a nyilvános Ranglistára)
// ==========================================
// Mivel a fiókhoz tartozó felhasználónév a Ranglistán (leaderboard.js) mindenki számára
// látható lesz, fiók létrehozásakor kötelező megadni egyet, és átmegy ezen az egyszerű
// szűrőn. FONTOS KORLÁT: ez egy kliensoldali, szótár alapú szűrő — nem tud kiszűrni minden
// kreatív írásmódot (pl. szimbólumokkal tördelt szavakat), de a nyilvánvaló, egyértelműen
// sértő/gyűlöletkeltő eseteket megfogja, mielőtt egy név megjelenhetne a ranglistán. Egy
// teljesen megbízható szűrőhöz szerver oldali (Cloud Function) ellenőrzés + emberi
// moderáció kellene, ami túlmutat ennek a statikus oldalnak a keretein.
const USERNAME_MIN_LEN = 3;
const USERNAME_MAX_LEN = 20;
const USERNAME_DENYLIST = [
    // durva/trágár szavak (magyar)
    'kurva', 'geci', 'picsa', 'fasz', 'buzi', 'koszfej', 'kocsog', 'faszfej', 'szopjal', 'anyad',
    // gyűlöletkeltő / rasszista kifejezések (magyar)
    'ciganybuzi', 'zsidozo', 'buzikurva',
    // durva/trágár szavak és gyűlöletkeltő kifejezések (angol)
    'fuck', 'shit', 'bitch', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'cunt'
];

// Ékezetek és minden nem betű/szám karakter (pl. pontok, szóközök, aláhúzás — hogy a
// "k.u.r.v.a" vagy "k u r v a" típusú trükk se menjen simán át) eltávolítása, hogy a
// szótáras egyezés a lehető legtöbb egyszerű megkerülési kísérletet elkapja.
function normalizeForUsernameFilter(str) {
    const COMBINING_DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');
    return (str || '')
        .toLowerCase()
        .normalize('NFD').replace(COMBINING_DIACRITICS_RE, '')
        .replace(/[^a-z0-9]/g, '');
}

function validateUsername(raw) {
    const trimmed = (raw || '').trim();
    if (trimmed.length < USERNAME_MIN_LEN) return { ok: false, reason: `A felhasználónév legalább ${USERNAME_MIN_LEN} karakter legyen.` };
    if (trimmed.length > USERNAME_MAX_LEN) return { ok: false, reason: `A felhasználónév legfeljebb ${USERNAME_MAX_LEN} karakter lehet.` };
    if (!/^[\p{L}0-9 _\-.]+$/u.test(trimmed)) return { ok: false, reason: 'A felhasználónév csak betűket, számokat, szóközt, kötőjelet, pontot és aláhúzást tartalmazhat.' };
    const normalized = normalizeForUsernameFilter(trimmed);
    if (USERNAME_DENYLIST.some(bad => normalized.includes(bad))) {
        return { ok: false, reason: 'Ez a felhasználónév sértő vagy nem megfelelő kifejezést tartalmaz — válassz másikat.' };
    }
    return { ok: true, reason: '' };
}

// ==========================================
// 3d. FELHASZNÁLÓNÉV-EGYEDISÉG (senki más ne foglalhassa el ugyanazt a nevet)
// ==========================================
// A "usernames" gyűjtemény egy külön, láthatatlan "foglalási lista" — a dokumentum ID-ja a
// normalizált (kisbetűs, ékezet nélküli, összevont szóközös) név, tartalma pedig, hogy MELYIK
// fiók (uid) birtokolja. Ez teszi lehetővé, hogy a "Peti" és "PETI" ugyanannak számítson, és
// hogy a foglalás Firestore tranzakcióval (runTransaction) atomi legyen — így akkor sem
// fordulhat elő két egyforma név, ha két ember pontosan egy időben próbálja lefoglalni
// ugyanazt (az egyikük tranzakciója biztosan elbukik, és újra kell próbálkoznia).
function normalizeUsernameKey(raw) {
    const COMBINING_DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');
    return (raw || '').trim().toLowerCase()
        .normalize('NFD').replace(COMBINING_DIACRITICS_RE, '')
        .replace(/\s+/g, ' ');
}

async function claimUsername(rawName, uid, previousRawName) {
    if (typeof firestoreDb === 'undefined' || !firestoreDb) return { ok: true, reason: '' };
    const normalized = normalizeUsernameKey(rawName);
    const prevNormalized = previousRawName ? normalizeUsernameKey(previousRawName) : null;
    // Ha a név valójában nem változott (csak pl. a nagybetűzés), nincs mit újrafoglalni.
    if (normalized === prevNormalized) return { ok: true, reason: '' };

    const newRef = firestoreDb.collection('usernames').doc(normalized);
    const prevRef = prevNormalized ? firestoreDb.collection('usernames').doc(prevNormalized) : null;
    try {
        await firestoreDb.runTransaction(async (tx) => {
            const newSnap = await tx.get(newRef);
            if (newSnap.exists && newSnap.data().uid !== uid) throw new Error('TAKEN');
            // A tranzakcióban minden olvasásnak meg kell előznie az írásokat — ezért a régi
            // név dokumentumát is előre lekérjük, mielőtt bármit írnánk. Csak akkor töröljük,
            // ha TÉNYLEG létezik és a miénk — egy nem létező dokumentum törlési kísérlete a
            // biztonsági szabály "resource.data" ellenőrzésén elbukna, és emiatt az EGÉSZ
            // tranzakciót (a névfoglalást is) meghiúsítaná.
            const prevSnap = prevRef ? await tx.get(prevRef) : null;

            tx.set(newRef, {
                uid, displayName: rawName.trim(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (prevSnap && prevSnap.exists && prevSnap.data().uid === uid) tx.delete(prevRef);
        });
        return { ok: true, reason: '' };
    } catch (e) {
        if (e.message === 'TAKEN') {
            return { ok: false, reason: 'Ezt a felhasználónevet már foglalták — válassz másikat.' };
        }
        console.warn('Névfoglalási hiba:', e);
        return { ok: false, reason: 'Hiba történt a név ellenőrzésekor — próbáld újra.' };
    }
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
        'auth/network-request-failed': 'Hálózati hiba — ellenőrizd az internetkapcsolatot.',
        'auth/requires-recent-login': 'Biztonsági okokból jelentkezz be újra, majd próbáld meg újra.'
    };
    return map[error.code] || 'Hiba történt: ' + error.message;
}

function updateAccountUI() {
    if (!accountLoggedOut) return; // ha nincs Firebase bekötve, ezek az elemek nincsenek is kezelve
    // A névtelen (anonymous) munkamenet — amit a Multiplayer indít el vendégeknek a háttérben —
    // nem valódi fiók, ezért a Profil képernyőn továbbra is "kijelentkezett" állapotként mutatjuk.
    if (currentUser && !currentUser.isAnonymous) {
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

// ==========================================
// 3e. "KIHAGYÁS"-BÜNTETŐRENDSZER
// ==========================================
// Aki rendszeresen (élethosszig mérve, solo ÉS multiplayer körökben együtt) sokat
// Kihagy, azt több, egymást erősítő módon "bünteti" a rendszer:
//   1) az adott kör XP-je amúgy is kevesebb, minél később találod el (STEP_XP_TABLE) —
//      ez már eddig is megvolt;
//   2) ha a tartós Kihagyás-arányod magas, az ÖSSZES megszerzett XP-re szorzó kerül
//      (lásd skipRateMultiplier) — ez a "tartós" büntetés;
//   3) egy Kihagyás — akkor is, ha végül eltalálod a számot — azonnal megtöri a
//      streaket/combót (lásd endRound / endMpRound);
//   4) egy munkameneten belül túl sok Kihagyás után rövid várakozás (cooldown) kerül a
//      gombra, hogy a spam-kattintgatást fékezze (lásd SKIP_COOLDOWN_* és
//      triggerSkipCooldown);
//   5) multiplayerben a végeredménynél megjelenik, ki skippelt a legtöbbet a meccsen
//      ("Kihagyás Király" — lásd multiplayer.js renderMpResults);
//   6) pozitív megerősítésként van egy jelvény is annak, aki NEM szokott kihagyni (lásd
//      lejjebb a 'no_giveup' jelvényt).
// Kevés lejátszott kör (SKIP_PENALTY_MIN_SAMPLE alatt) esetén szándékosan nem büntetünk —
// egy vadonatúj játékos néhány kipróbálás-jellegű Kihagyása ne rontsa el rögtön az XP-jét.
const SKIP_PENALTY_MIN_SAMPLE = 10;
function skipRateMultiplier(profile) {
    const played = profile.roundsPlayed || 0;
    if (played < SKIP_PENALTY_MIN_SAMPLE) return 1;
    const rate = (profile.roundsSkipped || 0) / played;
    if (rate >= 0.75) return 0.7;  // -30% XP
    if (rate >= 0.5) return 0.85;  // -15% XP
    return 1;
}

const SKIP_COOLDOWN_SESSION_THRESHOLD = 3; // ennyi Kihagyás után lép életbe a cooldown
const SKIP_COOLDOWN_SECONDS = 3;

// --- Jelvények ---
const BADGES = [
    { id: 'first_win', icon: '🥇', name: 'Első Találat', desc: 'Találd el az első számot!' },
    { id: 'flawless_5', icon: '⚡', name: 'Ötös Fogás', desc: 'Érj el 5 flawless találatot összesen.' },
    { id: 'streak_10', icon: '🔥', name: 'Tűzcsóva', desc: 'Érj el 10-es combót egy játékon belül.' },
    { id: 'daily_3', icon: '📅', name: 'Kitartó', desc: 'Játssz Napi Kihívást 3 egymást követő napon.' },
    { id: 'daily_7', icon: '🗓️', name: 'Egy Hetes Menetrend', desc: 'Játssz Napi Kihívást 7 egymást követő napon.' },
    { id: 'category_explorer', icon: '🧭', name: 'Zenei Felfedező', desc: `Próbáld ki mind a ${Object.keys(CATEGORY_TERMS).length} kategóriát.` },
    { id: 'hundred_correct', icon: '💯', name: 'Százas', desc: 'Érj el összesen 100 helyes találatot.' },
    { id: 'hardcore_win', icon: '☠️', name: 'Vér és Verejték', desc: 'Nyerj egy kört Hardcore módban.' },
    { id: 'perfect_game', icon: '🏆', name: 'Tökéletes Kazetta', desc: 'Legyen flawless minden köröd egy játékban.' },
    { id: 'mp_debut', icon: '👥', name: 'Társasjáték', desc: 'Játssz le egy Multiplayer kört barátokkal.' },
    { id: 'mp_champion', icon: '👑', name: 'Szoba Bajnoka', desc: 'Végezz az 1. helyen egy Multiplayer szobában.' },
    { id: 'no_giveup', icon: '🛡️', name: 'Nem Adom Fel', desc: `Játssz le legalább ${SKIP_PENALTY_MIN_SAMPLE * 2} kört úgy, hogy a Kihagyás-arányod 10% alatt marad.` },
];

function checkAndAwardBadges(profile, eventFlags = {}) {
    const newly = [];
    const unlock = (id) => { if (!profile.badges.includes(id)) { profile.badges.push(id); newly.push(id); } };
    if (profile.totalCorrect >= 1) unlock('first_win');
    if (profile.totalFlawless >= 5) unlock('flawless_5');
    if (profile.bestStreakEver >= 10) unlock('streak_10');
    if (profile.dailyStreakCurrent >= 3) unlock('daily_3');
    if (profile.dailyStreakCurrent >= 7) unlock('daily_7');
    if (profile.categoriesPlayed.length >= Object.keys(CATEGORY_TERMS).length) unlock('category_explorer');
    if (profile.totalCorrect >= 100) unlock('hundred_correct');
    if (eventFlags.hardcoreWin) unlock('hardcore_win');
    if (eventFlags.perfectGame) unlock('perfect_game');
    if (eventFlags.mpDebut) unlock('mp_debut');
    if (eventFlags.mpChampion) unlock('mp_champion');
    const played = profile.roundsPlayed || 0;
    if (played >= SKIP_PENALTY_MIN_SAMPLE * 2 && ((profile.roundsSkipped || 0) / played) < 0.1) unlock('no_giveup');
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
let roundUsedSkip = false;   // ebben a körben nyomott-e Kihagyást
let sessionSkipCount = 0;    // hány Kihagyás történt EBBEN a munkamenetben (cooldown-hoz)
let skipCooldownToken = 0;   // új kör indulásakor érvényteleníti a folyamatban lévő cooldown-visszaszámlálót

const homeScreen = document.getElementById('home-screen');
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const statsScreen = document.getElementById('stats-screen');
const profileScreen = document.getElementById('profile-screen');

const categoryChipGrid = document.getElementById('category-chip-grid');
const usernameInput = document.getElementById('username-input');
const usernameInputLockedHint = document.getElementById('username-input-locked-hint');
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
const guestReminderBanner = document.getElementById('guest-reminder-banner');
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
const profileSkipRate = document.getElementById('profile-skip-rate');
const badgeGrid = document.getElementById('badge-grid');

// Fiók / bejelentkezés DOM elemek
const accountLoggedOut = document.getElementById('account-logged-out');
const accountLoggedIn = document.getElementById('account-logged-in');
const authModeLogin = document.getElementById('auth-mode-login');
const authModeSignup = document.getElementById('auth-mode-signup');
const authUsernameInput = document.getElementById('auth-username-input');
const authEmailInput = document.getElementById('auth-email-input');
const authPasswordInput = document.getElementById('auth-password-input');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const googleSigninBtn = document.getElementById('google-signin-btn');
const authErrorMsg = document.getElementById('auth-error-msg');
const accountEmailDisplay = document.getElementById('account-email-display');
const syncStatusMsg = document.getElementById('sync-status-msg');
const signOutBtn = document.getElementById('sign-out-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');
const deleteAccountModal = document.getElementById('delete-account-modal');
const deleteAccountCancelBtn = document.getElementById('delete-account-cancel-btn');
const deleteAccountConfirmBtn = document.getElementById('delete-account-confirm-btn');
const deleteAccountErrorMsg = document.getElementById('delete-account-error-msg');
const reauthPasswordArea = document.getElementById('reauth-password-area');
const reauthPasswordInput = document.getElementById('reauth-password-input');
const usernameSetupModal = document.getElementById('username-setup-modal');
const usernameSetupInput = document.getElementById('username-setup-input');
const usernameSetupErrorMsg = document.getElementById('username-setup-error-msg');
const usernameSetupConfirmBtn = document.getElementById('username-setup-confirm-btn');
const usernameSetupSignoutBtn = document.getElementById('username-setup-signout-btn');

const timeIntervals = [0.5, 1, 2, 4, 8, 15];
let currentStep = 0;
let isPlaying = false;
let animationFrameId;
let countdownInterval;
let remainingGuessTime = 0;

// ==========================================
// 4b. KATEGÓRIA TÖBBVÁLASZTÓS UI (chip-rács)
// ==========================================
// A korábbi egyszeres <select> helyett egy chip-rácsot renderelünk, ahol egy vagy több
// kategória is kiválasztható egyszerre (pl. "Magyar" + "Gaming" keverve). Ugyanezt a
// függvényt használja a multiplayer.js is a saját (mp-category-chip-grid) rácsához,
// mindkét helyen egy Set tárolja a kiválasztott kategória-kulcsokat.
function renderCategoryChips(container, selectedSet, onChange) {
    container.innerHTML = '';
    Object.keys(CATEGORY_LABELS).forEach(key => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'category-chip' + (selectedSet.has(key) ? ' selected' : '');
        chip.textContent = `${CATEGORY_ICONS[key] || '🎵'} ${CATEGORY_LABELS[key]}`;
        chip.dataset.categoryKey = key;
        chip.addEventListener('click', () => {
            if (selectedSet.has(key)) {
                // Legalább egy kategóriának mindig kiválasztva kell maradnia — különben
                // a lekérdezés nem tudná, honnan húzzon számot.
                if (selectedSet.size === 1) return;
                selectedSet.delete(key);
            } else {
                selectedSet.add(key);
            }
            chip.classList.toggle('selected', selectedSet.has(key));
            if (onChange) onChange();
        });
        container.appendChild(chip);
    });
}

const soloSelectedCategories = new Set(['all']);
renderCategoryChips(categoryChipGrid, soloSelectedCategories);

// ==========================================
// 5. KÉPERNYŐVÁLTÁS
// ==========================================
const leaderboardScreen = document.getElementById('leaderboard-screen');
const ALL_SCREENS = [homeScreen, setupScreen, gameScreen, statsScreen, profileScreen, leaderboardScreen];
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

    dailyCategoryLabel.textContent = categoryLabelFor(catKey);
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

    // Emlékeztető vendégeknek (nem bejelentkezett, de már játszott legalább egyszer),
    // hogy jelentkezzenek be, mielőtt elveszne a haladásuk. Csak akkor jelenik meg,
    // ha a fiók-funkció be van állítva ezen az oldalon, és tényleg van már mit védeni.
    const isGuestWithProgress = (typeof firebaseEnabled !== 'undefined' && firebaseEnabled)
        && (!currentUser || currentUser.isAnonymous)
        && profile.gamesPlayed >= 1;
    guestReminderBanner.classList.toggle('hidden', !isGuestWithProgress);
}

// Bejelentkezett fiókkal a "Felhasználónév" mező a fiók nevét mutatja, ZÁROLVA — ezt csak
// a Profil képernyő "Felhasználónév módosítása" gombjával lehet megváltoztatni. Enélkül a
// mező korábban minden egyéni játék végén (showStats) felülírta/törölte a fiókhoz tartozó,
// lefoglalt nevet, ezért kellett újra és újra beírni bejelentkezés után. Vendégként a mező
// továbbra is szabadon szerkeszthető (nincs fiók, amit védeni kellene).
function applyUsernameInputLockState() {
    const loggedIn = !!(currentUser && !currentUser.isAnonymous);
    if (loggedIn) {
        usernameInput.value = loadProfile().username || 'Játékos';
        usernameInput.disabled = true;
    } else {
        usernameInput.disabled = false;
    }
    usernameInputLockedHint.classList.toggle('hidden', !loggedIn);
}

goSetupBtn.addEventListener('click', () => { applyUsernameInputLockState(); showScreen(setupScreen); });
setupBackBtn.addEventListener('click', () => showScreen(homeScreen));
profileChipBtn.addEventListener('click', () => { renderProfileScreen(); showScreen(profileScreen); });
guestReminderBanner.addEventListener('click', () => { renderProfileScreen(); showScreen(profileScreen); });
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
    sessionSkipCount = 0;
    streakDisplay.classList.add('hidden');
    updateVolume(volumeInput.value);
}

startGameBtn.addEventListener('click', async () => {
    config.username = usernameInput.value || "Játékos";
    config.rounds = parseInt(document.getElementById('rounds-input').value) || 5;
    config.timeLimit = parseInt(document.getElementById('time-limit-input').value) || 0;
    config.category = Array.from(soloSelectedCategories);
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
    dailyModeBadge.textContent = `📅 NAPI KIHÍVÁS · ${categoryLabelFor(config.category)}`;
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
    roundUsedSkip = false;
    skipCooldownToken++; // érvénytelenítjük egy esetleges, előző körből még futó cooldown-visszaszámlálót
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
    skipBtn.textContent = 'Kihagyás';
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

// Ha valaki egy munkameneten belül túl sokszor nyomja a Kihagyást, rövid várakozást
// (cooldown) kap a gombra — ez fékezi a spam-kattintgatást. Az aktuális kör indulásakor
// (startRound) a skipCooldownToken megnő, ami érvényteleníti a folyamatban lévő
// visszaszámlálót, hogy az ne zavarja be egy már megkezdett új kört.
function triggerSkipCooldown() {
    sessionSkipCount++;
    if (sessionSkipCount <= SKIP_COOLDOWN_SESSION_THRESHOLD) return;
    const myToken = ++skipCooldownToken;
    skipBtn.disabled = true;
    let remaining = SKIP_COOLDOWN_SECONDS;
    skipBtn.textContent = `⏳ ${remaining}mp`;
    const tick = setInterval(() => {
        if (myToken !== skipCooldownToken) { clearInterval(tick); return; } // közben új kör indult
        remaining--;
        if (remaining <= 0) {
            clearInterval(tick);
            skipBtn.textContent = 'Kihagyás';
            if (!config.hardcore) skipBtn.disabled = false;
        } else {
            skipBtn.textContent = `⏳ ${remaining}mp`;
        }
    }, 1000);
}

skipBtn.addEventListener('click', () => {
    roundUsedSkip = true;
    triggerSkipCooldown();
    advanceGame();
});

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

    roundResults.push({ win: isWin, step: currentStep, flawless: !!isFlawless, usedSkip: roundUsedSkip });
    if (isWin && isFlawless) sessionFlawlessCount++;

    modalBox.className = 'modal-box p-4 p-md-5 rounded-4 shadow-lg text-center';
    let streakBrokenBySkip = false;

    if (isWin) {
        stats.correct++;
        // Egy Kihagyás — akkor is, ha végül eltaláltad — megtöri a sorozatot/combót.
        // Enélkül simán lehetne "biztosra menve" tömegesen Kihagyni és mégis végig
        // építgetni a streaket, ami épp a Kihagyás-büntetés célját ásná alá.
        if (roundUsedSkip) {
            streakBrokenBySkip = currentStreak > 0;
            currentStreak = 0;
        } else {
            currentStreak++;
            if (currentStreak > stats.maxStreak) stats.maxStreak = currentStreak;
        }

        successSound.currentTime = 0;
        successSound.play().catch(e => console.log(e));

        if (currentStreak > 0) {
            streakDisplay.classList.remove('hidden');
            streakDisplay.textContent = `🔥 Streak: ${currentStreak}`;
            streakDisplay.classList.remove('combo-pop');
            void streakDisplay.offsetWidth;
            streakDisplay.classList.add('combo-pop');
        } else {
            streakDisplay.classList.add('hidden');
        }

        if (isFlawless) modalBox.classList.add('flawless-state');
        else modalBox.classList.add('win-state');
    } else {
        stats.wrong++;
        currentStreak = 0;
        streakDisplay.classList.add('hidden');
        modalBox.classList.add('lose-state');
    }
    if (streakBrokenBySkip) msgText += ' (a Kihagyás megtörte a sorozatod)';

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
    (Array.isArray(config.category) ? config.category : [config.category]).forEach(catKey => {
        if (!profile.categoriesPlayed.includes(catKey)) profile.categoriesPlayed.push(catKey);
    });

    // A Kihagyás-arányt ELŐBB frissítjük ezzel a menettel (a most lejátszott körökkel
    // együtt), hogy a lentebbi szorzó már a legfrissebb állapotot tükrözze.
    profile.roundsPlayed = (profile.roundsPlayed || 0) + roundResults.length;
    profile.roundsSkipped = (profile.roundsSkipped || 0) + roundResults.filter(r => r.usedSkip).length;

    let sessionXp = 0;
    roundResults.forEach(r => { sessionXp += xpForRound(r.win, r.flawless, r.step); });
    if (config.isDaily) sessionXp += 50; // napi kihívás teljesítési bónusz
    const skipMultiplier = skipRateMultiplier(profile);
    sessionXp = Math.round(sessionXp * skipMultiplier);
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
            categoryLabel: categoryLabelFor(config.category),
            emojis: roundResults.map(roundEmoji),
            correct: stats.correct,
            total: config.rounds
        };
    }
    // Bejelentkezett fiókkal a nevet KIZÁRÓLAG a Profil képernyő "Felhasználónév
    // módosítása" gombja (és a lefoglalási rendszer) változtathatja meg — az egyéni játék
    // mezője (config.username, ami bejelentkezve amúgy is zárolva/előre kitöltve van, lásd
    // applyUsernameInputLockState) nem írhatja felül. Enélkül minden lejátszott kör
    // véletlenül visszaállította volna a fiók nevét, ezért kellett újra és újra beírni.
    if (!currentUser || currentUser.isAnonymous) {
        profile.username = config.username;
    }

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
    statXp.textContent = `+${sessionXp} XP` + (skipMultiplier < 1 ? ` (⚠️ -${Math.round((1 - skipMultiplier) * 100)}% a gyakori Kihagyás miatt)` : '');

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
        ? `Songguess Napi Kihívás 🎧 (${categoryLabelFor(config.category)})`
        : `Songguess Egyéni Játék 🎧 (${categoryLabelFor(config.category)})`;
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

    const played = profile.roundsPlayed || 0;
    const skipRatePct = played > 0 ? Math.round(((profile.roundsSkipped || 0) / played) * 100) : 0;
    const currentMultiplier = skipRateMultiplier(profile);
    profileSkipRate.textContent = currentMultiplier < 1 ? `${skipRatePct}% (⚠️ -${Math.round((1 - currentMultiplier) * 100)}% XP)` : `${skipRatePct}%`;
    profileSkipRate.style.color = currentMultiplier < 1 ? 'var(--danger)' : '';

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
    // A felhasználónév-mező csak regisztrációkor kötelező/látszik — bejelentkezésnél a
    // meglévő fiók már rendelkezik eggyel.
    authUsernameInput.classList.toggle('hidden', mode !== 'signup');
    if (mode !== 'signup') authUsernameInput.value = '';
}

// Ez a felugró ablak két esetben jelenik meg:
//  - "forced" mód: fiók létrehozásakor / bejelentkezéskor, ha még nincs érvényes neve
//    (kötelező kilépni belőle egy megfelelő névvel, vagy ki lehet jelentkezni);
//  - "voluntary" mód: a Profil képernyő "Felhasználónév módosítása" gombjával bármikor,
//    szabadon, közönséges "Mégse" gombbal.
// A "forced" mód azért kell külön a signup-űrlaptól is, mert a Google-bejelentkezés egy
// előugró ablakos folyamat, ahol nem tudunk előre mezőt kérni.
let usernameSetupMode = 'forced';
function openUsernameSetupModal(mode = 'forced') {
    usernameSetupMode = mode;
    usernameSetupInput.value = mode === 'voluntary' ? (loadProfile().username || '') : '';
    usernameSetupErrorMsg.textContent = '';
    usernameSetupSignoutBtn.textContent = mode === 'voluntary' ? 'Mégse' : 'Mégse, kijelentkezem';
    usernameSetupModal.classList.add('show');
}
async function maybePromptForUsername() {
    if (!currentUser || currentUser.isAnonymous) return;
    const profile = loadProfile();
    // Kétféle esetben kérünk (új) nevet MODÁLLAL:
    //  1) még nincs érdemi neve (üres, vagy a generikus "Játékos" alapérték maradt) —
    //     ez főleg vadonatúj Google-fióknál vagy nagyon régi, még névmező előtti profilnál
    //     fordul elő;
    //  2) VAN már egyéni neve (a régi, szűretlen egyéni játék "Írd be a neved" mezőből),
    //     de az most nem menne át a szűrőn (pl. túl rövid/hosszú, vagy sértő szót
    //     tartalmaz) — így a már meglévő fiókok neve is visszamenőleg leellenőrződik,
    //     mielőtt megjelenhetne a nyilvános ranglistán.
    const isDefault = !profile.username || profile.username === 'Játékos';
    const failsFilter = !isDefault && !validateUsername(profile.username).ok;
    if (isDefault || failsFilter) {
        openUsernameSetupModal('forced');
        return;
    }

    // A név formailag rendben van — de ha ez egy régebbi fiók, aminek a neve MÉG SOSEM lett
    // ténylegesen lefoglalva a "usernames" gyűjteményben (mert korábban sosem ugrott fel ez
    // a modal neki), akkor az egyediség-garancia lyukas maradna: valaki más is regisztrálhatna
    // ugyanezzel a névvel. Ezért csendben, felugró ablak nélkül megpróbáljuk lefoglalni a
    // háttérben — ha ez sikerül (mert még senki nem foglalta le), attól kezdve tényleg egyedi.
    // Csak akkor jelenik meg a modal, ha kiderül, hogy időközben valaki MÁS már elvitte ezt a
    // nevet — ez a ritka, valódi ütközés esete.
    const claim = await claimUsername(profile.username, currentUser.uid, null);
    if (!claim.ok) {
        openUsernameSetupModal('forced');
        usernameSetupErrorMsg.textContent = 'A jelenlegi felhasználóneved időközben mást illet — válassz egy másikat.';
    }
}

if (authModeLogin) {
    authModeLogin.addEventListener('change', () => setAuthMode('login'));
    authModeSignup.addEventListener('change', () => setAuthMode('signup'));

    authSubmitBtn.addEventListener('click', async () => {
        const email = authEmailInput.value.trim();
        const password = authPasswordInput.value;
        const isSignup = authModeSignup.checked;
        authErrorMsg.textContent = '';

        if (!firebaseEnabled) {
            authErrorMsg.textContent = 'A fiók-funkció még nincs beállítva ezen az oldalon (firebase-config.js).';
            return;
        }
        if (!email || !password) {
            authErrorMsg.textContent = 'Add meg az email címed és a jelszavad.';
            return;
        }
        let chosenUsername = null;
        if (isSignup) {
            chosenUsername = authUsernameInput.value.trim();
            const check = validateUsername(chosenUsername);
            if (!check.ok) { authErrorMsg.textContent = check.reason; return; }
        }

        authSubmitBtn.disabled = true;
        try {
            if (isSignup) {
                // A választott nevet MÁR a fiók létrehozása ELŐTT elmentjük helyben — így
                // mire a bejelentkezés-figyelő (onAuthStateChanged) lefut és leellenőrzi, kell-e
                // felhasználónevet kérnie, már a helyes nevet találja, nem ugrik fel felesleges
                // duplikált kérő ablak a frissen megadott név után.
                const previousUsername = loadProfile().username;
                const profile = loadProfile();
                profile.username = chosenUsername;
                saveProfile(profile);
                const cred = await firebaseAuth.createUserWithEmailAndPassword(email, password);
                await cred.user.updateProfile({ displayName: chosenUsername }).catch(() => {});

                // A név EGYEDISÉGÉT csak a fiók létrehozása UTÁN tudjuk lefoglalni (addig
                // nincs uid). Ha időközben (pl. egy pillanattal korábban valaki más) már
                // lefoglalta ugyanezt a nevet, a fiók már létrejött — ilyenkor a kötelező
                // névbekérő ablakkal kérünk egy másikat, hibaüzenettel előre kitöltve.
                const claim = await claimUsername(chosenUsername, cred.user.uid, previousUsername);
                if (!claim.ok) {
                    openUsernameSetupModal('forced');
                    usernameSetupErrorMsg.textContent = claim.reason;
                }
            } else {
                await firebaseAuth.signInWithEmailAndPassword(email, password);
            }
            authEmailInput.value = '';
            authPasswordInput.value = '';
            authUsernameInput.value = '';
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
            // A profil-összefésülés és a felhasználónév-ellenőrzés az onAuthStateChanged
            // figyelőben történik (lásd lejjebb) — az fut le minden bejelentkezési módnál.
        } catch (e) {
            authErrorMsg.textContent = friendlyAuthError(e);
        }
    });

    usernameSetupConfirmBtn.addEventListener('click', async () => {
        const check = validateUsername(usernameSetupInput.value);
        if (!check.ok) { usernameSetupErrorMsg.textContent = check.reason; return; }
        if (!currentUser || currentUser.isAnonymous) { usernameSetupErrorMsg.textContent = 'Nincs bejelentkezve.'; return; }
        const chosen = usernameSetupInput.value.trim();

        usernameSetupConfirmBtn.disabled = true;
        usernameSetupErrorMsg.textContent = '';
        const previousUsername = loadProfile().username;
        const claim = await claimUsername(chosen, currentUser.uid, previousUsername);
        usernameSetupConfirmBtn.disabled = false;
        if (!claim.ok) { usernameSetupErrorMsg.textContent = claim.reason; return; }

        const profile = loadProfile();
        profile.username = chosen;
        saveProfile(profile);
        currentUser.updateProfile({ displayName: chosen }).catch(() => {});
        usernameSetupModal.classList.remove('show');
        refreshHomeUI();
    });
    usernameSetupSignoutBtn.addEventListener('click', async () => {
        usernameSetupModal.classList.remove('show');
        // Önkéntes névváltoztatásnál a "Mégse" csak bezárja az ablakot — csak a KÖTELEZŐ
        // (forced) módban jelenti a kilépést is, mert csak ott nem lenne más kiút.
        if (usernameSetupMode === 'forced') {
            try { await firebaseAuth.signOut(); } catch (e) { /* no-op */ }
        }
    });

    const changeUsernameBtn = document.getElementById('change-username-btn');
    if (changeUsernameBtn) {
        changeUsernameBtn.addEventListener('click', () => openUsernameSetupModal('voluntary'));
    }

    signOutBtn.addEventListener('click', async () => {
        try {
            await firebaseAuth.signOut();
        } catch (e) {
            console.warn('Kijelentkezési hiba:', e);
        }
    });

    // --- Fiók végleges törlése ---
    deleteAccountBtn.addEventListener('click', () => {
        deleteAccountErrorMsg.textContent = '';
        reauthPasswordArea.classList.add('hidden');
        reauthPasswordInput.value = '';
        deleteAccountModal.classList.add('show');
    });
    deleteAccountCancelBtn.addEventListener('click', () => {
        deleteAccountModal.classList.remove('show');
    });

    // Ténylegesen töröl: előbb a Firestore-dokumentumot (amíg még be van jelentkezve,
    // hogy a security rule engedje), utána magát az auth-fiókot, végül a helyi cache-t is.
    async function performAccountDeletion() {
        if (!currentUser) return;
        const uid = currentUser.uid;
        deleteAccountConfirmBtn.disabled = true;
        try {
            if (firestoreDb) {
                await firestoreDb.collection('users').doc(uid).delete();
                await firestoreDb.collection('leaderboard').doc(uid).delete().catch(() => {});
                // A lefoglalt felhasználónevet is felszabadítjuk, hogy más elvehesse.
                const releasedName = loadProfile().username;
                if (releasedName) {
                    await firestoreDb.collection('usernames').doc(normalizeUsernameKey(releasedName)).delete().catch(() => {});
                }
            }
            await currentUser.delete();
            localStorage.removeItem(PROFILE_STORAGE_KEY);
            deleteAccountModal.classList.remove('show');
            refreshHomeUI();
            showScreen(homeScreen);
        } catch (e) {
            if (e.code === 'auth/requires-recent-login') {
                // Biztonsági okokból a Firebase friss bejelentkezést kér érzékeny műveletekhez
                // (fiók törlése). Újra-hitelesítjük a felhasználót a bejelentkezési módja szerint.
                const providerId = currentUser.providerData[0] && currentUser.providerData[0].providerId;
                if (providerId === 'google.com') {
                    try {
                        const provider = new firebase.auth.GoogleAuthProvider();
                        await currentUser.reauthenticateWithPopup(provider);
                        await performAccountDeletion();
                        return;
                    } catch (e2) {
                        deleteAccountErrorMsg.textContent = friendlyAuthError(e2);
                    }
                } else {
                    reauthPasswordArea.classList.remove('hidden');
                    deleteAccountErrorMsg.textContent = 'Biztonsági okokból add meg újra a jelszavad, majd nyomd meg újra a törlést.';
                }
            } else {
                deleteAccountErrorMsg.textContent = friendlyAuthError(e);
            }
        }
        deleteAccountConfirmBtn.disabled = false;
    }

    deleteAccountConfirmBtn.addEventListener('click', async () => {
        deleteAccountErrorMsg.textContent = '';
        // Ha a jelszó-mező már látszik (mert korábban friss bejelentkezést kért a Firebase),
        // előbb ezzel hitelesítünk újra, majd folytatjuk a törlést.
        if (!reauthPasswordArea.classList.contains('hidden')) {
            const password = reauthPasswordInput.value;
            if (!password) {
                deleteAccountErrorMsg.textContent = 'Add meg a jelszavad a megerősítéshez.';
                return;
            }
            deleteAccountConfirmBtn.disabled = true;
            try {
                const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, password);
                await currentUser.reauthenticateWithCredential(credential);
                reauthPasswordArea.classList.add('hidden');
                await performAccountDeletion();
            } catch (e) {
                deleteAccountErrorMsg.textContent = friendlyAuthError(e);
                deleteAccountConfirmBtn.disabled = false;
            }
            return;
        }
        await performAccountDeletion();
    });

    // Bejelentkezés-állapot figyelése: ez fut le lapbetöltéskor is, és minden
    // be-/kijelentkezéskor. Bejelentkezéskor összefésüli a helyi és felhő-profilt.
    if (firebaseEnabled && firebaseAuth) {
        firebaseAuth.onAuthStateChanged(async (user) => {
            currentUser = user;
            updateAccountUI();
            // Névtelen (Multiplayer-vendég) munkamenetnél nincs mit szinkronizálni/összefésülni —
            // az csak a valódi (email vagy Google) fiókoknál értelmezett. Minden ilyen
            // bejelentkezésnél (Google, email, vagy egy régebbi — a felhasználónév-kötelezővé
            // tétele ELŐTT regisztrált — fiók) ellenőrizzük, van-e már érdemi felhasználónév.
            if (user && !user.isAnonymous) {
                await syncOnLogin(user);
                await maybePromptForUsername();
            }
        });
    }
}

// ==========================================
// 15. INDÍTÁS
// ==========================================
refreshHomeUI();
