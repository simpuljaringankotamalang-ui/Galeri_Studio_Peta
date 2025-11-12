import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  where,
  deleteDoc,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let unsubscribe = null;
let leaderboardInitiated = false;

const leaderboardRef = collection(db, "leaderboard");
const EXPIRE_TIME_MS = 5 * 60 * 1000; // 5 menit

/* =====================================================
    SISTEM RESERVASI NAMA (ANTI DOBEL + AUTO EXPIRE)
===================================================== */
export async function reservePlayerName(name) {
  try {
    const cleanName = name.trim().toLowerCase();
    const playerRef = doc(db, "activePlayers", cleanName);
    const docSnap = await getDoc(playerRef);

    // ====== 1️⃣ CEK di leaderboard (sudah pernah main)
    const leaderboardQuery = query(
      collection(db, "leaderboard"),
      where("name", "==", name)
    );
    const leaderboardSnap = await getDocs(leaderboardQuery);
    if (!leaderboardSnap.empty) {
      console.warn(`🚫 Nama "${name}" sudah pernah main, ganti nama lain.`);
      return false;
    }

    // ====== 2️⃣ CEK di activePlayers (lagi main)
    if (docSnap.exists()) {
      const data = docSnap.data();
      const started = data.startTime?.toMillis?.() || 0;
      const elapsed = Date.now() - started;

      if (elapsed < EXPIRE_TIME_MS) {
        console.warn(`🚫 Nama "${name}" masih aktif (${Math.round(elapsed / 1000)} detik lalu).`);
        return false;
      }

      // kalau expired, hapus dokumen lama
      await deleteDoc(playerRef);
      console.log(`🧹 Nama "${name}" expired, dihapus otomatis.`);
    }

    // kalau aman → simpan reservasi baru
    await setDoc(playerRef, {
      name,
      status: "playing",
      startTime: serverTimestamp(),
    });

    console.log(`✅ Nama "${name}" berhasil direservasi`);
    return true;
  } catch (e) {
    console.error("❌ Gagal reserve nama:", e);
    return false;
  }
}

/* =====================================================
    LEPAS NAMA SAAT SELESAI / KELUAR GAME
===================================================== */
export async function releasePlayerName(name) {
  try {
    const cleanName = name.trim().toLowerCase();
    const playerRef = doc(db, "activePlayers", cleanName);
    await deleteDoc(playerRef);
    console.log(`🧹 Nama "${name}" dilepas kembali`);
  } catch (e) {
    console.error("Gagal hapus reservasi nama:", e);
  }
}

/* =====================================================
    SIMPAN SKOR KE LEADERBOARD
===================================================== */
export async function saveScore(name, time, correct) {
  try {
    const snapshot = await getDocs(query(leaderboardRef, orderBy("time", "asc")));
    let existingDoc = null;

    snapshot.forEach((doc) => {
      if (doc.data().name.toLowerCase() === name.toLowerCase()) {
        existingDoc = doc;
      }
    });

    if (existingDoc) {
      const oldTime = existingDoc.data().time;
      if (time < oldTime) {
        await addDoc(leaderboardRef, {
          name,
          time,
          correct,
          createdAt: serverTimestamp(),
        });
      }
    } else {
      await addDoc(leaderboardRef, {
        name,
        time,
        correct,
        createdAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.error("❌ Gagal nyimpen skor:", e);
  }
}

/* =====================================================
    LOAD LEADERBOARD REALTIME
===================================================== */
export function loadLeaderboardRealtime(updatePodiumCallback) {
  const list = document.getElementById("leaderboard-list");
  if (!list) return;

  if (leaderboardInitiated) return;
  leaderboardInitiated = true;

  const q = query(leaderboardRef, orderBy("time", "asc"), limit(10));

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      list.innerHTML = "";

      let index = 0;
      const leaderboardData = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        leaderboardData.push(data);

        const li = document.createElement("li");
        li.classList.add("player-entry");
        li.style.animationDelay = `${index * 0.12}s`;

        let medalHTML = "";
        if (index === 0) {
          li.classList.add("gold");
          medalHTML = createMedalIcon("gold");
        } else if (index === 1) {
          li.classList.add("silver");
          medalHTML = createMedalIcon("silver");
        } else if (index === 2) {
          li.classList.add("bronze");
          medalHTML = createMedalIcon("bronze");
        }

        const numberPrefix = index >= 3 ? `${index + 1}. ` : "";

        li.innerHTML = `
          <div class="player-row">
            ${medalHTML}
            <span class="player-name">${numberPrefix}${data.name}</span>
          </div>
          <div class="player-stats">
            <span class="player-time"><img src="image/icon-jam.png" class="stat-icon" alt="Time">${formatTime(data.time)}</span>
            <span class="player-correct"><img src="image/icon-centang.png" class="stat-icon" alt="Correct">${data.correct}</span>
          </div>
        `;

        list.appendChild(li);
        index++;
      });

      if (snapshot.size > 0) {
        spawnConfetti(list.parentElement);
      }

      if (typeof updatePodiumCallback === "function") {
        updatePodiumCallback(leaderboardData);
      }
    },
    (error) => {
      console.error("⚠️ Gagal memuat leaderboard realtime:", error);
      list.innerHTML = "<li>Gagal memuat leaderboard 😢</li>";
    }
  );
}

/* =====================================================
    AMBIL RANK PEMAIN
===================================================== */
export function watchPlayerRank(name, callback) {
  const qAll = query(leaderboardRef, orderBy("time", "asc"));
  unsubscribe = onSnapshot(qAll, (snapshot) => {
    const allPlayers = snapshot.docs.map((doc) => doc.data());
    const index = allPlayers.findIndex(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    const rank = index >= 0 ? index + 1 : null;
    const total = allPlayers.length;

    if (typeof callback === "function") {
      callback({ rank, total });
    }
  });
}

/* =====================================================
    RESET LISTENER
===================================================== */
export function resetLeaderboardListener() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  leaderboardInitiated = false;
}

/* =====================================================
    UTILITAS TAMBAHAN
===================================================== */
function createMedalIcon(type) {
  const srcMap = {
    gold: "image/medal-gold.png",
    silver: "image/medal-silver.png",
    bronze: "image/medal-bronze.png",
  };
  return `<img src="${srcMap[type] || srcMap.gold}" alt="${type} medal" class="medal-icon ${type}" />`;
}

function spawnConfetti(container) {
  if (!container) return;
  for (let i = 0; i < 12; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.animationDelay = `${Math.random() * 2}s`;
    container.appendChild(confetti);
    setTimeout(() => confetti.remove(), 3000);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" + s : s}`;
}
