import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { lookupOmdb } from './api/omdb.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.get('/api/omdb', async (req, res) => {
    try {
      const i = typeof req.query.i === 'string' ? req.query.i : undefined;
      const rawTitles = typeof req.query.titles === 'string' ? req.query.titles : undefined;
      const singleTitle = typeof req.query.t === 'string' ? req.query.t : undefined;
      const yStr = typeof req.query.y === 'string' ? req.query.y : undefined;
      const type = typeof req.query.type === 'string' ? req.query.type : undefined;

      let titles: string[] = [];
      if (rawTitles) {
        try {
          const parsed = JSON.parse(rawTitles);
          if (Array.isArray(parsed)) titles = parsed.map(String);
        } catch {
          titles = rawTitles.split('|');
        }
      } else if (singleTitle) {
        titles = [singleTitle];
      }

      const year = yStr && /^\d{4}$/.test(yStr) ? parseInt(yStr, 10) : undefined;
      const result = await lookupOmdb({ imdbId: i, titles, year, type });

      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(result);
    } catch {
      res.status(200).json({ configured: false, data: null });
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`AnimeAlert Buea server running on http://0.0.0.0:${port}`);
  });
}

startServer();
