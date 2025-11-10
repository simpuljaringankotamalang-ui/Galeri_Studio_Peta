import {
  saveScore,
  loadLeaderboardRealtime,
  resetLeaderboardListener,
  getPlayerRank
} from "./leaderboard.js";

// ===== AUDIO =====
const bgMusic = document.getElementById("bg-music");
const correctSound = new Audio("/benar.mp3");
const wrongSound = new Audio("/salah.mp3");
correctSound.preload = wrongSound.preload = "auto";

// ===== BACKGROUND =====
const bg = document.querySelector(".game-background");
bg.innerHTML = `
  <div class="bg-layer-1"></div>
  <div class="bg-layer-2"></div>
  <div class="bg-layer-3"></div>
`;

// ===== MAP =====
let map = L.map("map").setView([-7.98, 112.63], 12);
let interactionLocked = true;

function lockMap() {
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
  interactionLocked = true;
}
function unlockMap() {
  map.dragging.enable();
  map.touchZoom.enable();
  map.doubleClickZoom.enable();
  map.scrollWheelZoom.enable();
  map.boxZoom.enable();
  map.keyboard.enable();
  interactionLocked = false;
}
lockMap();

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "",
}).addTo(map);

// ===== GLOBAL VARS =====
let geojsonLayer, currentQuestion = null, score = 0, total = 10;
let kelurahanList = [], skippedList = [];
let answered = 0, correctAnswers = 0, skippedCount = 0, totalTime = 0;
let playerName = "";
let summaryShown = false;
let scoreSaved = false;
let gameEnded = false;

// ===== TIMER =====
let timerInterval, seconds = 0, isRunning = false;
const timerDisplay = document.getElementById("timer");
const resetBtn = document.getElementById("reset");
const startPauseBtn = document.getElementById("start-pause");
const skipBtn = document.getElementById("skip");

function updateTimer() {
  timerDisplay.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function startTimer() {
  if (!isRunning) {
    isRunning = true;
    hidePauseOverlay();
    timerInterval = setInterval(() => {
      seconds++;
      totalTime = seconds;
      updateTimer();
    }, 1000);

    const pauseImg = startPauseBtn.querySelector("img");
    if (pauseImg) pauseImg.src = "image/pause-button.png";
    startPauseBtn.setAttribute("data-state", "pause");
  }
}

function pauseTimer() {
  if (isRunning) {
    isRunning = false;
    clearInterval(timerInterval);
    showPauseOverlay();
    const playImg = startPauseBtn.querySelector("img");
    if (playImg) playImg.src = "image/play.png";
    startPauseBtn.setAttribute("data-state", "play");
  }
}

function stopTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  startPauseBtn.textContent = "Selesai";
  startPauseBtn.disabled = true;
}
updateTimer();

startPauseBtn.addEventListener("click", () => (isRunning ? pauseTimer() : startTimer()));
resetBtn.addEventListener("click", () => location.reload());

// ===== START OVERLAY =====
const startBtn = document.getElementById("startBtn");
const startOverlayEl = document.getElementById("start-overlay");
const playerNameInput = document.getElementById("player-name");

startBtn.addEventListener("click", startGame);

function startGame() {
  playerName = playerNameInput.value.trim();
  if (!playerName) {
    alert("Isi nama dulu Boloo 😁");
    return;
  }

  resetLeaderboardListener();
  document.getElementById("summary-overlay").style.display = "none";

  startOverlayEl.style.transition = "opacity 0.6s ease";
  startOverlayEl.style.opacity = "0";
  startOverlayEl.style.pointerEvents = "none";

  setTimeout(() => {
    startOverlayEl.style.display = "none";
    startOverlayEl.remove();
    unlockMap();
    startTimer();
    map.invalidateSize();
    bgMusic.play();
  }, 600);
}

// ===== LOAD GEOJSON =====
fetch("/Kelurahan.geojson")
  .then((r) => r.json())
  .then((data) => {
    geojsonLayer = L.geoJSON(data, {
      style: { color: "#999", weight: 1, fillColor: "#74b9ff", fillOpacity: 0.3 },
      onEachFeature: (feature, layer) => layer.on("click", () => handleClick(feature, layer)),
    }).addTo(map);

    kelurahanList = shuffle(
      data.features.map((f) => f.properties.WADMKD).filter((n) => n && n.trim() !== "")
    ).slice(0, 10);

    total = kelurahanList.length;
    nextQuestion();
  })
  .catch((err) => console.error(err));

// ===== SHUFFLE =====
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== CURSOR =====
const cursorQuestion = document.createElement("div");
cursorQuestion.id = "cursor-question";
document.body.appendChild(cursorQuestion);
document.addEventListener("mousemove", (e) => {
  cursorQuestion.style.left = e.pageX + 15 + "px";
  cursorQuestion.style.top = e.pageY + 15 + "px";
});

// ===== NEXT QUESTION =====
function nextQuestion() {
  const q = document.getElementById("question");
  if (kelurahanList.length === 0 && skippedList.length > 0) {
    kelurahanList = skippedList;
    skippedList = [];
    showPopup("Mengulang pertanyaan yang dilewati!", "success");
  }
  if (kelurahanList.length === 0 && skippedList.length === 0) {
    endGame();
    return;
  }

  currentQuestion = kelurahanList.pop();
  q.classList.add("fade-out");
  setTimeout(() => {
    q.innerText = `Klik di Kelurahan: ${currentQuestion}`;
    q.classList.remove("fade-out");
    q.classList.add("fade-in");
  }, 300);
  cursorQuestion.innerText = `Klik: ${currentQuestion}`;
  cursorQuestion.style.display = interactionLocked ? "none" : "block";
}

// ===== HANDLE CLICK =====
function handleClick(feature, layer) {
  if (interactionLocked || layer._answered) return;

  const nama = feature.properties.WADMKD;

  if (nama === currentQuestion) {
    correctSound.currentTime = 0;
    correctSound.play();
    layer.setStyle({ fillColor: "#00ff15", fillOpacity: 0.9 });
    layer._answered = true;

    score++;
    correctAnswers++;
    answered++;
    updateProgress();
    showPopup("Yeay benar!!!", "success");
    showAnimeCheer();

    if (!isRunning && seconds === 0) startTimer();

    setTimeout(() => {
      layer.bringToFront();
      map.flyToBounds(layer.getBounds(), { maxZoom: 14, duration: 1.2 });
      setTimeout(() => nextQuestion(), 1200);
    }, 600);

    if (score >= total) {
      endGame();
      stopTimer();
    }
  } else {
    wrongSound.currentTime = 0;
    wrongSound.play();
    layer.setStyle({ fillColor: "#e84118", fillOpacity: 0.8 });
    showPopup("Salah Ker!!!", "error");
    setTimeout(() => {
      if (!layer._answered)
        layer.setStyle({ fillColor: "#74b9ff", fillOpacity: 0.3 });
    }, 700);
  }
}

// ===== SKIP =====
skipBtn.addEventListener("click", () => {
  if (interactionLocked || !currentQuestion) return;
  skippedCount++;
  skippedList.push(currentQuestion);
  showPopup(`Lewatin dulu ${currentQuestion}`, "info");
  nextQuestion();
});

// ===== POPUP =====
function showPopup(message, type) {
  const popup = document.createElement("div");
  popup.className = `popup ${type}`;
  popup.style.pointerEvents = "none";

  let imgSrc = "";
  if (type === "success") imgSrc = "image/lion-benar.png";
  else if (type === "error") imgSrc = "image/lion-salah.png";
  else if (type === "info") imgSrc = "image/lion-skip.png";

  popup.innerHTML = `
    <div class="popup-content">
      <img src="${imgSrc}" class="popup-lion" alt="Lion Icon" />
      <p>${message}</p>
    </div>
  `;

  document.body.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add("show"));
  setTimeout(() => {
    popup.classList.remove("show");
    popup.classList.add("hide");
    setTimeout(() => popup.remove(), 400);
  }, 1600);
}

// ===== UPDATE PROGRESS =====
function updateProgress() {
  const percent = Math.round((score / total) * 100);
  const p = document.getElementById("progress-text");
  p.innerText = `${score} / ${total} (${percent}%)`;
  p.classList.add("pulse");
  setTimeout(() => p.classList.remove("pulse"), 200);
}

// ===== END GAME =====
function endGame() {
  if (gameEnded) return;
  gameEnded = true;
  clearInterval(timerInterval);
  lockMap();
  const q = document.getElementById("question");
  q.innerText = "Semua kelurahan sudah ditebak!";
  q.style.color = "#27ae60";
  q.style.fontWeight = "bold";
  ["start-pause", "reset", "skip"].forEach((id) => (document.getElementById(id).disabled = true));
  cursorQuestion.style.display = "none";
  hidePauseOverlay(true);
  showSummary();
}

// ===== SUMMARY =====
async function showSummary() {
  if (summaryShown) return;
  summaryShown = true;

  const overlay = document.getElementById("summary-overlay");
  overlay.style.display = "flex";
  overlay.classList.add("show");

  triggerVictoryConfetti();

  const correctEl = document.getElementById("summary-correct");
  const timeEl = document.getElementById("summary-time");
  const skippedEl = document.getElementById("summary-skipped");
  

  const correct = correctAnswers || 0;
  const timeUsed = totalTime || 0;
  const skipped = skippedCount || 0;
  

  correctEl.innerHTML = `<img src="image/icon-correct.png" class="summary-icon"> Benar: ${correct}`;
  timeEl.innerHTML = `<img src="image/icon-time.png" class="summary-icon"> Waktu: ${formatTime(timeUsed)}`;
  skippedEl.innerHTML = `<img src="image/icon-skip.png" class="summary-icon"> Dilewati: ${skipped}`;
  

  if (playerName && !scoreSaved) {
    await saveScore(playerName, timeUsed, correct);
    scoreSaved = true;
  }

  // panggil leaderboard realtime
  setTimeout(() => {
    loadLeaderboardRealtime(updatePodium);
  }, 800);

  const { rank, total } = await getPlayerRank(playerName);

  const rankEl = document.getElementById("player-rank-result");
  rankEl.style.display = "block";
  rankEl.textContent = rank
    ? `🏅 Kamu peringkat ke-${rank} dari ${total} pemain`
    : "❓ Belum terdaftar di leaderboard";
  const restartBtn = document.getElementById("summary-restart");
  overlay.querySelector(".summary-content").insertBefore(rankBox, restartBtn);
}

// ===== AUTO UPDATE PODIUM (FIX) =====
function updatePodium(leaderboard = []) {
  // pastiin leaderboard berupa array of object
  if (!Array.isArray(leaderboard)) return;

  // ambil top 3 (kalau kurang, isi dengan slot kosong)
  const top3 = leaderboard.slice(0, 3);
  const defaultNames = ["-", "-", "-"];

  for (let i = 0; i < 3; i++) {
    const player = top3[i];
    const nameSlot = document.querySelector(`.podium-${i + 1} .podium-name`);

    if (nameSlot) {
      nameSlot.textContent = player?.name || defaultNames[i];
    }
  }
}

// ===== RESTART =====
document.getElementById("summary-restart").addEventListener("click", () => {
  const overlay = document.getElementById("summary-overlay");
  overlay.classList.remove("show");
  setTimeout(() => {
    overlay.style.display = "none";
    location.reload();
  }, 400);
});

// ===== PAUSE OVERLAY =====
function showPauseOverlay() {
  document.getElementById("pause-overlay").classList.add("active");
  lockMap();
}
function hidePauseOverlay() {
  document.getElementById("pause-overlay").classList.remove("active");
  unlockMap();
}

function formatTime(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}
function showAnimeCheer() {}

function triggerVictoryConfetti() {
  const podium = document.querySelector(".podium-1");
  if (!podium) return;

  const defaults = {
    startVelocity: 20,
    spread: 360,
    ticks: 80,
    zIndex: 9999
  };

  let isRunning = true;

  function fireConfetti() {
    if (!isRunning) return;

    const podiumRect = podium.getBoundingClientRect();
    const characterHeight = podiumRect.height;

    confetti({
      ...defaults,
      particleCount: 8,
      origin: {
        x: (podiumRect.left + window.scrollX + podiumRect.width / 0.65) / document.documentElement.clientWidth,
        y: (podiumRect.top + window.scrollY - characterHeight * 0.40) / document.documentElement.clientHeight
      },
      colors: ['#ffd700', '#ff5c5c', '#00ff7a', '#00b8ff']
    });

    setTimeout(fireConfetti, 300);
  }

  fireConfetti();

  // update posisi confetti pas layar di-resize atau rotasi
  window.addEventListener("resize", () => {
    isRunning = false;
    setTimeout(() => {
      isRunning = true;
      fireConfetti();
    }, 300);
  });

  window.addEventListener("orientationchange", () => {
    isRunning = false;
    setTimeout(() => {
      isRunning = true;
      fireConfetti();
    }, 500);
  });
}


