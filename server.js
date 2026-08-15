require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json({ limit: '15mb' }));

// Conexión a la base de datos de Render (usa SSL en producción)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

const SYNC_PASSWORD = process.env.SYNC_PASSWORD;
const BUSINESS_KEY = 'creamyteo';
const MAX_HISTORY = 50; // cuántas copias de respaldo guardamos como red de seguridad

if (!SYNC_PASSWORD) {
  console.warn('⚠️  No configuraste SYNC_PASSWORD. Configúralo en las variables de entorno de Render antes de usar la app en serio.');
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      business_key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state_history (
      id SERIAL PRIMARY KEY,
      business_key TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_history_business_created
    ON app_state_history (business_key, created_at DESC);
  `);
}

function checkAuth(req, res, next) {
  const key = req.headers['x-sync-key'];
  if (!SYNC_PASSWORD || !key || key !== SYNC_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// Verifica la clave sin devolver datos (usado por el modal de configuración en el navegador)
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (SYNC_PASSWORD && password === SYNC_PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

// Devuelve el último estado guardado de la app (productos, ventas, inventario, todo)
app.get('/api/state', checkAuth, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT data, updated_at FROM app_state WHERE business_key = $1',
      [BUSINESS_KEY]
    );
    if (r.rows.length === 0) {
      return res.json({ data: null, updated_at: null });
    }
    res.json({ data: r.rows[0].data, updated_at: r.rows[0].updated_at });
  } catch (e) {
    console.error('Error leyendo estado:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Guarda el estado completo de la app y deja una copia de respaldo en el historial
app.put('/api/state', checkAuth, async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'invalid_body' });
  }
  try {
    await pool.query(
      `INSERT INTO app_state (business_key, data, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (business_key) DO UPDATE SET data = $2, updated_at = now()`,
      [BUSINESS_KEY, data]
    );
    await pool.query(
      `INSERT INTO app_state_history (business_key, data) VALUES ($1, $2)`,
      [BUSINESS_KEY, data]
    );
    await pool.query(
      `DELETE FROM app_state_history
       WHERE id IN (
         SELECT id FROM app_state_history
         WHERE business_key = $1
         ORDER BY created_at DESC
         OFFSET $2
       )`,
      [BUSINESS_KEY, MAX_HISTORY]
    );
    res.json({ ok: true, updated_at: new Date().toISOString() });
  } catch (e) {
    console.error('Error guardando estado:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Lista las copias de respaldo disponibles (por si necesitas restaurar una anterior)
app.get('/api/history', checkAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, created_at FROM app_state_history
       WHERE business_key = $1 ORDER BY created_at DESC LIMIT $2`,
      [BUSINESS_KEY, MAX_HISTORY]
    );
    res.json({ history: r.rows });
  } catch (e) {
    console.error('Error leyendo historial:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// Restaura una copia de respaldo específica como el estado actual
app.post('/api/history/:id/restore', checkAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT data FROM app_state_history WHERE id = $1 AND business_key = $2`,
      [req.params.id, BUSINESS_KEY]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    await pool.query(
      `INSERT INTO app_state (business_key, data, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (business_key) DO UPDATE SET data = $2, updated_at = now()`,
      [BUSINESS_KEY, r.rows[0].data]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('Error restaurando respaldo:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Sirve la app (el archivo HTML) como sitio estático
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

ensureSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`✅ Servidor corriendo en el puerto ${PORT}`));
  })
  .catch((err) => {
    console.error('❌ Error creando las tablas de la base de datos:', err);
    process.exit(1);
  });
