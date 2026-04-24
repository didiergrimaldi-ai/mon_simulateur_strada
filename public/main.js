import Two from 'https://cdn.jsdelivr.net/npm/two.js@0.8.14/build/two.module.js';

// ---------- Constantes couleur ----------
const COLOR_TRACK_TODO = '#4b5563';      // portion restante (gris foncé)
const COLOR_TRACK_FULL = '#fc5200';      // trace complète (orange Strava)
const COLOR_TRACK_DONE = '#00ff88';      // portion parcourue (vert terminal)

// ---------- Sélecteurs ----------
const stageEl = document.getElementById('stage');
const hudMet = document.getElementById('hudMet');
const hudPhase = document.getElementById('hudPhase');
const hudSegment = document.getElementById('hudSegment');
const hudHr = document.getElementById('hudHr');

const eventsPanel = document.getElementById('eventsPanel');
const eventsToggle = document.getElementById('eventsToggle');
const eventsReopen = document.getElementById('eventsReopen');
const segmentsListEl = document.getElementById('segmentsList');
const eventsListEl = document.getElementById('eventsList');
const tabs = document.querySelectorAll('.tab');

const crewBadge = document.getElementById('crewBadge');
const crewModal = document.getElementById('crewModal');
const crewModalClose = document.getElementById('crewModalClose');
const crewModalList = document.getElementById('crewModalList');

const slider = document.getElementById('timelineSlider');
const timelineMet = document.getElementById('timelineMet');
const timelineMarkers = document.getElementById('timelineMarkers');
const btnPlayPause = document.getElementById('btnPlayPause');
const btnRewind = document.getElementById('btnRewind');
const btnForward = document.getElementById('btnForward');
const speedSelect = document.getElementById('speedSelect');
const camButtons = document.querySelectorAll('.cam-btn');

const eleCanvas = document.getElementById('elevationCanvas');
const eleCursor = document.getElementById('elevationCursor');
const eleMinLbl = document.getElementById('eleMin');
const eleMaxLbl = document.getElementById('eleMax');

const two = new Two({ fullscreen: false, autostart: true, fitted: true }).appendTo(stageEl);

// ---------- État ----------
const state = {
  trajectory: null,
  events: [],
  segments: [],
  crew: [],
  met: 0,
  totalMet: 1,
  totalDistance: 1,
  playing: false,
  lastTs: 0,
  speedMultiplier: 100,
  cameraMode: 'map',
  screenPts: [],
  rider: null,
  pathFull: null,
  pathDone: null,
  pathRemain: null
};

// ---------- Utilitaires ----------
function metToDhms(sec) {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `T+ ${p(d, 3)}:${p(h)}:${p(m)}:${p(r)}`;
}
function frNum(n, decimals = 2) {
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ---------- Projection GPS → écran ----------
function projectAll(samples) {
  const W = stageEl.clientWidth;
  const H = stageEl.clientHeight - 180; // on laisse la place au dock inférieur
  const padding = 70;
  const lats = samples.map((p) => p.lat);
  const lons = samples.map((p) => p.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const midLat = (minLat + maxLat) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180);
  const rangeX = (maxLon - minLon) * cos || 1;
  const rangeY = (maxLat - minLat) || 1;
  const scale = Math.min((W - padding * 2) / rangeX, (H - padding * 2) / rangeY);
  const offsetX = (W - rangeX * scale) / 2;
  const offsetY = (H - rangeY * scale) / 2;
  return samples.map((p) => ({
    sx: (p.lon - minLon) * cos * scale + offsetX,
    sy: H - ((p.lat - minLat) * scale + offsetY) + 90
  }));
}

// ---------- Dessin carte stylisée ----------
function drawMap() {
  const W = stageEl.clientWidth;
  const H = stageEl.clientHeight;
  const step = 60;
  for (let x = 0; x <= W; x += step) {
    const ln = two.makeLine(x, 0, x, H);
    ln.stroke = 'rgba(30, 58, 95, 0.22)';
    ln.linewidth = 1;
  }
  for (let y = 0; y <= H; y += step) {
    const ln = two.makeLine(0, y, W, y);
    ln.stroke = 'rgba(30, 58, 95, 0.22)';
    ln.linewidth = 1;
  }
  // Halo montagnes
  const cx = W / 2, cy = H / 2 - 60;
  for (let r = 100; r < Math.max(W, H); r += 120) {
    const c = two.makeCircle(cx, cy, r);
    c.noFill();
    c.stroke = 'rgba(252, 82, 0, 0.04)';
    c.linewidth = 1;
  }
}

function drawPath(screenPts, color, width, dashed = false) {
  if (screenPts.length < 2) return null;
  const anchors = screenPts.map((p) => new Two.Anchor(p.sx, p.sy));
  const path = new Two.Path(anchors, false, false);
  path.stroke = color;
  path.linewidth = width;
  path.noFill();
  path.cap = 'round';
  path.join = 'round';
  if (dashed) path.dashes = [4, 6];
  two.add(path);
  return path;
}

function drawEventMarkers(screenPts, events, totalDist) {
  const colorByType = {
    depart: '#00ff88', arrivee: '#f87171', ravito: '#fbbf24',
    col: '#60a5fa', photo: '#c084fc', mecanique: '#fb923c'
  };
  for (const ev of events) {
    const idx = Math.min(
      screenPts.length - 1,
      Math.max(0, Math.round((ev.distance / totalDist) * (screenPts.length - 1)))
    );
    const p = screenPts[idx];
    const halo = two.makeCircle(p.sx, p.sy, 10);
    halo.fill = 'rgba(252, 82, 0, 0.14)';
    halo.noStroke();
    const dot = two.makeCircle(p.sx, p.sy, 5);
    dot.fill = colorByType[ev.type] ?? COLOR_TRACK_FULL;
    dot.stroke = '#050a14';
    dot.linewidth = 2;
  }
}

function drawRider(p) {
  const group = two.makeGroup();
  const shadow = two.makeEllipse(p.sx, p.sy + 6, 14, 4);
  shadow.fill = 'rgba(0,0,0,0.5)';
  shadow.noStroke();
  const halo = two.makeCircle(p.sx, p.sy, 16);
  halo.fill = 'rgba(0, 255, 136, 0.25)';
  halo.noStroke();
  const dot = two.makeCircle(p.sx, p.sy, 7);
  dot.fill = COLOR_TRACK_DONE;
  dot.stroke = '#050a14';
  dot.linewidth = 2;
  group.add(shadow, halo, dot);
  return group;
}

// ---------- Profil altimétrique ----------
function renderElevationProfile() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = eleCanvas.clientWidth;
  const cssH = eleCanvas.clientHeight;
  eleCanvas.width = cssW * dpr;
  eleCanvas.height = cssH * dpr;
  const ctx = eleCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const samples = state.trajectory.samples;
  const minE = state.trajectory.minEle;
  const maxE = state.trajectory.maxEle;
  const rangeE = (maxE - minE) || 1;
  const pts = samples.map((s, i) => ({
    x: (i / (samples.length - 1)) * cssW,
    y: cssH - ((s.ele - minE) / rangeE) * (cssH - 10) - 4
  }));

  // Dégradé zone restante
  ctx.fillStyle = 'rgba(75, 85, 99, 0.35)';
  ctx.beginPath();
  ctx.moveTo(0, cssH);
  pts.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(cssW, cssH);
  ctx.closePath();
  ctx.fill();

  // Contour complet (orange Strava)
  ctx.strokeStyle = COLOR_TRACK_FULL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();

  eleMinLbl.textContent = `${Math.round(minE)} m`;
  eleMaxLbl.textContent = `${Math.round(maxE)} m`;
}

function renderElevationDone(progress) {
  const ctx = eleCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = eleCanvas.clientWidth;
  const cssH = eleCanvas.clientHeight;
  const samples = state.trajectory.samples;
  const minE = state.trajectory.minEle;
  const maxE = state.trajectory.maxEle;
  const rangeE = (maxE - minE) || 1;
  const cutIdx = Math.round(progress * (samples.length - 1));
  if (cutIdx < 1) return;

  ctx.save();
  // Remplissage vert pour la portion parcourue
  const grad = ctx.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0, 'rgba(0, 255, 136, 0.35)');
  grad.addColorStop(1, 'rgba(0, 255, 136, 0.02)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, cssH);
  for (let i = 0; i <= cutIdx; i++) {
    const x = (i / (samples.length - 1)) * cssW;
    const y = cssH - ((samples[i].ele - minE) / rangeE) * (cssH - 10) - 4;
    ctx.lineTo(x, y);
  }
  const cutX = (cutIdx / (samples.length - 1)) * cssW;
  ctx.lineTo(cutX, cssH);
  ctx.closePath();
  ctx.fill();

  // Contour vert
  ctx.strokeStyle = COLOR_TRACK_DONE;
  ctx.lineWidth = 2;
  ctx.shadowColor = COLOR_TRACK_DONE;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let i = 0; i <= cutIdx; i++) {
    const x = (i / (samples.length - 1)) * cssW;
    const y = cssH - ((samples[i].ele - minE) / rangeE) * (cssH - 10) - 4;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  eleCursor.style.left = `${(progress * 100)}%`;
}

// ---------- UI listes ----------
function renderSegmentsList() {
  segmentsListEl.innerHTML = '';
  for (const s of state.segments) {
    const li = document.createElement('li');
    li.dataset.id = s.id;
    const km = (s.distanceM / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const pente = (s.pentePct >= 0 ? '+' : '') + s.pentePct.toFixed(1).replace('.', ',');
    li.innerHTML = `
      <span class="seg-title">${s.label}</span>
      <span class="seg-stats"><strong>${km} km</strong> · ${Math.round(s.deniveleM)} m D+ · ${pente}% · ${metToDhms(s.startMet).replace('T+ ', '')}</span>
    `;
    li.addEventListener('click', () => jumpTo(s.startMet));
    segmentsListEl.appendChild(li);
  }
}

function renderEventsList() {
  eventsListEl.innerHTML = '';
  for (const ev of state.events) {
    const li = document.createElement('li');
    li.dataset.id = ev.id;
    const km = (ev.distance / 1000).toFixed(1).replace('.', ',');
    li.innerHTML = `
      <span class="evt-title">${ev.icon} ${ev.label}</span>
      <span class="evt-meta">${metToDhms(ev.met)} · ${km} km</span>
    `;
    li.title = ev.description;
    li.addEventListener('click', () => jumpTo(ev.met));
    eventsListEl.appendChild(li);
  }
}

function renderCrew() {
  crewModalList.innerHTML = '';
  for (const c of state.crew) {
    const m = document.createElement('li');
    const linkedin = c.lienLinkedIn
      ? `<a class="crew-link" href="${c.lienLinkedIn}" target="_blank" rel="noopener">Voir LinkedIn ↗</a>` : '';
    m.innerHTML = `
      <span class="crew-name">${c.nom}</span>
      <span class="crew-role">${c.role}</span>
      <p class="crew-bio">${c.bio}</p>
      ${linkedin}
    `;
    crewModalList.appendChild(m);
  }
}

function renderTimelineMarkers() {
  timelineMarkers.innerHTML = '';
  for (const ev of state.events) {
    const pct = (ev.met / state.totalMet) * 100;
    const m = document.createElement('div');
    m.className = 'marker';
    m.style.left = `${pct}%`;
    m.title = `${ev.icon} ${ev.label} — ${metToDhms(ev.met)}`;
    m.addEventListener('click', () => jumpTo(ev.met));
    timelineMarkers.appendChild(m);
  }
}

function updateHighlights(met, progress) {
  // Segments
  segmentsListEl.querySelectorAll('li').forEach((li, i) => {
    const s = state.segments[i];
    li.classList.remove('active', 'passed');
    if (met >= s.endMet - 1) li.classList.add('passed');
    else if (met >= s.startMet && met < s.endMet) li.classList.add('active');
  });
  // Événements
  eventsListEl.querySelectorAll('li').forEach((li, i) => {
    const ev = state.events[i];
    li.classList.remove('active', 'passed');
    if (met > ev.met + 30) li.classList.add('passed');
    else if (Math.abs(ev.met - met) < 120) li.classList.add('active');
  });
}

function currentSegmentLabel(met) {
  const s = state.segments.find((x) => met >= x.startMet && met < x.endMet);
  return s ? s.label : '—';
}

// ---------- Caméra ----------
function applyCamera() {
  const W = stageEl.clientWidth;
  const H = stageEl.clientHeight;
  two.scene.translation.set(0, 0);
  two.scene.scale = 1;
  if (state.cameraMode === 'follow' && state.rider) {
    const cx = state.rider.translation.x;
    const cy = state.rider.translation.y;
    const zoom = 2;
    two.scene.scale = zoom;
    two.scene.translation.set(W / 2 - cx * zoom, H / 2 - cy * zoom);
  }
}

// ---------- Mise à jour ----------
async function refreshAt(met) {
  const tele = await fetch(`/api/telemetry/current?met=${encodeURIComponent(met)}`).then((r) => r.json());

  // HUD
  hudMet.textContent = metToDhms(tele.met);
  hudPhase.textContent = tele.phase;
  hudHr.textContent = `${tele.heartRate} bpm`;
  hudSegment.textContent = currentSegmentLabel(tele.met);

  // Carte : position cycliste + portion parcourue
  const idx = Math.max(0, Math.min(state.screenPts.length - 1, Math.round(tele.progress * (state.screenPts.length - 1))));
  const p = state.screenPts[idx];
  state.rider.translation.set(p.sx, p.sy);
  if (state.pathDone) two.remove(state.pathDone);
  if (idx >= 1) state.pathDone = drawPath(state.screenPts.slice(0, idx + 1), COLOR_TRACK_DONE, 5);
  else state.pathDone = null;

  // Timeline + profil
  slider.value = String(Math.round(tele.met));
  timelineMet.textContent = metToDhms(tele.met);
  renderElevationProfile();
  renderElevationDone(tele.progress);

  updateHighlights(tele.met, tele.progress);
  if (state.cameraMode === 'follow') applyCamera();
}

function jumpTo(met) {
  state.met = Math.max(0, Math.min(state.totalMet, met));
  refreshAt(state.met).catch(console.error);
}

function tick(ts) {
  if (state.playing) {
    if (state.lastTs) {
      const dt = (ts - state.lastTs) / 1000;
      state.met = Math.min(state.totalMet, state.met + dt * state.speedMultiplier);
      if (state.met >= state.totalMet) {
        state.playing = false;
        btnPlayPause.innerHTML = '▶️ Lecture';
      }
      refreshAt(state.met).catch(() => {});
    }
    state.lastTs = ts;
  } else {
    state.lastTs = 0;
  }
  requestAnimationFrame(tick);
}

function openCrewModal() { crewModal.classList.remove('hidden'); }
function closeCrewModal() { crewModal.classList.add('hidden'); }

// ---------- Init ----------
async function init() {
  const [trajectory, events, segments, crew] = await Promise.all([
    fetch('/api/trajectory').then((r) => r.json()),
    fetch('/api/events').then((r) => r.json()),
    fetch('/api/segments').then((r) => r.json()),
    fetch('/api/crew').then((r) => r.json())
  ]);
  state.trajectory = trajectory;
  state.events = events;
  state.segments = segments;
  state.crew = crew;
  state.totalMet = trajectory.totalDurationSec;
  state.totalDistance = trajectory.totalDistance;
  slider.max = String(Math.round(state.totalMet));

  state.screenPts = projectAll(trajectory.samples);
  drawMap();
  // 1) Trace complète orange (légèrement transparente pour laisser voir le reste)
  state.pathFull = drawPath(state.screenPts, COLOR_TRACK_FULL, 4);
  // 2) Portion restante en gris foncé (par-dessus, redessinée au refresh)
  // 3) Marqueurs événements
  drawEventMarkers(state.screenPts, events, trajectory.totalDistance);
  // 4) Cycliste
  state.rider = drawRider(state.screenPts[0]);

  renderSegmentsList();
  renderEventsList();
  renderCrew();
  renderTimelineMarkers();
  await refreshAt(0);

  btnPlayPause.addEventListener('click', () => {
    if (state.met >= state.totalMet) state.met = 0;
    state.playing = !state.playing;
    btnPlayPause.innerHTML = state.playing ? '⏸️ Pause' : '▶️ Lecture';
  });
  btnRewind.addEventListener('click', () => jumpTo(state.met - 60));
  btnForward.addEventListener('click', () => jumpTo(state.met + 60));
  speedSelect.addEventListener('change', (e) => { state.speedMultiplier = Number(e.target.value); });
  slider.addEventListener('input', (e) => { state.met = Number(e.target.value); refreshAt(state.met).catch(() => {}); });

  eventsToggle.addEventListener('click', () => eventsPanel.classList.add('collapsed'));
  eventsReopen.addEventListener('click', () => eventsPanel.classList.remove('collapsed'));

  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    const which = t.dataset.tab;
    segmentsListEl.hidden = which !== 'segments';
    eventsListEl.hidden = which !== 'events';
  }));

  camButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      camButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.cameraMode = btn.dataset.cam;
      applyCamera();
    });
  });

  crewBadge.addEventListener('click', openCrewModal);
  crewModalClose.addEventListener('click', closeCrewModal);
  crewModal.addEventListener('click', (e) => { if (e.target === crewModal) closeCrewModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCrewModal(); });

  window.addEventListener('resize', () => {
    renderElevationProfile();
    renderElevationDone(state.met / state.totalMet);
  });

  requestAnimationFrame(tick);
}

init().catch((err) => {
  console.error(err);
  hudMet.textContent = 'ERREUR';
  hudPhase.textContent = String(err.message ?? err);
});
