const bgMusic = document.getElementById("bg-music");
const correctSound = new Audio("/benar.mp3");
const wrongSound = new Audio("/salah.mp3");

correctSound.preload = "auto";
wrongSound.preload = "auto";

// =================== BACKGROUND ===================
const bg = document.querySelector(".game-background");
bg.innerHTML = `
  <div class="bg-layer-1"></div>
  <div class="bg-layer-2"></div>
  <div class="bg-layer-3"></div>
`;

// =================== MAP INIT ===================
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

// =================== OVERLAYS ===================
const mapOverlay = document.createElement("div");
mapOverlay.id = "map-overlay";
document.querySelector(".map-frame").appendChild(mapOverlay);

// =================== BASEMAP ===================
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: "",
}).addTo(map);

// =================== VARIABEL GLOBAL ===================
let geojsonLayer;
let currentQuestion = null;
let score = 0;
let total = 10;
let kelurahanList = [];
let skippedList = [];
let answered = 0;
let correctAnswers = 0;
let skippedCount = 0;
let totalTime = 0;

// =================== TIMER ===================
let timerInterval;
let seconds = 0;
let isRunning = false;

const timerDisplay = document.getElementById("timer");
const resetBtn = document.getElementById("reset");
const startPauseBtn = document.getElementById("start-pause");
const skipBtn = document.getElementById("skip");

function updateTimer() {
  if (!isRunning && seconds === 0) {
    timerDisplay.textContent = "--:--";
  } else {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    timerDisplay.textContent = `${mins}:${secs}`;
  }
}

function startTimer() {
  if (!isRunning) {
    isRunning = true;
    startPauseBtn.textContent = "Pause ⏸️";
    hidePauseOverlay();
    timerInterval = setInterval(() => {
      seconds++;
      totalTime = seconds;
      updateTimer();
    }, 1000);
  }
}

function pauseTimer() {
  if (isRunning) {
    isRunning = false;
    startPauseBtn.textContent = "Lanjut ▶️";
    clearInterval(timerInterval);
    showPauseOverlay();
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  seconds = 0;
  totalTime = 0;
  isRunning = false;
  startPauseBtn.textContent = "Mulai ▶️";
  updateTimer();
}

function stopTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  startPauseBtn.textContent = "Selesai ✅";
  startPauseBtn.disabled = true;
}

// =================== BUTTON EVENTS ===================
startPauseBtn.addEventListener("click", () => {
  if (!isRunning) {
    startTimer();
    unlockMap();
  } else {
    pauseTimer();
    lockMap();
  }
});

resetBtn.addEventListener("click", () => location.reload());
updateTimer();

// =================== START BUTTON (overlay manual) ===================
const startBtn = document.getElementById("start-btn");
const startOverlayEl = document.getElementById("start-overlay");

startBtn.addEventListener("click", () => {
  startOverlayEl.classList.add("hidden");
  setTimeout(() => startOverlayEl.remove(), 800);
  unlockMap();
  startTimer();
  map.invalidateSize();
  bgMusic.play();
});

// =================== LOAD GEOJSON ===================
fetch("/Kelurahan.geojson")
  .then((res) => res.json())
  .then((data) => {
    geojsonLayer = L.geoJSON(data, {
      style: {
        color: "#999999ff",
        weight: 1,
        fillColor: "#74b9ff",
        fillOpacity: 0.3,
      },
      onEachFeature: (feature, layer) => {
        const nama = feature.properties.WADMKD;
        layer.on("click", () => handleClick(feature, layer));
      },
    }).addTo(map);

    kelurahanList = shuffle(
      data.features
        .map((f) => f.properties.WADMKD)
        .filter((n) => n && n.trim() !== "")
    ).slice(0, 10);

    total = kelurahanList.length;
    nextQuestion();
  })
  .catch((err) => console.error("Gagal ambil GeoJSON:", err));

// =================== SHUFFLE ===================
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// =================== NEXT QUESTION ===================
function nextQuestion() {
  const q = document.getElementById("question");

  if (kelurahanList.length === 0 && skippedList.length > 0) {
    kelurahanList = skippedList;
    skippedList = [];
    showPopup("🔁 Mengulang pertanyaan yang dilewati!", "success");
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

// =================== SKIP BUTTON ===================
skipBtn.addEventListener("click", () => {
  if (interactionLocked || !currentQuestion) return;
  skippedCount++;
  skippedList.push(currentQuestion);
  showPopup(`Lewatin dulu ${currentQuestion} 😅`, "info");
  nextQuestion();
});

// =================== HANDLE CLICK ===================
function handleClick(feature, layer) {
  if (interactionLocked || layer._answered) return;
  const nama = feature.properties.WADMKD;

  if (nama === currentQuestion) {
    correctSound.currentTime = 0;
    correctSound.play();
    layer.setStyle({ fillColor: "#00ff15ff", fillOpacity: 0.9 });
    layer._answered = true;
    score++;
    correctAnswers++;
    answered++;
    updateProgress();
    showPopup("Yeay benar!!", "success");
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
    showPopup("Salah Ker!!! 😩", "error");
    setTimeout(() => {
      if (!layer._answered) {
        layer.setStyle({ fillColor: "#74b9ff", fillOpacity: 0.3 });
      }
    }, 700);
  }
}

// =================== UPDATE PROGRESS ===================
function updateProgress() {
  const percent = Math.round((score / total) * 100);
  const p = document.getElementById("progress-text");
  p.innerText = `${score} / ${total} (${percent}%)`;
  p.classList.add("pulse");
  setTimeout(() => p.classList.remove("pulse"), 200);
}

// =================== END GAME ===================
function endGame() {
  clearInterval(timerInterval);
  lockMap();
  showPauseOverlay();

  const q = document.getElementById("question");
  q.innerText = "🎉 Semua kelurahan sudah ditebak!";
  q.style.color = "#27ae60";
  q.style.fontWeight = "bold";

  ["start-pause", "reset", "skip"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });

  cursorQuestion.style.display = "none";
  showSummary();
}

// ===================== SUMMARY SCREEN =====================
function showSummary() {
  const overlay = document.getElementById("summary-overlay");
  const correctEl = document.getElementById("summary-correct");
  const skippedEl = document.getElementById("summary-skipped");
  const timeEl = document.getElementById("summary-time");
  const stars = document.querySelectorAll(".star");

  correctEl.textContent = `✅ Benar: ${correctAnswers}`;
  skippedEl.textContent = `💔 Lewati: ${skippedCount}`;
  timeEl.textContent = `⏱ Waktu: ${formatTime(totalTime)}`;

  const scoreRatio = correctAnswers / total;
  const speedScore = totalTime / total;
  let rating = 1;
  if (scoreRatio >= 0.9 && speedScore <= 20) rating = 3;
  else if (scoreRatio >= 0.7 && speedScore <= 35) rating = 2;

  stars.forEach((s, i) => {
    setTimeout(() => s.classList.toggle("active", i < rating), i * 200);
  });

  overlay.classList.add("show");
  document.getElementById("map").style.pointerEvents = "none";
}

document.getElementById("summary-restart").addEventListener("click", () => {
  const overlay = document.getElementById("summary-overlay");
  overlay.classList.remove("show");

  setTimeout(() => {
    overlay.style.display = "none";
    resetGame();
    document.getElementById("map").style.pointerEvents = "auto";
  }, 300);
});

function formatTime(sec) {
  const mins = Math.floor(sec / 60).toString().padStart(2, "0");
  const secs = (sec % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

// =================== POPUP ===================
function showPopup(text, type) {
  const popup = document.createElement("div");
  popup.className = `popup-message ${type}`;
  popup.innerText = text;
  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add("fade-out"), 600);
  setTimeout(() => popup.remove(), 1000);
}

// =================== CURSOR LABEL ===================
const cursorQuestion = document.createElement("div");
cursorQuestion.id = "cursor-question";
document.body.appendChild(cursorQuestion);

document.addEventListener("mousemove", (e) => {
  cursorQuestion.style.left = e.pageX + 15 + "px";
  cursorQuestion.style.top = e.pageY + 15 + "px";
});

// =================== ANIME CHEER ===================
function showAnimeCheer() {
  const overlay = document.createElement("div");
  overlay.style = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.7) 100%);
    z-index: 9998; opacity: 0;
    transition: opacity 0.4s ease;
  `;
  document.body.appendChild(overlay);

  const img = document.createElement("img");
  img.src = "https://media.tenor.com/zWj5pMHNIW8AAAAi/tiredamityyt-ever-night.gif";
  img.style = `
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    width: 400px; z-index: 9999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.5s ease, transform 0.5s ease;
    filter: drop-shadow(0 0 25px rgba(255,255,255,0.9));
  `;
  document.body.appendChild(img);

  setTimeout(() => {
    overlay.style.opacity = "1";
    img.style.opacity = "1";
    img.style.transform = "translate(-50%, -50%) scale(1)";
  }, 100);

  setTimeout(() => {
    overlay.style.opacity = "0";
    img.style.opacity = "0";
    img.style.transform = "translate(-50%, -50%) scale(0.9)";
    setTimeout(() => {
      overlay.remove();
      img.remove();
    }, 600);
  }, 3000);
}

// =================== PAUSE OVERLAY ===================
function showPauseOverlay() {
  const overlay = document.getElementById("map-overlay");
  overlay.classList.add("active");
  document.getElementById("map").style.pointerEvents = "none";
}

function hidePauseOverlay() {
  const overlay = document.getElementById("map-overlay");
  overlay.classList.remove("active");
  document.getElementById("map").style.pointerEvents = "auto";
}

function showResumeOverlay() {

  setTimeout(() => overlay.classList.add("show"), 10);
  setTimeout(() => overlay.classList.remove("show"), 1500);
  setTimeout(() => overlay.remove(), 2000);
}

// =================== OVERLAY PAUSE ===================
function showPauseOverlay() {
  let overlay = document.getElementById("pause-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pause-overlay";
    overlay.textContent = "⏸️ PAUSED";
    document.body.appendChild(overlay);
  }
  overlay.classList.add("show");
}

function hidePauseOverlay() {
  const overlay = document.getElementById("pause-overlay");
  if (overlay) overlay.classList.remove("show");
}

// Tambahin ke hidePauseOverlay biar muncul pas resume
const originalHidePauseOverlay = hidePauseOverlay;
hidePauseOverlay = function() {
  originalHidePauseOverlay();
  showResumeOverlay();
};

// =================== RESET GAME ===================
function resetGame() {
  score = 0;
  correctAnswers = 0;
  skippedCount = 0;
  answered = 0;
  seconds = 0;
  totalTime = 0;
  updateTimer();
  location.reload();
}
