// Construction de la série temporelle (MET) à partir d'une trajectoire interpolée.
// Les vitesses brutes sont calculées selon la pente, puis le temps total est
// calibré pour se rapprocher de la cible TARGET_TOTAL_SEC (~333 min).

import { TrackPoint } from './orbital-math.js';

export const TARGET_TOTAL_SEC = 333 * 60;

const FLAT_KMH = 22;
const CLIMB_KMH = 8;
const DESCENT_KMH = 40;

export interface TelemetrySample {
  met: number;
  distance: number;
  distanceRemaining: number;
  ele: number;
  lat: number;
  lon: number;
  speedKmh: number;
  avgSpeedKmh: number;
  elevationGain: number;
  gradePct: number;
  heartRate: number;
  phase: string;
  progress: number;
}

export function speedForGrade(gradePct: number): number {
  if (gradePct > 1.5) {
    const t = Math.min(1, (gradePct - 1.5) / 10);
    return FLAT_KMH + (CLIMB_KMH - FLAT_KMH) * t;
  }
  if (gradePct < -1.5) {
    const t = Math.min(1, (-gradePct - 1.5) / 10);
    return FLAT_KMH + (DESCENT_KMH - FLAT_KMH) * t;
  }
  return FLAT_KMH;
}

function phaseFor(progress: number, gradePct: number): string {
  if (progress <= 0.01) return 'MISE EN SELLE';
  if (progress >= 0.99) return 'ARRIVÉE';
  if (gradePct > 4) return 'ASCENSION';
  if (gradePct < -4) return 'DESCENTE';
  return 'CROISIÈRE';
}

export function buildTelemetry(track: TrackPoint[]): TelemetrySample[] {
  const total = track[track.length - 1].distance || 1;
  const raw: TelemetrySample[] = new Array(track.length);

  raw[0] = {
    met: 0,
    distance: 0,
    distanceRemaining: total,
    ele: track[0].ele,
    lat: track[0].lat,
    lon: track[0].lon,
    speedKmh: 0,
    avgSpeedKmh: 0,
    elevationGain: 0,
    gradePct: 0,
    heartRate: 92,
    phase: 'MISE EN SELLE',
    progress: 0
  };

  let tNat = 0;
  let gain = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    const dx = b.distance - a.distance;
    const dz = b.ele - a.ele;
    if (dz > 0) gain += dz;
    const grade = dx > 0 ? (dz / dx) * 100 : 0;
    const kmh = speedForGrade(grade);
    const dt = dx / (kmh / 3.6);
    tNat += dt;
    raw[i] = {
      met: tNat,
      distance: b.distance,
      distanceRemaining: total - b.distance,
      ele: b.ele,
      lat: b.lat,
      lon: b.lon,
      speedKmh: kmh,
      avgSpeedKmh: 0,
      elevationGain: gain,
      gradePct: grade,
      heartRate: Math.max(85, Math.min(185, Math.round(110 + Math.max(0, grade) * 6 - Math.max(0, -grade) * 2))),
      phase: phaseFor(b.distance / total, grade),
      progress: b.distance / total
    };
  }

  // Calibration : étire la durée pour viser TARGET_TOTAL_SEC.
  const scale = TARGET_TOTAL_SEC / (tNat || 1);
  for (let i = 0; i < raw.length; i++) {
    raw[i].met *= scale;
    raw[i].speedKmh = raw[i].speedKmh / scale;
    raw[i].avgSpeedKmh = raw[i].met > 0 ? (raw[i].distance / 1000) / (raw[i].met / 3600) : 0;
  }
  return raw;
}

export function telemetryAt(series: TelemetrySample[], met: number): TelemetrySample {
  const total = series[series.length - 1].met;
  const clamped = Math.max(0, Math.min(total, met));
  let lo = 0;
  let hi = series.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (series[mid].met <= clamped) lo = mid;
    else hi = mid;
  }
  const a = series[lo];
  const b = series[hi];
  const span = b.met - a.met;
  const u = span === 0 ? 0 : (clamped - a.met) / span;
  const mix = (ka: number, kb: number) => ka + (kb - ka) * u;
  return {
    met: clamped,
    distance: mix(a.distance, b.distance),
    distanceRemaining: mix(a.distanceRemaining, b.distanceRemaining),
    ele: mix(a.ele, b.ele),
    lat: mix(a.lat, b.lat),
    lon: mix(a.lon, b.lon),
    speedKmh: mix(a.speedKmh, b.speedKmh),
    avgSpeedKmh: mix(a.avgSpeedKmh, b.avgSpeedKmh),
    elevationGain: mix(a.elevationGain, b.elevationGain),
    gradePct: mix(a.gradePct, b.gradePct),
    heartRate: Math.round(mix(a.heartRate, b.heartRate)),
    phase: u < 0.5 ? a.phase : b.phase,
    progress: mix(a.progress, b.progress)
  };
}
