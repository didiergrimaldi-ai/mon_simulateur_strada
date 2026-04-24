// Serveur Express + endpoints REST du simulateur.

import express, { Request, Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadGpxFile } from './gpx.js';
import { interpolateTrack } from './orbital-math.js';
import { buildTelemetry, telemetryAt } from './telemetry.js';
import { buildEvents } from './events.js';
import { CREW } from './crew.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// En local : racine = parent de dist/ ou src/. Sur Vercel : process.cwd() = racine projet.
const ROOT = process.env.VERCEL ? process.cwd() : join(__dirname, '..');
const GPX_PATH = process.env.GPX_PATH || join(ROOT, 'data', 'trajet.gpx');
const PORT = Number(process.env.PORT) || 3100;

export async function createApp() {
  const track = await loadGpxFile(GPX_PATH);
  const samples = interpolateTrack(track.points, 500);
  const telemetry = buildTelemetry(samples);
  const events = buildEvents(track, telemetry);
  const totalMet = telemetry[telemetry.length - 1].met;

  const app = express();
  app.use(express.json());
  app.use(express.static(join(ROOT, 'public')));

  app.get('/api/trajectory', (_req: Request, res: Response) => {
    res.json({
      name: track.name,
      totalDistance: track.totalDistance,
      totalDurationSec: totalMet,
      minEle: track.minEle,
      maxEle: track.maxEle,
      samples: telemetry.map((t) => ({
        lat: t.lat,
        lon: t.lon,
        ele: t.ele,
        distance: t.distance,
        met: t.met
      }))
    });
  });

  app.get('/api/events', (_req: Request, res: Response) => res.json(events));

  app.get('/api/events/upcoming', (req: Request, res: Response) => {
    const met = Number(req.query.met ?? 0);
    const upcoming = events.filter((e) => e.met >= met);
    res.json(upcoming);
  });

  app.get('/api/telemetry/current', (req: Request, res: Response) => {
    const met = Number(req.query.met ?? 0);
    res.json(telemetryAt(telemetry, met));
  });

  app.get('/api/telemetry/:met', (req: Request, res: Response) => {
    const met = Number(req.params.met);
    if (!Number.isFinite(met)) {
      res.status(400).json({ error: 'met invalide' });
      return;
    }
    res.json(telemetryAt(telemetry, met));
  });

  app.get('/api/crew', (_req: Request, res: Response) => res.json(CREW));

  app.get('/api/health', (_req: Request, res: Response) => res.json({ ok: true }));

  return app;
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  createApp()
    .then((app) => {
      app.listen(PORT, () => {
        console.log(`Simulateur vélo prêt : http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Démarrage impossible :', err);
      process.exit(1);
    });
}
