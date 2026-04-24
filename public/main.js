import Two from 'https://cdn.jsdelivr.net/npm/two.js@0.8.14/build/two.module.js';

// ---------- Sélecteurs ----------
const stageEl = document.getElementById('stage');
const hudMet = document.getElementById('hudMet');
const hudDist = document.getElementById('hudDist');
const hudRemain = document.getElementById('hudRemain');
const hudSpeed = document.getElementById('hudSpeed');
const hudEle = document.getElementById('hudEle');
const hudPhase = document.getElementById('hudPhase');
const hudHr = document.getElementById('hudHr');

const eventsPanel = document.getElementById('eventsPanel');
const eventsToggle = document.getElementById('eventsToggle');
const eventsReopen = document.getElementById('eventsReopen');
const eventsListEl = document.getElementById('eventsList');
const crewListEl = document.getElementById('crewList');

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

const two = new Two({ fullscreen: false, autostart: true, fitted: true }).appendTo(stageEl);

// ---------- État ----------
const state = {
  trajectory: null,
  events: [],
  crew: [],
  met: 0,
  totalMet: 1,
  playing: false,
  lastTs: 0,
  speedMultiplier: 100,
  cameraMode: 'map',
  screenPts: [],
  rider: null,
  pathFull: null,
  pathDone: null,
  gridGroup: null,
  reliefGroup: null,
  mapGroup: null
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

function frNum(n, decimals = 3) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ---------- Projection ----------
function projectAll(samples) {
  const W = stageEl.clientWidth;
  const H = stageEl.clientHeight;
  const padding = 80;
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
  return samples.map((p, i) => ({
    sx: (p.lon - minLon) * cos * scale + offsetX,
    sy: H - ((p.lat - minLat) * scale + offsetY),
    ele: p.ele,
    idx: i
  }));
}

// ---------- Dessin ----------
function drawMap() {
  const W = stageEl.clientWidth;
  const H = stageEl.clientHeight;
  const group = two.makeGroup();

  const bg = two.makeRectangle(W / 2, H / 2, W, H);
  bg.fill = '#081428';
  bg.noStroke();
  group.add(bg);

  const step = 50;
  for (let x = 0; x <= W; x += step) {
    const ln = two.makeLine(x, 0, x, H);
    ln.stroke = 'rgba(30, 58, 95, 0.35)';
    ln.linewidth = 1;
    group.add(ln);
  }
  for (let y = 0; y <= H; y += step) {
    const ln = two.makeLine(0, y, W, y);
    ln.stroke = 'rgba(30, 58, 95, 0.35)';
    ln.linewidth = 1;
    group.add(ln);
  }

  // Éléments symboliques : traits de relief autour du centre
  const cx = W / 2, cy = H / 2;
  for (let r = 80; r < Math.max(W, H); r += 90) {
    const c = two.makeCircle(cx, cy, r);
    c.noFill();
    c.stroke = 'rgba(30, 58, 95, 0.18)';
    c.linewidth = 1;
    group.add(c);
  }
  return group;
}

function drawRelief() {
  // Vue relief : profil altimétrique en bande sous le tracé.
  const W = stageEl.clientWidth;
  const H = stageEl.clientHeight;
  const group = two.makeGroup();
  const traj = state.trajectory;
  if (!traj) return group;
  const minE = traj.minEle, maxE = traj.maxEle;
  const rangeE = (maxE - minE) || 1;
  const bandH = 140;
  const bandY = H - 180;
  const margin = 40;
  const w = W - margin * 2;
  const pts = traj.samples.map((s, i) => ({
    x: margin + (i / (traj.samples.length - 1)) * w,
    y: bandY + bandH - ((s.ele - minE) / rangeE) * bandH
  }));
  const anchors = [
    new Two.Anchor(margin, bandY + bandH),
    ...pts.map((p) => new Two.Anchor(p.x, p.y)),
    new Two.Anchor(margin + w, bandY + bandH)
  ];
  const poly = new Two.Path(anchors, true, false);
  poly.fill = 'rgba(0, 255, 136, 0.15)';
  poly.stroke = '#00ff88';
  poly.linewidth = 2;
  two.add(poly);
  group.add(poly);
  return group;
}

function drawPath(screenPts, color, width) {
  const anchors = screenPts.map((p) => new Two.Anchor(p.sx, p.sy));
  const path = new Two.Path(anchors, false, false);
  path.stroke = color;
  path.linewidth = width;
  path.noFill();
  path.cap = 'round';
  path.join = 'round';
  two.add(path);
  return path;
}

function drawEventMarkers(screenPts, events, totalDist) {
  const group = two.makeGroup();
  const colorByType = {
    depart: '#00ff88',
    arrivee: '#f87171',
    ravito: '#fbbf24',
    col: '#60a5fa',
    photo: '#c084fc',
    mecanique: '#fb923c'
  };
  for (const ev of events) {
    const idx = Math.min(
      screenPts.length - 1,
      Math.max(0, Math.round((ev.distance / totalDist) * (screenPts.length - 1)))
    );
    const p = screenPts[idx];
    const halo = two.makeCircle(p.sx, p.sy, 10);
    halo.fill = 'rgba(0, 255, 136, 0.12)';
    halo.noStroke();
    const dot = two.makeCircle(p.sx, p.sy, 5);
    dot.fill = colorByType[ev.type] ?? '#00ff88';
    dot.stroke = '#0a1428';
    dot.linewidth = 2;
    group.add(halo);
    group.add(dot);
  }
  return group;
}

function drawRider(p) {
  // Position courante du cycliste sur la carte : simple marqueur vert animé.
  // La photo de l'équipe est affichée séparément en HTML, fixe en haut à gauche.
  const group = two.makeGroup();
  const shadow = two.makeEllipse(p.sx, p.sy + 6, 14, 4);
  shadow.fill = 'rgba(0,0,0,0.5)';
  shadow.noStroke();
  const halo = two.makeCircle(p.sx, p.sy, 14);
  halo.fill = 'rgba(0, 255, 136, 0.22)';
  halo.noStroke();
  const dot = two.makeCircle(p.sx, p.sy, 7);
  dot.fill = '#00ff88';
  dot.stroke = '#0a1428';
  dot.linewidth = 2;
  group.add(shadow, halo, dot);
  group.halo = halo;
  return group;
}

// ---------- UI listes ----------
function renderEventsList() {
  eventsListEl.innerHTML = '';
  for (const ev of state.events) {
    const li = document.createElement('li');
    li.dataset.id = ev.id;
    li.innerHTML = `
      <span class="evt-title">${ev.icon} ${ev.label}</span>
      <span class="evt-meta">${metToDhms(ev.met)} · ${(ev.distance / 1000).toFixed(1).replace('.', ',')} km</span>
      <div class="evt-desc">${ev.description}</div>
    `;
    li.addEventListener('click', () => jumpTo(ev.met));
    eventsListEl.appendChild(li);
  }
}

function renderCrew() {
  crewListEl.innerHTML = '';
  crewModalList.innerHTML = '';
  for (const c of state.crew) {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="crew-name">${c.nom}</span>
      <span class="crew-role">${c.role}</span>
    `;
    li.title = 'Clique sur le 🚴 pour voir la bio complète';
    li.addEventListener('click', openCrewModal);
    crewListEl.appendChild(li);

    const m = document.createElement('li');
    const linkedin = c.lienLinkedIn
      ? `<a class="crew-link" href="${c.lienLinkedIn}" target="_blank" rel="noopener">Voir LinkedIn ↗</a>`
      : '';
    m.innerHTML = `
      <span class="crew-name">${c.nom}</span>
      <span class="crew-role">${c.role}</span>
      <p class="crew-bio">${c.bio}</p>
      ${linkedin}
    `;
    crewModalList.appendChild(m);
  }
}

function openCrewModal() {
  crewModal.classList.remove('hidden');
}
function closeCrewModal() {
  crewModal.classList.add('hidden');
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

function updateEventsHighlight(met) {
  const items = eventsListEl.querySelectorAll('li');
  items.forEach((li, i) => {
    const ev = state.events[i];
    li.classList.remove('active', 'passed');
    if (met > ev.met + 30) li.classList.add('passed');
    else if (Math.abs(ev.met - met) < 120) li.classList.add('active');
  });
}

// ---------- Caméra ----------
function applyCamera() {
  const W = stageEl.clientWidth;
  const H = stageEl.clientHeight;
  if (state.reliefGroup) { two.remove(state.reliefGroup); state.reliefGroup = null; }
  two.scene.translation.set(0, 0);
  two.scene.scale = 1;

  if (state.cameraMode === 'follow' && state.rider) {
    const cx = state.rider.translation.x;
    const cy = state.rider.translation.y;
    const zoom = 1.8;
    two.scene.scale = zoom;
    two.scene.translation.set(W / 2 - cx * zoom, H / 2 - cy * zoom);
  } else if (state.cameraMode === 'relief') {
    state.reliefGroup = drawRelief();
  }
}

// ---------- Mise à jour ----------
async function refreshAt(met) {
  const [tele, upcoming] = await Promise.all([
    fetch(`/api/telemetry/current?met=${encodeURIComponent(met)}`).then((r) => r.json()),
    fetch(`/api/events/upcoming?met=${encodeURIComponent(met)}`).then((r) => r.json())
  ]);

  hudMet.textContent = metToDhms(tele.met);
  hudDist.textContent = `${frNum(tele.distance / 1000, 3)} km`;
  hudRemain.textContent = `${frNum(tele.distanceRemaining / 1000, 3)} km`;
  hudSpeed.textContent = `${frNum(tele.speedKmh, 3)} km/h`;
  hudEle.textContent = `${Math.round(tele.ele)} m`;
  hudPhase.textContent = tele.phase;
  hudHr.textContent = `${tele.heartRate} bpm`;

  const idx = Math.max(0, Math.min(state.screenPts.length - 1, Math.round(tele.progress * (state.screenPts.length - 1))));
  const p = state.screenPts[idx];
  state.rider.translation.set(p.sx, p.sy);

  // Portion parcourue
  if (state.pathDone) two.remove(state.pathDone);
  if (idx >= 1) {
    state.pathDone = drawPath(state.screenPts.slice(0, idx + 1), '#00ff88', 4);
  } else {
    state.pathDone = null;
  }

  slider.value = String(Math.round(tele.met));
  timelineMet.textContent = metToDhms(tele.met);
  updateEventsHighlight(tele.met);
  if (state.cameraMode === 'follow') applyCamera();
  return { tele, upcoming };
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
        btnPlayPause.textContent = '▶️';
      }
      refreshAt(state.met).catch(() => {});
    }
    state.lastTs = ts;
  } else {
    state.lastTs = 0;
  }
  requestAnimationFrame(tick);
}

// ---------- Init ----------
async function init() {
  const [trajectory, events, crew] = await Promise.all([
    fetch('/api/trajectory').then((r) => r.json()),
    fetch('/api/events').then((r) => r.json()),
    fetch('/api/crew').then((r) => r.json())
  ]);
  state.trajectory = trajectory;
  state.events = events;
  state.crew = crew;
  state.totalMet = trajectory.totalDurationSec;
  slider.max = String(Math.round(state.totalMet));

  state.screenPts = projectAll(trajectory.samples);
  state.mapGroup = drawMap();
  state.pathFull = drawPath(state.screenPts, 'rgba(226, 232, 240, 0.25)', 3);
  drawEventMarkers(state.screenPts, events, trajectory.totalDistance);
  state.rider = drawRider(state.screenPts[0]);

  renderEventsList();
  renderCrew();
  renderTimelineMarkers();
  await refreshAt(0);

  btnPlayPause.addEventListener('click', () => {
    if (state.met >= state.totalMet) state.met = 0;
    state.playing = !state.playing;
    btnPlayPause.textContent = state.playing ? '⏸️' : '▶️';
  });
  btnRewind.addEventListener('click', () => jumpTo(state.met - 60));
  btnForward.addEventListener('click', () => jumpTo(state.met + 60));
  speedSelect.addEventListener('change', (e) => {
    state.speedMultiplier = Number(e.target.value);
  });
  slider.addEventListener('input', (e) => {
    state.met = Number(e.target.value);
    refreshAt(state.met).catch(() => {});
  });

  eventsToggle.addEventListener('click', () => eventsPanel.classList.add('collapsed'));
  eventsReopen.addEventListener('click', () => eventsPanel.classList.remove('collapsed'));

  camButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      camButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.cameraMode = btn.dataset.cam;
      applyCamera();
    });
  });

  // Clic sur le badge photo (fixe haut-gauche) → modale équipage.
  const crewBadge = document.getElementById('crewBadge');
  if (crewBadge) crewBadge.addEventListener('click', openCrewModal);

  crewModalClose.addEventListener('click', closeCrewModal);
  crewModal.addEventListener('click', (e) => {
    if (e.target === crewModal) closeCrewModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCrewModal();
  });

  window.addEventListener('resize', () => {
    two.renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
    two.width = stageEl.clientWidth;
    two.height = stageEl.clientHeight;
    state.screenPts = projectAll(trajectory.samples);
    // Redessin simple : recharger la page est plus sûr pour ce rendu statique.
  });

  requestAnimationFrame(tick);
}

init().catch((err) => {
  console.error(err);
  hudMet.textContent = 'ERREUR';
  hudPhase.textContent = String(err.message ?? err);
});
