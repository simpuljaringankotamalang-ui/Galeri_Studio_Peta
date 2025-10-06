const playBtn = document.getElementById("playBtn");
const result = document.getElementById("result");

const locations = [
  "Alun-Alun Kota Malang",
  "Balai Kota Malang",
  "Kampung Warna-Warni Jodipan",
  "Universitas Brawijaya",
  "Jalan Ijen",
  "Pasar Besar Malang",
  "Batu Night Spectacular",
];

playBtn.addEventListener("click", () => {
  const random = locations[Math.floor(Math.random() * locations.length)];
  result.innerHTML = `<h2>Kamu menebak: <span>${random}</span> 🗺️</h2>`;
});
