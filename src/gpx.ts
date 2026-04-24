// Chargement et parsing d'un fichier GPX.

import { readFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { haversine, TrackPoint } from './orbital-math.js';

export interface Track {
  name: string;
  points: TrackPoint[];
  totalDistance: number;
  minEle: number;
  maxEle: number;
}

interface RawTrkpt {
  lat: string | number;
  lon: string | number;
  ele?: string | number;
}

export function parseGpx(xml: string): Track {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const doc = parser.parse(xml);
  const gpx = doc.gpx;
  if (!gpx) throw new Error('GPX invalide : balise <gpx> manquante');

  const trksegs: Array<{ trkpt?: RawTrkpt | RawTrkpt[] }> = [].concat(gpx.trk?.trkseg ?? []);
  const raw: RawTrkpt[] = trksegs.flatMap((seg) =>
    ([] as RawTrkpt[]).concat((seg.trkpt ?? []) as RawTrkpt | RawTrkpt[])
  );
  if (raw.length < 2) throw new Error('GPX invalide : au moins 2 points requis');

  const base: TrackPoint[] = raw.map((p) => ({
    lat: Number(p.lat),
    lon: Number(p.lon),
    ele: p.ele != null ? Number(p.ele) : 0,
    distance: 0
  }));

  let cumul = 0;
  for (let i = 1; i < base.length; i++) {
    cumul += haversine(base[i - 1], base[i]);
    base[i].distance = cumul;
  }

  return {
    name: gpx.trk?.name ?? 'Trajet',
    points: base,
    totalDistance: cumul,
    minEle: Math.min(...base.map((p) => p.ele)),
    maxEle: Math.max(...base.map((p) => p.ele))
  };
}

export async function loadGpxFile(path: string): Promise<Track> {
  const xml = await readFile(path, 'utf8');
  return parseGpx(xml);
}
