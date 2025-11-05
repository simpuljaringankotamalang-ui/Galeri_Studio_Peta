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
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

let unsubscribe = null;
let leaderboardInitiated = false;

const leaderboardRef = collection(db, "leaderboard");

//Simpan skor ke Firestore (update kalau lebih cepat)
export async function saveScore(name, time, correct) {
  try {
    const snapshot = await getDocs(query(leaderboardRef, orderBy("time", "asc")));
    let existingDoc = null;

    snapshot.forEach((doc) => {
      if (doc.data().name.toLowerCase() === name.toLowerCase()) {
        existingDoc = doc;
      }
    });

    //Kalau udah ada tapi waktu baru lebih cepat → update
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

//Load leaderboard realtime
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

      //kirim data ke callback podium
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

// Icon medali pakai gambar PNG custom
function createMedalIcon(type) {
  let medalSrc = "";

  switch (type) {
    case "gold":
      medalSrc = "image/medal-gold.png";
      break;
    case "silver":
      medalSrc = "image/medal-silver.png";
      break;
    case "bronze":
      medalSrc = "image/medal-bronze.png";
      break;
    default:
      medalSrc = "image/medal-gold.png";
  }

  return `
    <img src="${medalSrc}" 
         alt="${type} medal" 
         class="medal-icon ${type}" />
  `;
}

//Confetti warna pastel
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

//Ambil rank pemain
export async function getPlayerRank(name) {
  const qAll = query(leaderboardRef, orderBy("time", "asc"));
  const snapshot = await getDocs(qAll);
  const allPlayers = snapshot.docs.map((doc) => doc.data());
  const index = allPlayers.findIndex(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  const rank = index >= 0 ? index + 1 : null;
  const total = allPlayers.length;
  return { rank, total };
}

//Reset listener
export function resetLeaderboardListener() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  leaderboardInitiated = false;
}

//Format waktu
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" + s : s}`;
}
