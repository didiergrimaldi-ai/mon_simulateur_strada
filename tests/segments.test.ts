import { describe, test, expect } from 'vitest';
import { loadGpxFile } from '../src/gpx.js';
import { interpolateTrack } from '../src/orbital-math.js';
import { buildTelemetry } from '../src/telemetry.js';
import { buildSegments, cumulativeGain } from '../src/segments.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GPX_PATH = join(__dirname, '..', 'data', 'trajet.gpx');

describe('segments', () => {
  test('7 segments en français couvrant tout le parcours', async () => {
    const track = await loadGpxFile(GPX_PATH);
    const telemetry = buildTelemetry(interpolateTrack(track.points, 500));
    const segs = buildSegments(telemetry);
    expect(segs).toHaveLength(7);
    const labels = segs.map((s) => s.label);
    expect(labels).toEqual([
      'Départ',
      'Montée Collserola',
      'Coll de l’Erola',
      'Tibidabo',
      'Vallvidrera',
      'Descente',
      'Arrivée'
    ]);
    expect(segs[0].startProgress).toBe(0);
    expect(segs.at(-1)!.endProgress).toBe(1);
  });

  test('somme des distances des segments ≈ distance totale', async () => {
    const track = await loadGpxFile(GPX_PATH);
    const telemetry = buildTelemetry(interpolateTrack(track.points, 500));
    const segs = buildSegments(telemetry);
    const sum = segs.reduce((acc, s) => acc + s.distanceM, 0);
    expect(sum).toBeCloseTo(track.totalDistance, 0);
  });

  test('D+ cumulé croît avec le MET', async () => {
    const track = await loadGpxFile(GPX_PATH);
    const telemetry = buildTelemetry(interpolateTrack(track.points, 500));
    for (let i = 1; i < telemetry.length; i++) {
      expect(telemetry[i].elevationGain).toBeGreaterThanOrEqual(telemetry[i - 1].elevationGain);
    }
    expect(cumulativeGain(telemetry, telemetry.length - 1)).toBeGreaterThan(100);
  });

  test('vitesse moyenne positive sur un segment non nul', async () => {
    const track = await loadGpxFile(GPX_PATH);
    const telemetry = buildTelemetry(interpolateTrack(track.points, 500));
    const segs = buildSegments(telemetry);
    const nonEmpty = segs.filter((s) => s.distanceM > 100);
    for (const s of nonEmpty) {
      expect(s.vitesseMoyKmh).toBeGreaterThan(0);
    }
  });
});
