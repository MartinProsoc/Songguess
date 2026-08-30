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

const fallbackImg = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='100%25' height='100%25' fill='%23222'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23555' font-family='sans-serif' font-size='40'%3E%E2%99%AB%3C/text%3E%3C/svg%3E";

async function getRandomSongFromiTunes(category, excludeIds = new Set()) {
    const terms = CATEGORY_TERMS[category] || CATEGORY_TERMS['all'];
    // Véletlen sorrendben végigpróbáljuk a kategória kulcsszavait, amíg
    // nem találunk egy még fel nem használt (trackId alapján egyedi) számot.
    const shuffledTerms = shuffleArray([...terms]);

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

            // Az iTunes keresés a cím/album mezőben is egyezést keres, nem csak az előadóban
            // (pl. "valmar" kulcsszóra egy másik előadó "Valmar" című száma is bejöhetne).
            // Ezért előnyben részesítjük azokat a találatokat, ahol a kulcsszó ténylegesen
            // az előadó nevében szerepel; ha egy sincs ilyen (pl. az "all" kategória általános
            // kifejezéseinél), visszaesünk a teljes találati listára.
            const artistMatches = rawTracks.filter(track => track.artistName.toLowerCase().includes(term.toLowerCase()));
            const validTracks = artistMatches.length > 0 ? artistMatches : rawTracks;

            const randomTrack = validTracks[Math.floor(Math.random() * validTracks.length)];
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

    // Minden kulcsszót megpróbáltunk, és nem találtunk új számot
    return null;
    }

async function searchiTunes(query) {
    try {
        const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`);
        const data = await response.json();
        if (!data.results) return [];

        return data.results.map(track => ({
            artist: track.artistName,
            title: track.trackName,
            cover: track.artworkUrl100
        }));
    } catch (error) {
        return [];
    }
}

// Feleletválasztós mód: 3 véletlenszerű, hihető, de rossz opció lekérése
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

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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

    // "Táska" alapú keverés: egy kép csak akkor jöhet újra, ha már minden mást felhasználtunk
    let bag = [];
    function refillBag() {
        bag = shuffleArray([...backgroundImages]);
    }
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
// 3. JÁTÉK VÁLTOZÓK ÉS DOM ELEMEK
// ==========================================
const successSound = new Audio("data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
successSound.volume = 0.5;

let config = { username: "Játékos", rounds: 5, timeLimit: 0, volume: 0.5, category: "all", mode: "classic", hardcore: false };
let stats = { correct: 0, wrong: 0, maxStreak: 0 };
let currentRoundNum = 1;
let currentStreak = 0;
let currentSong = null;
let correctAnswerFull = "";
let choiceLocked = false;
let usedSongIds = new Set(); // az adott játékon belül már feldobott számok, hogy ne ismétlődjenek

const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const statsScreen = document.getElementById('stats-screen');
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

const timeIntervals = [0.5, 1, 2, 4, 8, 15];
let currentStep = 0;
let isPlaying = false;
let animationFrameId;
let countdownInterval;
let remainingGuessTime = 0;

// ==========================================
// 4. JÁTÉK LOGIKA ÉS KÉPERNYŐVÁLTÁS
// ==========================================
function showScreen(screenElement) {
    [menuScreen, gameScreen, statsScreen].forEach(s => {
        s.classList.remove('active');
    });
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

startGameBtn.addEventListener('click', async () => {
    config.username = document.getElementById('username-input').value || "Játékos";
    config.rounds = parseInt(document.getElementById('rounds-input').value) || 5;
    config.timeLimit = parseInt(document.getElementById('time-limit-input').value) || 0;
    config.category = categoryInput.value;
    config.mode = document.querySelector('input[name="game-mode"]:checked').value;
    config.hardcore = hardcoreInput.checked;

    stats = { correct: 0, wrong: 0, maxStreak: 0 };
    currentRoundNum = 1;
    currentStreak = 0;
    usedSongIds = new Set();
    streakDisplay.classList.add('hidden');
    updateVolume(volumeInput.value);

    hardcoreBadge.classList.toggle('hidden', !config.hardcore);
    skipBtn.classList.toggle('hidden', config.hardcore);

    showScreen(gameScreen);

    playBtn.disabled = true;
    skipBtn.disabled = true;
    submitBtn.disabled = true;
    guessInput.disabled = true;

    await startRound();
});

async function startRound() {
    currentStep = 0;
    guessInput.value = '';
    choiceLocked = false;
    cassette.classList.remove('spinning');
    autocompleteList.innerHTML = '';

    // Beviteli terület a mód szerint
    const isChoiceMode = config.mode === 'choice';
    classicInputArea.classList.toggle('hidden', isChoiceMode);
    choiceInputArea.classList.toggle('hidden', !isChoiceMode);
    submitBtn.classList.toggle('hidden', isChoiceMode);
    choiceInputArea.innerHTML = '';

    messageDisplay.textContent = 'Kazetta tekerése az Apple szervereiről...';
    messageDisplay.className = "mt-3 fw-bold fs-5";
    messageDisplay.style.color = "var(--gold)";

    currentSong = await getRandomSongFromiTunes(config.category, usedSongIds);

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
    skipBtn.disabled = true; // egy tipp után nincs több lépés, ne lehessen közben kihagyni

    const isCorrect = optionText.toLowerCase() === correctAnswerFull;
    const allButtons = choiceInputArea.querySelectorAll('.choice-btn');
    allButtons.forEach(b => {
        b.disabled = true;
        if (b.textContent.toLowerCase() === correctAnswerFull) b.classList.add('correct');
    });
    if (!isCorrect) btn.classList.add('wrong');

    // Feleletválasztós módban egy tipp = egy próbálkozás: helyes vagy rossz,
    // a kör ezzel eldőlt, nincs "időkeret feloldás" mint gépelős módban.
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
    if (audioPlayer.currentTime >= timeIntervals[currentStep]) {
        audioPlayer.currentTime = 0;
    }
    audioPlayer.play();
    isPlaying = true;
    cassette.classList.add('spinning');
    playBtn.textContent = "⏸ Szünet";
});

function advanceGame() {
    if (config.hardcore) return; // hardcore módban nincs feloldás
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
// 5. KÖR VÉGE ÉS STATISZTIKA
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

        playBtn.disabled = true;
        skipBtn.disabled = true;
        submitBtn.disabled = true;
        guessInput.disabled = true;

        await startRound();
    }
});

function showStats() {
    document.getElementById('stats-username').textContent = config.username;
    document.getElementById('stat-total').textContent = config.rounds;
    document.getElementById('stat-correct').textContent = stats.correct;
    document.getElementById('stat-max-streak').textContent = `${stats.maxStreak} 🔥`;

    let acc = Math.round((stats.correct / config.rounds) * 100);
    document.getElementById('stat-accuracy').textContent = `${acc}%`;
    document.getElementById('stat-accuracy').style.color = acc >= 50 ? "var(--accent-2)" : "var(--danger)";
    showScreen(statsScreen);
}

document.getElementById('back-to-menu-btn').addEventListener('click', () => {
    generateDynamicBackground();
    showScreen(menuScreen);
});

// ==========================================
// 6. VISSZA A FŐMENÜBE (kör közben, megerősítéssel)
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

backArrowBtn.addEventListener('click', () => {
    confirmModal.classList.add('show');
});

confirmCancelBtn.addEventListener('click', () => {
    confirmModal.classList.remove('show');
});

confirmLeaveBtn.addEventListener('click', () => {
    confirmModal.classList.remove('show');
    resetGameRuntimeState();
    generateDynamicBackground();
    showScreen(menuScreen);
});

// ==========================================
// 7. AUTOCOMPLETE KERESŐ
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
    if (e.target !== guessInput && !autocompleteList.contains(e.target)) {
        autocompleteList.innerHTML = '';
    }
});
