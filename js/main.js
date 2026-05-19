/**
 * ================================================================
 * Peta Wisata Indonesia — main.js  (fix v3)
 * D3.js v7  |  100% File Lokal — Zero CDN
 * ================================================================
 * FIX:
 * 1. Filter outlier: "Pelabuhan Marina" (Lat=1.07 → koordinat salah)
 * 2. Initial view: fokus ke Jawa (semua 437 data ada di sana)
 * 3. Reset → tampil seluruh Indonesia
 * 4. Warna land kontras vs ocean
 * 5. [FIXED] Logika domain skala radius rating diperlebar (2 sampai 5)
 * 6. [FIXED] Penghapusan dead-code pada logika update KPI
 * ================================================================
 */

"use strict";

/* ── 1. CONFIG ──────────────────────────────────────────── */

const CAT_COLOR = {
  "Taman Hiburan"      : "#ff5e5e",
  "Budaya"             : "#a78bfa",
  "Cagar Alam"         : "#4ade80",
  "Bahari"             : "#38bdf8",
  "Tempat Ibadah"      : "#fbbf24",
  "Pusat Perbelanjaan" : "#fb923c",
};

const CITY_COORD = {
  "Jakarta"    : [106.865, -6.200],
  "Bandung"    : [107.619, -6.918],
  "Yogyakarta" : [110.369, -7.795],
  "Semarang"   : [110.438, -7.005],
  "Surabaya"   : [112.752, -7.257],
};

// Semua file lokal
const FILE_GEOJSON = "data/indonesia.geojson";
const FILE_PLACES  = "data/tourism_with_id.csv";
const FILE_RATINGS = "data/tourism_rating.csv";

// Bounding box Jawa (dari data aktual)
// Lat: -8.19 s/d -5.59 | Long: 106.52 s/d 112.82
const JAVA_CENTER  = [109.67, -6.89];
const JAVA_ZOOM_K  = 6;   // zoom level initial ke Jawa


/* ── 2. SVG SETUP ───────────────────────────────────────── */

const mapArea = document.getElementById("map-area");
let W = mapArea.clientWidth  || 960;
let H = mapArea.clientHeight || 460;

const svg = d3.select("#map-svg")
  .attr("width", W).attr("height", H)
  .attr("viewBox", `0 0 ${W} ${H}`);

svg.append("rect").attr("class","ocean-bg").attr("width",W).attr("height",H);
const gMain = svg.append("g").attr("class","g-main");


/* ── 3. PROYEKSI  d3.geoMercator() ─────────────────────── */

/**
 * Proyeksi wide Indonesia — center [118, -2.5]
 * Saat load pertama kali langsung di-zoom ke Jawa via d3.zoom transform
 * User bisa reset untuk lihat seluruh Indonesia
 */
const projection = d3.geoMercator()
  .center([118, -2.5])
  .scale(W * 0.86)
  .translate([W / 2, H / 2]);

const geoPath = d3.geoPath().projection(projection);


/* ── 4. GRATICULE ───────────────────────────────────────── */

gMain.append("path")
  .datum(d3.geoGraticule().step([10, 10])())
  .attr("class","graticule")
  .attr("d", geoPath);


/* ── 5. SCALE RADIUS ────────────────────────────────────── */

// PERBAIKAN: Domain dilebarkan ke [2, 5] dan range ke [4, 15] agar rating 5 lebih terlihat menonjol
const rScale = d3.scaleSqrt().domain([2, 5]).range([4, 15]).clamp(true);


/* ── 6. ZOOM & PAN  d3.zoom() ──────────────────────────── */

let currentK = 1;

const zoomBehavior = d3.zoom()
  .scaleExtent([1, 20])
  .on("zoom", (event) => {
    currentK = event.transform.k;
    gMain.attr("transform", event.transform);
    // Radius dikompensasi agar tetap terbaca
    const kSqrt = Math.sqrt(currentK);
    gMain.selectAll(".place-dot").attr("r", d => rScale(d.avgRating) / kSqrt);
    gMain.selectAll(".city-label").attr("font-size", `${10 / kSqrt}px`);
  });

svg.call(zoomBehavior);

// Tombol zoom manual
document.getElementById("btn-zin")
  .addEventListener("click", () => svg.transition().duration(320).call(zoomBehavior.scaleBy, 1.6));
document.getElementById("btn-zout")
  .addEventListener("click", () => svg.transition().duration(320).call(zoomBehavior.scaleBy, 0.625));
document.getElementById("btn-zrst")
  .addEventListener("click", resetToIndonesia);

/** Reset ke view seluruh Indonesia */
function resetToIndonesia() {
  svg.transition().duration(700).ease(d3.easeCubicInOut)
    .call(zoomBehavior.transform, d3.zoomIdentity);
  currentK = 1;
  document.querySelectorAll(".cbtn").forEach(b => b.classList.remove("active"));
  document.querySelector('[data-city="all"]').classList.add("active");
}

/** Zoom programatik ke koordinat [lng, lat] */
function zoomToPoint(lngLat, k = 8) {
  const [cx, cy] = projection(lngLat);
  const tx = W / 2 - k * cx;
  const ty = H / 2 - k * cy;
  svg.transition().duration(700).ease(d3.easeCubicInOut)
    .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
}

/** Zoom awal ke Jawa (dipanggil setelah render selesai) */
function setInitialView() {
  const [cx, cy] = projection(JAVA_CENTER);
  const tx = W / 2 - JAVA_ZOOM_K * cx;
  const ty = H / 2 - JAVA_ZOOM_K * cy;
  // Langsung set tanpa animasi (view awal)
  svg.call(zoomBehavior.transform,
    d3.zoomIdentity.translate(tx, ty).scale(JAVA_ZOOM_K));
  currentK = JAVA_ZOOM_K;
}


/* ── 7. TOOLTIP ─────────────────────────────────────────── */

const ttEl    = document.getElementById("tooltip");
const ttName  = document.getElementById("tt-name");
const ttBadge = document.getElementById("tt-badge");
const ttRows  = document.getElementById("tt-rows");

function starHTML(r) {
  const f = Math.round(r), e = 5 - f;
  return `<span class="tt-stars" style="color:#fbbf24">${"★".repeat(f)}</span>`
       + `<span style="color:var(--tx-3)">${"★".repeat(e)}</span>`;
}

function showTooltip(event, d) {
  const color = CAT_COLOR[d.category] || "#aaa";
  ttName.textContent  = d.name;
  ttBadge.textContent = d.category;
  ttBadge.style.cssText = `background:${color}22;color:${color};border:1px solid ${color}44;`;
  ttRows.innerHTML = `
    <div class="tt-row">
      <span class="lbl">Rating Pengguna</span>
      <span class="val">${d.avgRating.toFixed(2)} ${starHTML(d.avgRating)}</span>
    </div>
    <div class="tt-row">
      <span class="lbl">Jumlah Ulasan</span>
      <span class="val">${d.ratingCount} orang</span>
    </div>
    <div class="tt-div"></div>
    <div class="tt-row">
      <span class="lbl">Kota</span>
      <span class="val">${d.city}</span>
    </div>
    <div class="tt-row">
      <span class="lbl">Harga Masuk</span>
      <span class="val">${d.price === 0 ? "Gratis" : "Rp " + d.price.toLocaleString("id-ID")}</span>
    </div>
    <div class="tt-row">
      <span class="lbl">Koordinat</span>
      <span class="val">${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}</span>
    </div>`;
  ttEl.classList.remove("hidden");
  moveTooltip(event);
}

function moveTooltip(event) {
  const rect = mapArea.getBoundingClientRect();
  let tx = event.clientX - rect.left + 14;
  let ty = event.clientY - rect.top  - 16;
  if (tx + 240 > W) tx = event.clientX - rect.left - 254;
  if (ty + 220 > H) ty = event.clientY - rect.top  - 220;
  ttEl.style.left = `${tx}px`;
  ttEl.style.top  = `${ty}px`;
}

function hideTooltip() { ttEl.classList.add("hidden"); }


/* ── 8. FILTER KATEGORI ─────────────────────────────────── */

let activeCategories = new Set(Object.keys(CAT_COLOR));
let allData = [];

function applyFilter() {
  gMain.selectAll(".place-dot")
    .classed("dimmed", d => !activeCategories.has(d.category));
  document.getElementById("kpi-shown").textContent =
    allData.filter(d => activeCategories.has(d.category)).length;
}

function buildFilterPills() {
  const row = document.getElementById("pill-row");

  Object.entries(CAT_COLOR).forEach(([cat, color]) => {
    const btn = document.createElement("button");
    btn.className = "pill pill-cat active";
    btn.dataset.cat = cat;
    btn.textContent = cat;

    const setActive = on => {
      btn.style.background = btn.style.borderColor = on ? color : "";
      btn.style.color = on ? "#000" : "";
    };
    setActive(true);

    btn.addEventListener("click", () => {
      const isOn = activeCategories.has(cat);
      if (isOn && activeCategories.size === 1) return;
      if (isOn) { activeCategories.delete(cat); btn.classList.remove("active"); setActive(false); }
      else      { activeCategories.add(cat);    btn.classList.add("active");    setActive(true);  }
      const allPill = row.querySelector('[data-cat="all"]');
      allPill.classList.toggle("active", activeCategories.size === Object.keys(CAT_COLOR).length);
      applyFilter();
    });
    row.appendChild(btn);
  });

  row.querySelector('[data-cat="all"]').addEventListener("click", () => {
    activeCategories = new Set(Object.keys(CAT_COLOR));
    row.querySelectorAll(".pill-cat").forEach(p => {
      const c = p.dataset.cat;
      p.classList.add("active");
      p.style.background = p.style.borderColor = CAT_COLOR[c];
      p.style.color = "#000";
    });
    row.querySelector('[data-cat="all"]').classList.add("active");
    applyFilter();
  });
}


/* ── 9. FOKUS KOTA ──────────────────────────────────────── */

function buildCityButtons() {
  document.querySelectorAll(".cbtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cbtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const city = btn.dataset.city;
      if (city === "all") { resetToIndonesia(); return; }
      zoomToPoint(CITY_COORD[city], 9);
    });
  });
}


/* ── 10. LEGEND ─────────────────────────────────────────── */

function buildLegend() {
  const legCats = document.getElementById("leg-cats");
  Object.entries(CAT_COLOR).forEach(([cat, color]) => {
    const item = document.createElement("div");
    item.className = "leg-cat-item";
    item.innerHTML = `
      <div class="leg-dot" style="background:${color};box-shadow:0 0 5px ${color}80"></div>
      <span>${cat}</span>`;
    item.addEventListener("click", () =>
      document.querySelector(`.pill-cat[data-cat="${cat}"]`)?.click());
    legCats.appendChild(item);
  });
}


/* ── 11. LABEL KOTA ─────────────────────────────────────── */

function drawCityLabels() {
  const g = gMain.append("g").attr("class","g-cities");
  Object.entries(CITY_COORD).forEach(([city, lngLat]) => {
    const [cx, cy] = projection(lngLat);
    g.append("circle")
      .attr("class","city-dot").attr("cx",cx).attr("cy",cy).attr("r",2.5);
    g.append("text")
      .attr("class","city-label")
      .attr("x", cx).attr("y", cy - 8)
      .attr("font-size","10px").attr("letter-spacing","1")
      .text(city.toUpperCase());
  });
}


/* ── 12. RENDER PETA INDONESIA ───────────────────────────── */

function drawMap(geojson) {
  gMain.append("g").attr("class","g-map")
    .selectAll("path")
    .data(geojson.features)
    .join("path")
      .attr("class","island-path")
      .attr("d", geoPath);
}


/* ── 13. RENDER TITIK WISATA ─────────────────────────────── */

function drawPlaces(data) {
  gMain.append("g").attr("class","g-places")
    .selectAll("circle")
    .data(data)
    .join("circle")
      .attr("class",          "place-dot")
      .attr("cx",             d => projection([d.lng, d.lat])[0])
      .attr("cy",             d => projection([d.lng, d.lat])[1])
      .attr("r",              d => rScale(d.avgRating))
      .attr("fill",           d => CAT_COLOR[d.category] || "#aaa")
      .attr("fill-opacity",   0.82)
      .attr("stroke",         d => CAT_COLOR[d.category] || "#aaa")
      .attr("stroke-width",   0.8)
      .attr("stroke-opacity", 0.45)
      .on("mouseover", function (event, d) {
        const color = CAT_COLOR[d.category] || "#aaa";
        d3.select(this).raise()
          .transition().duration(120)
          .attr("r",              rScale(d.avgRating) / Math.sqrt(currentK) * 1.8)
          .attr("fill-opacity",   1)
          .attr("stroke-width",   2.5)
          .attr("stroke-opacity", 1)
          .style("filter",        `drop-shadow(0 0 7px ${color})`);
        showTooltip(event, d);
      })
      .on("mousemove", moveTooltip)
      .on("mouseout", function (event, d) {
        d3.select(this)
          .transition().duration(150)
          .attr("r",              rScale(d.avgRating) / Math.sqrt(currentK))
          .attr("fill-opacity",   0.82)
          .attr("stroke-width",   0.8)
          .attr("stroke-opacity", 0.45)
          .style("filter",        "none");
        hideTooltip();
      });
}


/* ── 14. PREPROCESSING CSV ──────────────────────────────── */

function preprocessData(places, ratings) {
  // 1. Dedup rating
  const seen  = new Set();
  const dedup = ratings.filter(r => {
    const k = `${r.User_Id}_${r.Place_Id}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  // 2. Avg rating per Place_Id
  const ratingMap = d3.rollup(
    dedup,
    v => ({ avg: d3.mean(v, d => +d.Place_Ratings), count: v.length }),
    d => d.Place_Id
  );

  // 3. Join + filter outlier koordinat
  return places
    .filter(p => p.Lat && p.Long && p.Category)
    .map(p => {
      const r = ratingMap.get(p.Place_Id) ?? { avg: +p.Rating, count: 0 };
      return {
        id:          +p.Place_Id,
        name:        p.Place_Name,
        category:    p.Category,
        city:        p.City,
        price:       +p.Price || 0,
        lat:         +p.Lat,
        lng:         +p.Long,
        avgRating:   r.avg || +p.Rating,
        ratingCount: r.count,
      };
    })
    .filter(p =>
      !isNaN(p.lat) && !isNaN(p.lng) &&
      // Filter outlier: koordinat harus masuk wilayah Indonesia (Jawa)
      // Pelabuhan Marina (Lat=1.07, Long=103.93) di-filter → koordinat salah
      p.lat  >= -9  && p.lat  <= 6    &&
      p.lng  >= 105 && p.lng  <= 115
    );
}


/* ── 15. INIT ────────────────────────────────────────────── */

async function init() {
  const ovLoad = document.getElementById("ov-load");
  const ovErr  = document.getElementById("ov-err");

  try {
    // Load 3 file lokal secara paralel
    const [geojson, places, ratings] = await Promise.all([
      d3.json(FILE_GEOJSON),
      d3.csv(FILE_PLACES),
      d3.csv(FILE_RATINGS),
    ]);

    allData = preprocessData(places, ratings);
    console.log(`[map] ${allData.length} tempat wisata setelah filter outlier`);

    // Render (urutan: graticule sudah ada → pulau → kota → titik)
    drawMap(geojson);
    drawCityLabels();
    drawPlaces(allData);

    // Bangun UI
    buildFilterPills();
    buildLegend();
    buildCityButtons();

    // PERBAIKAN: Update counter (menghilangkan dead code sebelumnya)
    document.getElementById("kpi-shown").textContent = allData.length;
    document.querySelectorAll(".kpi-val")[1].textContent = allData.length;

    // Sembunyikan loading
    ovLoad.classList.add("hidden");

    // Langsung fokus ke Jawa (semua data di sana)
    setInitialView();

  } catch (err) {
    console.error("[main.js] Error:", err);
    ovLoad.classList.add("hidden");
    ovErr.classList.remove("hidden");
  }
}


/* ── 16. RESIZE ─────────────────────────────────────────── */

let _rt;
window.addEventListener("resize", () => {
  clearTimeout(_rt);
  _rt = setTimeout(() => {
    W = mapArea.clientWidth; H = mapArea.clientHeight;
    svg.attr("width",W).attr("height",H).attr("viewBox",`0 0 ${W} ${H}`);
    svg.select(".ocean-bg").attr("width",W).attr("height",H);
    projection.scale(W * 0.86).translate([W / 2, H / 2]);
    gMain.selectAll("path").attr("d", geoPath);
    gMain.selectAll(".place-dot")
      .attr("cx", d => projection([d.lng, d.lat])[0])
      .attr("cy", d => projection([d.lng, d.lat])[1]);
    gMain.select(".g-cities").remove();
    drawCityLabels();
    setInitialView();
  }, 200);
});

init();