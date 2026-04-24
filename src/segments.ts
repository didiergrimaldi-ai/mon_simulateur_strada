// Segments sportifs du parcours — délimités par des bornes progress [0..1]
// sur la trace, avec stats calculées : distance, D+, pente moyenne, vitesse
// moyenne attendue.

import { TelemetrySample } from './telemetry.js';

export interface Segment {
  id: string;
  label: string;
  startProgress: number;
  endProgress: number;
  startMet: number;
  endMet: number;
  distanceM: number;
  deniveleM: number;
  pentePct: number;
  vitesseMoyKmh: number;
}

const DEFAULT_SEGMENTS: Array<Pick<Segment, 'id' | 'label' | 'startProgress' | 'endProgress'>> = [
  { id: 'depart', label: 'Départ', startProgress: 0.0, endProgress: 0.08 },
  { id: 'montee-collserola', label: 'Montée Collserola', startProgress: 0.08, endProgress: 0.4 },
  { id: 'coll-erola', label: 'Coll de l’Erola', startProgress: 0.4, endProgress: 0.5 },
  { id: 'tibidabo', label: 'Tibidabo', startProgress: 0.5, endProgress: 0.62 },
  { id: 'vallvidrera', label: 'Vallvidrera', startProgress: 0.62, endProgress: 0.78 },
  { id: 'descente', label: 'Descente', startProgress: 0.78, endProgress: 0.95 },
  { id: 'arrivee', label: 'Arrivée', startProgress: 0.95, endProgress: 1.0 }
];

function findIndex(series: TelemetrySample[], progress: number): number {
  const target = progress * (series.length - 1);
  return Math.max(0, Math.min(series.length - 1, Math.round(target)));
}

export function buildSegments(telemetry: TelemetrySample[]): Segment[] {
  return DEFAULT_SEGMENTS.map((s) => {
    const iStart = findIndex(telemetry, s.startProgress);
    const iEnd = findIndex(telemetry, s.endProgress);
    const a = telemetry[iStart];
    const b = telemetry[iEnd];
    const distanceM = Math.max(0, b.distance - a.distance);
    const durSec = Math.max(1, b.met - a.met);

    let denivele = 0;
    for (let i = iStart + 1; i <= iEnd; i++) {
      const dz = telemetry[i].ele - telemetry[i - 1].ele;
      if (dz > 0) denivele += dz;
    }

    const pente = distanceM > 0 ? ((b.ele - a.ele) / distanceM) * 100 : 0;
    const vitesse = distanceM > 0 ? (distanceM / 1000) / (durSec / 3600) : 0;

    return {
      id: s.id,
      label: s.label,
      startProgress: s.startProgress,
      endProgress: s.endProgress,
      startMet: a.met,
      endMet: b.met,
      distanceM,
      deniveleM: denivele,
      pentePct: pente,
      vitesseMoyKmh: vitesse
    };
  });
}

// Cumul du dénivelé positif depuis le départ jusqu'à l'index donné.
export function cumulativeGain(telemetry: TelemetrySample[], upToIndex: number): number {
  let g = 0;
  for (let i = 1; i <= upToIndex && i < telemetry.length; i++) {
    const dz = telemetry[i].ele - telemetry[i - 1].ele;
    if (dz > 0) g += dz;
  }
  return g;
}
