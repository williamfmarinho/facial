require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD || 0.45);
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function isValidDescriptor(descriptor) {
  return (
    Array.isArray(descriptor) &&
    descriptor.length === 128 &&
    descriptor.every((v) => Number.isFinite(v))
  );
}

function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

async function findBestMatch(descriptor) {
  const result = await pool.query(
    'SELECT id, full_name, age, descriptor FROM public.face_users'
  );

  let best = null;

  for (const row of result.rows) {
    const candidate = row.descriptor;
    if (!Array.isArray(candidate) || candidate.length !== 128) {
      continue;
    }

    const distance = euclideanDistance(descriptor, candidate.map(Number));

    if (!best || distance < best.distance) {
      best = {
        id: row.id,
        fullName: row.full_name,
        age: row.age,
        distance,
      };
    }
  }

  return best;
}

app.get('/api/health', async (_, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true, db: 'connected' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/enroll', async (req, res) => {
  try {
    const { fullName, age, descriptor } = req.body || {};

    if (!fullName || typeof fullName !== 'string') {
      return res.status(400).json({ error: 'fullName is required' });
    }

    const safeName = fullName.trim();
    if (safeName.length < 2 || safeName.length > 120) {
      return res.status(400).json({ error: 'fullName length must be between 2 and 120' });
    }

    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      return res.status(400).json({ error: 'age must be an integer between 1 and 120' });
    }

    if (!isValidDescriptor(descriptor)) {
      return res.status(400).json({ error: 'invalid descriptor' });
    }

    const upsertResult = await pool.query(
      `INSERT INTO public.face_users (full_name, age, descriptor)
       VALUES ($1, $2, $3)
       ON CONFLICT (full_name)
       DO UPDATE SET age = EXCLUDED.age, descriptor = EXCLUDED.descriptor, updated_at = NOW()
       RETURNING id, full_name, age`,
      [safeName, parsedAge, descriptor]
    );

    return res.json({
      message: 'person enrolled',
      person: upsertResult.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/punch', async (req, res) => {
  try {
    const { descriptor, location } = req.body || {};

    if (!isValidDescriptor(descriptor)) {
      return res.status(400).json({ error: 'invalid descriptor' });
    }

    const bestMatch = await findBestMatch(descriptor);

    if (!bestMatch) {
      return res.status(404).json({ error: 'no enrolled people found' });
    }

    if (bestMatch.distance > MATCH_THRESHOLD) {
      return res.status(401).json({
        error: 'face not recognized',
        distance: Number(bestMatch.distance.toFixed(4)),
        threshold: MATCH_THRESHOLD,
      });
    }

    const safeLocation =
      typeof location === 'string' && location.trim()
        ? location.trim().slice(0, 120)
        : 'web';

    const insertResult = await pool.query(
      `INSERT INTO public."registroPonto"
      (username, horario, local, data, minuto, segundo, created_at)
      VALUES (
        $1,
        (NOW() AT TIME ZONE $2)::time,
        $3,
        (NOW() AT TIME ZONE $2)::date,
        EXTRACT(MINUTE FROM (NOW() AT TIME ZONE $2))::integer,
        EXTRACT(SECOND FROM (NOW() AT TIME ZONE $2))::integer,
        (NOW() AT TIME ZONE $2)
      )
      RETURNING *`,
      [bestMatch.fullName, APP_TIMEZONE, safeLocation]
    );

    return res.json({
      message: 'punch registered',
      person: {
        id: bestMatch.id,
        fullName: bestMatch.fullName,
        age: bestMatch.age,
      },
      distance: Number(bestMatch.distance.toFixed(4)),
      punchSaved: true,
      row: insertResult.rows[0],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
