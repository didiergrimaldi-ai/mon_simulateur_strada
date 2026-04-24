// Mathématiques du simulateur : distance, interpolation, temps MET et projection écran.

const EARTH_RADIUS_M = 6_371_000;

export interface GeoPoint {
  lat: number;
  lon: number;
  ele?: number;
}

export interface ScreenBox {
  width: number;
  height: number;
  padding?: number;
}

// Distance orthodromique entre deux points GPS (haversine, mètres).
export function haversine(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Interpole linéairement une valeur scalaire entre a et b (t ∈ [0,1]).
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Convertit un temps MET (secondes) en chaîne "T+ DDD:HH:MM:SS".
export function metToDhms(metSec: number): string {
  const s = Math.max(0, Math.floor(metSec));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `T+ ${pad(days, 3)}:${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

// Convertit un point GPS en coordonnées écran (projection equirectangulaire
// centrée sur le milieu de la zone, mise à l'échelle pour tenir dans la box).
export function gpsToScreen(
  points: GeoPoint[],
  box: ScreenBox
): { x: number; y: number }[] {
  const padding = box.padding ?? 40;
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const midLat = (minLat + maxLat) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180);
  const usableW = box.width - padding * 2;
  const usableH = box.height - padding * 2;
  const rangeX = (maxLon - minLon) * cos || 1;
  const rangeY = (maxLat - minLat) || 1;
  const scale = Math.min(usableW / rangeX, usableH / rangeY);
  const offsetX = (box.width - rangeX * scale) / 2;
  const offsetY = (box.height - rangeY * scale) / 2;
  return points.map((p) => ({
    x: (p.lon - minLon) * cos * scale + offsetX,
    y: box.height - ((p.lat - minLat) * scale + offsetY)
  }));
}

// Interpole une trajectoire avec distance cumulée pour obtenir N points
// répartis uniformément en distance.
export interface TrackPoint extends GeoPoint {
  distance: number;
  ele: number;
}

export function interpolateTrack(points: TrackPoint[], sampleCount: number): TrackPoint[] {
  if (sampleCount < 2) throw new Error('sampleCount doit être >= 2');
  if (points.length < 2) throw new Error('au moins 2 points requis');
  const total = points[points.length - 1].distance;
  const step = total / (sampleCount - 1);
  const out: TrackPoint[] = [];
  let j = 0;
  for (let i = 0; i < sampleCount; i++) {
    const target = i * step;
    while (j < points.length - 2 && points[j + 1].distance < target) j++;
    const a = points[j];
    const b = points[j + 1] ?? a;
    const span = b.distance - a.distance;
    const t = span === 0 ? 0 : (target - a.distance) / span;
    out.push({
      lat: lerp(a.lat, b.lat, t),
      lon: lerp(a.lon, b.lon, t),
      ele: lerp(a.ele, b.ele, t),
      distance: target
    });
  }
  return out;
}
