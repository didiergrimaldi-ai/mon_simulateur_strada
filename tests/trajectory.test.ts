import { describe, test, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadGpxFile, Track } from '../src/gpx.js';
import { interpolateTrack } from '../src/orbital-math.js';
import { buildTelemetry, TARGET_TOTAL_SEC } from '../src/telemetry.js';
import { buildEvents } from '../src/events.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GPX_PATH = join(__dirname, '..', 'data', 'trajet.gpx');

let track: Track;

beforeAll(async () => {
  track = await loadGpxFile(GPX_PATH);
});

describe('trajectoire GPX', () => {
  test('le GPX est chargé avec des points', () => {
    expect(track.points.length).toBeGreaterThan(5);
    expect(track.name).toBeTruthy();
  });

  test('la trajectoire interpolée a au moins 500 points', () => {
    const samples = interpolateTrack(track.points, 500);
    expect(samples.length).toBeGreaterThanOrEqual(500);
  });

  test('la distance totale est raisonnable (5–80 km)', () => {
    expect(track.totalDistance).toBeGreaterThan(5_000);
    expect(track.totalDistance).toBeLessThan(80_000);
  });

  test('les points clés (départ et arrivée) existent dans les événements', () => {
    const samples = interpolateTrack(track.points, 500);
    const telemetry = buildTelemetry(samples);
    const events = buildEvents(track, telemetry);
    const labels = events.map((e) => e.label);
    expect(events.some((e) => e.type === 'depart')).toBe(true);
    expect(events.some((e) => e.type === 'arrivee')).toBe(true);
    expect(labels.join(' ')).toMatch(/Tibidabo|Vallvidrera|Erola/);
  });

  test('distanceDepuisDepart + distanceRestante ≈ distanceTotale', () => {
    const samples = interpolateTrack(track.points, 500);
    const telemetry = buildTelemetry(samples);
    for (const s of telemetry) {
      expect(s.distance + s.distanceRemaining).toBeCloseTo(track.totalDistance, 3);
    }
  });

  test('la durée totale MET est proche de T+333 min', () => {
    const samples = interpolateTrack(track.points, 500);
    const telemetry = buildTelemetry(samples);
    const totalMet = telemetry[telemetry.length - 1].met;
    expect(totalMet).toBeCloseTo(TARGET_TOTAL_SEC, -1);
  });
});
