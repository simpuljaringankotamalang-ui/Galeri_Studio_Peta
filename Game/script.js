// 🌌 Tambah 3 layer background TANPA menimpa isi game-container
const bg = document.querySelector(".game-background");
bg.innerHTML = `
  <div class="bg-layer-1"></div>
  <div class="bg-layer-2"></div>
  <div class="bg-layer-3"></div>
`;

//map
let map = L.map('map').setView([-7.98, 112.63], 12);

//Kunci interaksi map sebelum mulai
map.dragging.disable();
map.touchZoom.disable();
map.doubleClickZoom.disable();
map.scrollWheelZoom.disable();
map.boxZoom.disable();
map.keyboard.disable();

let interactionLocked = true;

//Overlay sebelum mulai
const startOverlay = document.createElement("div");
startOverlay.id = "start-overlay";
startOverlay.innerHTML = `
  <div class="start-content">
    <img src="image/start-screen.png" alt="Start Game" class="start-img">
    <p>Klik "Mulai" untuk memulai permainan ⚔️</p>
  </div>
`;
document.querySelector(".map-frame").appendChild(startOverlay);


//overlay pause
const mapOverlay = document.createElement("div");
mapOverlay.id = "map-overlay";
mapOverlay.textContent = "⏸️ PAUSED";
document.querySelector(".map-frame").appendChild(mapOverlay);

//Basemap
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: ''
}).addTo(map);

let geojsonLayer;
let currentQuestion = null;
let score = 0;
let total = 57;
let kelurahanList = [];
let skippedList = [];
let answered = 0;

//Timer logic
let timerInterval;
let seconds = 0;
let isRunning = false;

const timerDisplay = document.getElementById("timer");
const resetBtn = document.getElementById("reset");
const startPauseBtn = document.getElementById("start-pause");
startPauseBtn.classList.add("coc-btn");

//Update timer display
function updateTimer() {
  if (!isRunning && seconds === 0) {
    timerDisplay.textContent = "--:--";
  } else {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    timerDisplay.textContent = `${mins}:${secs}`;
  }
}

//Start timer
function startTimer() {
  if (!isRunning) {
    isRunning = true;
    startPauseBtn.textContent = "Pause ⏸️";
    startPauseBtn.classList.remove("pause");
    startPauseBtn.classList.add("start");
    timerInterval = setInterval(() => {
      seconds++;
      updateTimer();
    }, 1000);
  }
}

//Pause timer
function pauseTimer() {
  if (isRunning) {
    isRunning = false;
    startPauseBtn.textContent = "Lanjut ▶️";
    startPauseBtn.classList.remove("start");
    startPauseBtn.classList.add("pause");
    clearInterval(timerInterval);
  }
}

//Reset timer
function resetTimer() {
  clearInterval(timerInterval);
  seconds = 0;
  isRunning = false;
  startPauseBtn.textContent = "Mulai ▶️";
  startPauseBtn.classList.remove("pause");
  startPauseBtn.classList.remove("start");
  updateTimer();
}

//Stop timer
function stopTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  startPauseBtn.textContent = "Selesai ✅";
  startPauseBtn.disabled = true;
}

//Tombol Start/Pause
startPauseBtn.addEventListener("click", () => {
  if (!isRunning) {
    startTimer();

    //Hide overlay start
    startOverlay.classList.add("hidden");
    setTimeout(() => startOverlay.remove(), 800); // biar bener-bener ilang
    map.invalidateSize();

    //Aktifkan interaksi map
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
    interactionLocked = false;

    // Hilangkan overlay pause
    mapOverlay.classList.remove("active");
  } else {
    pauseTimer();

    //Kunci interaksi map
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    interactionLocked = true;

    //overlay pause
    mapOverlay.classList.add("active");
  }
});

resetBtn.addEventListener("click", () => location.reload());

// Awal tampilan
updateTimer();

//Data GeoJSON
fetch("Kelurahan.geojson")
  .then(res => res.json())
  .then(data => {
    geojsonLayer = L.geoJSON(data, {
      style: {
        color: "#999",
        weight: 1,
        fillColor: "#74b9ff",
        fillOpacity: 0.3
      },
      onEachFeature: (feature, layer) => {
        const nama = feature.properties.WADMKD;
        layer.on("click", () => handleClick(feature, layer));
      }
    }).addTo(map);

    kelurahanList = shuffle(
      data.features.map(f => f.properties.WADMKD).filter(n => n && n.trim() !== "")
    );

    nextQuestion();
  })
  .catch(err => console.error("Gagal ambil GeoJSON:", err));

//Acak urutan
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

//Pertanyaan baru
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
  cursorQuestion.style.display = "block";
}

//Klik jawaban
function handleClick(feature, layer) {
  if (interactionLocked) return;
  if (layer._answered) return;

  const nama = feature.properties.WADMKD;

  if (nama === currentQuestion) {
    layer.setStyle({ fillColor: "#00ff15ff", fillOpacity: 0.9 });
    layer._answered = true;
    score++;
    answered++;
    updateProgress();
    showPopup("Yeay benar!!", "success");
    showAnimeCheer();

    if (!isRunning && seconds === 0) startTimer();

    setTimeout(() => {
      layer.bringToFront();
      map.flyToBounds(layer.getBounds(), { maxZoom: 14, duration: 1.2 });
      layer.setStyle({ color: "#fff", weight: 2 });
      setTimeout(() => {
        layer.setStyle({ color: "#999", weight: 1, fillColor: "#24f959ff", fillOpacity: 0.8 });
        nextQuestion();
      }, 1200);
    }, 600);

    if (score >= total) {
      endGame();
      stopTimer();
    }

  } else {
    layer.setStyle({ fillColor: "#e84118", fillOpacity: 0.8 });
    showPopup("Salah bolo!! 😩", "error");
    setTimeout(() => {
      if (!layer._answered) {
        layer.setStyle({ fillColor: "#74b9ff", fillOpacity: 0.3 });
      }
    }, 700);
  }
}

//Update skor
function updateProgress() {
  let percent = Math.round((score / total) * 100);
  const p = document.getElementById("progress-text");
  p.innerText = `${score} / ${total} (${percent}%)`;
  p.classList.add("pulse");
  setTimeout(() => p.classList.remove("pulse"), 200);
}

//end game
function endGame() {
  clearInterval(timerInterval);
  document.getElementById("question").innerText = "🎉 Semua kelurahan sudah ditebak!";
  document.getElementById("question").style.color = "#27ae60";
  document.getElementById("question").style.fontWeight = "bold";
  document.getElementById("next").disabled = true;
  cursorQuestion.style.display = "none";
}

//Popup kecil
function showPopup(text, type) {
  const popup = document.createElement("div");
  popup.className = `popup-message ${type}`;
  popup.innerText = text;
  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add("fade-out"), 600);
  setTimeout(() => popup.remove(), 1000);
}

//Cursor label target
const cursorQuestion = document.createElement("div");
cursorQuestion.id = "cursor-question";
document.body.appendChild(cursorQuestion);

//Posisi kursor
document.addEventListener("mousemove", (e) => {
  cursorQuestion.style.left = e.pageX + 15 + "px";
  cursorQuestion.style.top = e.pageY + 15 + "px";
});

//Efek cheer
function showAnimeCheer() {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(0,0,0,0.7) 100%)";
  overlay.style.zIndex = "9998";
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.4s ease";
  document.body.appendChild(overlay);

  const img = document.createElement("img");
  img.src = "https://media.tenor.com/zWj5pMHNIW8AAAAi/tiredamityyt-ever-night.gif";
  img.style.position = "fixed";
  img.style.top = "50%";
  img.style.left = "50%";
  img.style.transform = "translate(-50%, -50%) scale(0.8)";
  img.style.width = "400px";
  img.style.zIndex = "9999";
  img.style.pointerEvents = "none";
  img.style.opacity = "0";
  img.style.transition = "opacity 0.5s ease, transform 0.5s ease";
  img.style.filter = "drop-shadow(0 0 25px rgba(255,255,255,0.9))";
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
