// ==========================================================
// SONGGUESS — BARÁTOK
// ==========================================================
// Ez a fájl a script.js, multiplayer.js és leaderboard.js UTÁN töltődik be. Használja az ott
// már definiált dolgokat: loadProfile(), currentUser, showScreen(), profileScreen,
// renderProfileScreen(), normalizeUsernameKey() (script.js), escapeHtml() (multiplayer.js).
// A Firebase-hez a firebase-config.js-ből: firebaseEnabled, firestoreDb.
//
// ADATMODELL: a "friendRequests" gyűjtemény egy-egy dokumentuma egy barátkérést (és egyben,
// elfogadás UTÁN, magát a barátságot is) képvisel — NINCS külön "friends" lista egyik
// felhasználó profiljában sem, mert az a kölcsönös (mindkét fél dokumentumát érintő) írás
// ütközne a "mindenki csak a saját dokumentumát írhatja" biztonsági elvvel (amit a
// firestore.rules a teljes projektben következetesen betart). Így viszont egyetlen
// dokumentum — amit VAGY a küldő, VAGY a fogadó hozhat létre/módosíthat/törölhet — pontosan
// leírja mindkét állapotot (pending -> accepted -> [törölve, ha valaki eltávolítja]).
//
// A "kit ismerek" kereséshez a MÁR MEGLÉVŐ "usernames" gyűjteményt használjuk (amit a
// felhasználónév-egyediség rendszer épített fel) — ez már amúgy is név -> uid leképezés,
// nem kell újat építeni hozzá.
// ==========================================================

const FRIEND_REQUESTS_COLLECTION = 'friendRequests';

const goFriendsBtn = document.getElementById('go-friends-btn');
const friendsScreen = document.getElementById('friends-screen');
const friendsBackBtn = document.getElementById('friends-back-btn');
const friendAddInput = document.getElementById('friend-add-input');
const friendAddBtn = document.getElementById('friend-add-btn');
const friendAddMsg = document.getElementById('friend-add-msg');
const friendRequestsSection = document.getElementById('friend-requests-section');
const friendRequestsList = document.getElementById('friend-requests-list');
const friendListEl = document.getElementById('friend-list');
const friendCountEl = document.getElementById('friend-count');
const friendListEmptyEl = document.getElementById('friend-list-empty');

// ==========================================
// BARÁTKÉRÉS KÜLDÉSE
// ==========================================
async function sendFriendRequest() {
    friendAddMsg.textContent = '';
    if (typeof firebaseEnabled === 'undefined' || !firebaseEnabled || !firestoreDb) {
        friendAddMsg.textContent = 'A Barátok funkció még nincs beállítva ezen az oldalon.';
        return;
    }
    if (!currentUser || currentUser.isAnonymous) {
        friendAddMsg.textContent = 'Csak bejelentkezett fiókkal küldhetsz barátkérést.';
        return;
    }
    const rawName = friendAddInput.value.trim();
    if (!rawName) { friendAddMsg.textContent = 'Add meg a keresett felhasználónevet.'; return; }

    friendAddBtn.disabled = true;
    try {
        const normalized = normalizeUsernameKey(rawName);
        const myNormalized = normalizeUsernameKey(loadProfile().username || '');
        if (normalized === myNormalized) {
            friendAddMsg.textContent = 'Ez a Te felhasználóneved — magadat nem adhatod hozzá.';
            return;
        }
        const nameDoc = await firestoreDb.collection('usernames').doc(normalized).get();
        if (!nameDoc.exists) {
            friendAddMsg.textContent = 'Nincs ilyen felhasználónevű játékos.';
            return;
        }
        const targetUid = nameDoc.data().uid;
        const targetName = nameDoc.data().displayName || rawName;

        // Ne lehessen kétszer elküldeni / már meglévő (függő vagy elfogadott) kapcsolatra
        // újat indítani — mindkét irányban ellenőrizzük.
        const [existingA, existingB] = await Promise.all([
            firestoreDb.collection(FRIEND_REQUESTS_COLLECTION)
                .where('fromUid', '==', currentUser.uid).where('toUid', '==', targetUid).limit(1).get(),
            firestoreDb.collection(FRIEND_REQUESTS_COLLECTION)
                .where('fromUid', '==', targetUid).where('toUid', '==', currentUser.uid).limit(1).get()
        ]);
        if (!existingA.empty || !existingB.empty) {
            friendAddMsg.textContent = 'Már van függőben lévő vagy elfogadott kapcsolatod ezzel a játékossal.';
            return;
        }

        await firestoreDb.collection(FRIEND_REQUESTS_COLLECTION).add({
            fromUid: currentUser.uid,
            fromUsername: loadProfile().username || 'Játékos',
            toUid: targetUid,
            toUsername: targetName,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        friendAddMsg.textContent = `✅ Barátkérés elküldve: ${targetName}`;
        friendAddInput.value = '';
    } catch (e) {
        console.error(e);
        friendAddMsg.textContent = 'Hiba történt a kérés küldésekor: ' + (e.message || e);
    }
    friendAddBtn.disabled = false;
}

// ==========================================
// LISTÁZÁS
// ==========================================
async function loadFriendsScreen() {
    if (typeof firebaseEnabled === 'undefined' || !firebaseEnabled || !firestoreDb) {
        friendRequestsSection.classList.add('hidden');
        friendListEl.innerHTML = '';
        friendListEmptyEl.classList.remove('hidden');
        friendListEmptyEl.textContent = 'A Barátok funkció még nincs beállítva ezen az oldalon.';
        friendCountEl.textContent = '0';
        return;
    }
    if (!currentUser || currentUser.isAnonymous) {
        friendRequestsSection.classList.add('hidden');
        friendListEl.innerHTML = '';
        friendListEmptyEl.classList.remove('hidden');
        friendListEmptyEl.textContent = 'Jelentkezz be egy fiókkal a barátok használatához.';
        friendCountEl.textContent = '0';
        return;
    }
    try {
        const [incomingSnap, sentSnap, receivedSnap] = await Promise.all([
            firestoreDb.collection(FRIEND_REQUESTS_COLLECTION)
                .where('toUid', '==', currentUser.uid).where('status', '==', 'pending').get(),
            firestoreDb.collection(FRIEND_REQUESTS_COLLECTION)
                .where('fromUid', '==', currentUser.uid).where('status', '==', 'accepted').get(),
            firestoreDb.collection(FRIEND_REQUESTS_COLLECTION)
                .where('toUid', '==', currentUser.uid).where('status', '==', 'accepted').get()
        ]);

        const incoming = incomingSnap.docs.map(d => Object.assign({ id: d.id }, d.data()));
        renderFriendRequests(incoming);

        const friends = [
            ...sentSnap.docs.map(d => ({ id: d.id, name: d.data().toUsername })),
            ...receivedSnap.docs.map(d => ({ id: d.id, name: d.data().fromUsername }))
        ];
        renderFriends(friends);
    } catch (e) {
        console.error(e);
        friendListEl.innerHTML = '';
        friendListEmptyEl.classList.remove('hidden');
        friendListEmptyEl.textContent = 'Hiba történt a barátlista betöltésekor: ' + (e.message || e);
    }
}

function renderFriendRequests(requests) {
    if (requests.length === 0) {
        friendRequestsSection.classList.add('hidden');
        friendRequestsList.innerHTML = '';
        return;
    }
    friendRequestsSection.classList.remove('hidden');
    friendRequestsList.innerHTML = requests.map(r => `
        <div class="friend-row">
            <div class="friend-row-info">
                <div class="friend-row-name">${escapeHtml(r.fromUsername || 'Játékos')}</div>
                <div class="friend-row-sub">barátkérést küldött</div>
            </div>
            <div class="friend-row-actions">
                <button class="btn primary" data-accept="${r.id}">✅ Elfogadás</button>
                <button class="btn secondary" data-decline="${r.id}">✖</button>
            </div>
        </div>
    `).join('');

    friendRequestsList.querySelectorAll('[data-accept]').forEach(btn => {
        btn.addEventListener('click', () => acceptFriendRequest(btn.dataset.accept));
    });
    friendRequestsList.querySelectorAll('[data-decline]').forEach(btn => {
        btn.addEventListener('click', () => removeFriendRequest(btn.dataset.decline));
    });
}

function renderFriends(friends) {
    friendCountEl.textContent = friends.length;
    if (friends.length === 0) {
        friendListEl.innerHTML = '';
        friendListEmptyEl.classList.remove('hidden');
        friendListEmptyEl.textContent = 'Még nincs egy barátod sem — keresd meg őket a felhasználónevük alapján fent!';
        return;
    }
    friendListEmptyEl.classList.add('hidden');
    friendListEl.innerHTML = friends.map(f => `
        <div class="friend-row">
            <div class="friend-row-info">
                <div class="friend-row-name">${escapeHtml(f.name || 'Játékos')}</div>
            </div>
            <div class="friend-row-actions">
                <button class="btn secondary" data-remove="${f.id}">Törlés</button>
            </div>
        </div>
    `).join('');

    friendListEl.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm('Biztosan törlöd ezt a barátot?')) return;
            removeFriendRequest(btn.dataset.remove);
        });
    });
}

async function acceptFriendRequest(requestId) {
    try {
        await firestoreDb.collection(FRIEND_REQUESTS_COLLECTION).doc(requestId).update({
            status: 'accepted',
            respondedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        loadFriendsScreen();
    } catch (e) {
        console.error(e);
        alert('Nem sikerült elfogadni a kérést: ' + (e.message || e));
    }
}

async function removeFriendRequest(requestId) {
    try {
        await firestoreDb.collection(FRIEND_REQUESTS_COLLECTION).doc(requestId).delete();
        loadFriendsScreen();
    } catch (e) {
        console.error(e);
        alert('Nem sikerült törölni: ' + (e.message || e));
    }
}

if (goFriendsBtn) {
    goFriendsBtn.addEventListener('click', () => {
        friendAddMsg.textContent = '';
        friendAddInput.value = '';
        showScreen(friendsScreen);
        loadFriendsScreen();
    });
    friendsBackBtn.addEventListener('click', () => { renderProfileScreen(); showScreen(profileScreen); });
    friendAddBtn.addEventListener('click', sendFriendRequest);
}
