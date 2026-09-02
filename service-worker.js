// ==========================================================
// SONGGUESS — SERVICE WORKER (PWA telepíthetőség + app-héj gyorsítótárazás)
// ==========================================================
// Csak a STATIKUS app-héjat (HTML/CSS/JS/ikon) gyorsítótárazzuk — az iTunes-keresést, a
// Firestore-forgalmat és a Google Fonts-ot direkt NEM fogjuk el, azok mindig élőben, a
// hálózatról jönnek (ezeknél a gyorsítótárazás elavult/hibás adatot adna vissza).
//
// "Stale-while-revalidate" stratégia: ha van gyorsítótárazott verzió, AZONNAL azt adjuk
// vissza (gyors, és internet nélkül is legalább betölt valamit), a háttérben viszont mindig
// megpróbáljuk frissíteni a gyorsítótárat a legújabb verzióra — így egy új kiadás sem
// ragad be tartósan elavult állapotban.
const CACHE_NAME = 'songguess-shell-v1';
const SHELL_FILES = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './multiplayer.js',
    './leaderboard.js',
    './firebase-config.js',
    './manifest.json',
    './icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(SHELL_FILES))
            .catch(() => { /* egy hiányzó/hálózati hiba miatt sikertelen fájl se akassza meg a telepítést */ })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    let url;
    try { url = new URL(req.url); } catch (e) { return; }
    if (url.origin !== self.location.origin) return; // külső (iTunes, Firestore, fontok stb.) — érintetlenül hagyjuk

    event.respondWith(
        caches.match(req).then((cached) => {
            const networkFetch = fetch(req).then((response) => {
                if (response && response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                }
                return response;
            }).catch(() => cached);
            return cached || networkFetch;
        })
    );
});
