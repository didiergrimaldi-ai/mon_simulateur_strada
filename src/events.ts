// Événements marquants du voyage. Le champ `progress` (0..1) est résolu en
// distance + MET à partir de la télémétrie calculée.

import { TelemetrySample } from './telemetry.js';
import { Track } from './gpx.js';

export interface MissionEvent {
  id: string;
  type: 'depart' | 'ravito' | 'col' | 'photo' | 'mecanique' | 'arrivee';
  icon: string;
  label: string;
  description: string;
  progress: number;
  distance: number;
  met: number;
  lat: number;
  lon: number;
  ele: number;
}

const DEFAULT_EVENTS: Omit<MissionEvent, 'distance' | 'met' | 'lat' | 'lon' | 'ele'>[] = [
  { id: 'depart', type: 'depart', icon: '🚴', label: 'Départ Sant Andreu', description: 'Mise en selle, équipe au complet.', progress: 0.0 },
  { id: 'ravito-1', type: 'ravito', icon: '🥤', label: 'Ravitaillement Horta', description: 'Café, eau, barres énergétiques.', progress: 0.18 },
  { id: 'col-carretera', type: 'col', icon: '⛰️', label: 'Carretera de les Aigües', description: 'Début de la montée vers Collserola.', progress: 0.32 },
  { id: 'photo-bcn', type: 'photo', icon: '📷', label: 'Belvédère sur Barcelone', description: 'Vue panoramique sur la ville et la mer.', progress: 0.46 },
  { id: 'col-tibidabo', type: 'col', icon: '🏔️', label: 'Sommet du Tibidabo', description: 'Point culminant du parcours (512 m).', progress: 0.58 },
  { id: 'mecanique', type: 'mecanique', icon: '🔧', label: 'Contrôle mécanique', description: 'Pression pneus avant la descente.', progress: 0.64 },
  { id: 'col-erola', type: 'col', icon: '⛰️', label: 'Coll de l’Erola', description: 'Traversée de la sierra.', progress: 0.74 },
  { id: 'photo-vall', type: 'photo', icon: '📷', label: 'Santa Maria de Vallvidrera', description: 'Église romane, halte patrimoine.', progress: 0.82 },
  { id: 'ravito-2', type: 'ravito', icon: '🥨', label: 'Ravitaillement final', description: 'Dernière pause avant la descente.', progress: 0.9 },
  { id: 'arrivee', type: 'arrivee', icon: '🏁', label: 'Arrivée Sant Andreu', description: 'Retour à la base, boucle bouclée.', progress: 1.0 }
];

export function buildEvents(track: Track, telemetry: TelemetrySample[]): MissionEvent[] {
  return DEFAULT_EVENTS.map((e) => {
    const targetDist = e.progress * track.totalDistance;
    let idx = 0;
    for (let i = 0; i < telemetry.length; i++) {
      if (telemetry[i].distance <= targetDist) idx = i;
    }
    const s = telemetry[idx];
    return {
      ...e,
      distance: s.distance,
      met: s.met,
      lat: s.lat,
      lon: s.lon,
      ele: s.ele
    };
  });
}
