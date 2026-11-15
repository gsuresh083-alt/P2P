import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const ENFA_FILE = path.join(DATA_DIR, 'enfa_state.json');

function loadEnfaState(): unknown | null {
  try {
    if (!fs.existsSync(ENFA_FILE)) return null;
    const raw = fs.readFileSync(ENFA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveEnfaState(state: unknown): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ENFA_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/enfa/state', (_req, res) => {
    const state = loadEnfaState();
    if (!state) {
      res.status(204).end();
      return;
    }
    res.json(state);
  });

  app.put('/api/enfa/state', (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || !('nfas' in body)) {
      res.status(400).json({ error: 'Invalid e-NFA state payload.' });
      return;
    }
    saveEnfaState(body);
    res.json({ ok: true, savedAt: new Date().toISOString() });
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`e-NFA server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
