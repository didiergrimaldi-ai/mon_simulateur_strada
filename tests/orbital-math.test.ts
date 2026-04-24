import { describe, test, expect } from 'vitest';
import {
  haversine,
  interpolateTrack,
  metToDhms,
  gpsToScreen,
  lerp,
  TrackPoint
} from '../src/orbital-math.js';

describe('haversine', () => {
  test('distance nulle entre deux points identiques', () => {
    expect(haversine({ lat: 41, lon: 2 }, { lat: 41, lon: 2 })).toBe(0);
  });
  test('distance Barcelone → Gérone ≈ 90 km', () => {
    const d = haversine({ lat: 41.385, lon: 2.17 }, { lat: 41.983, lon: 2.824 });
    expect(d).toBeGreaterThan(80_000);
    expect(d).toBeLessThan(100_000);
  });
  test('symétrie', () => {
    const a = { lat: 10, lon: 20 };
    const b = { lat: 12, lon: 25 };
    expect(haversine(a, b)).toBeCloseTo(haversine(b, a), 6);
  });
});

describe('interpolateTrack', () => {
  const base: TrackPoint[] = [
    { lat: 0, lon: 0, ele: 0, distance: 0 },
    { lat: 0, lon: 1, ele: 100, distance: 1000 },
    { lat: 0, lon: 2, ele: 50, distance: 2000 }
  ];
  test('produit exactement N points', () => {
    expect(interpolateTrack(base, 500)).toHaveLength(500);
  });
  test('distances réparties uniformément', () => {
    const s = interpolateTrack(base, 500);
    expect(s[0].distance).toBe(0);
    expect(s.at(-1)!.distance).toBeCloseTo(2000, 6);
    const step = s[1].distance - s[0].distance;
    for (let i = 2; i < s.length; i++) {
      expect(s[i].distance - s[i - 1].distance).toBeCloseTo(step, 6);
    }
  });
  test('altitude interpolée correctement', () => {
    const s = interpolateTrack(base, 3);
    expect(s[1].ele).toBeCloseTo(100, 3);
  });
  test('rejette sampleCount < 2', () => {
    expect(() => interpolateTrack(base, 1)).toThrow();
  });
});

describe('metToDhms', () => {
  test('T+0', () => {
    expect(metToDhms(0)).toBe('T+ 000:00:00:00');
  });
  test('333 minutes → 5h33', () => {
    expect(metToDhms(333 * 60)).toBe('T+ 000:05:33:00');
  });
  test('2 jours + 3h + 4min + 5s', () => {
    expect(metToDhms(2 * 86400 + 3 * 3600 + 4 * 60 + 5)).toBe('T+ 002:03:04:05');
  });
  test('clamp pour valeur négative', () => {
    expect(metToDhms(-100)).toBe('T+ 000:00:00:00');
  });
});

describe('gpsToScreen', () => {
  test('retourne autant de points', () => {
    const pts = [
      { lat: 41.43, lon: 2.18 },
      { lat: 41.42, lon: 2.12 },
      { lat: 41.44, lon: 2.10 }
    ];
    const s = gpsToScreen(pts, { width: 800, height: 600 });
    expect(s).toHaveLength(3);
  });
  test('valeurs x et y restent dans la box', () => {
    const pts = [
      { lat: 41.43, lon: 2.18 },
      { lat: 41.42, lon: 2.12 },
      { lat: 41.44, lon: 2.10 }
    ];
    const s = gpsToScreen(pts, { width: 800, height: 600 });
    for (const p of s) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(800);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(600);
    }
  });
});

describe('lerp', () => {
  test('extrémités et milieu', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});
