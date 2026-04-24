// Entrée serverless Vercel : enveloppe l'app Express.
// L'instance Express est construite une seule fois par lambda (cache chaud).

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/server.js';

let appPromise: Promise<(req: IncomingMessage, res: ServerResponse) => void> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!appPromise) appPromise = createApp() as any;
  const app = await appPromise!;
  return (app as any)(req, res);
}
