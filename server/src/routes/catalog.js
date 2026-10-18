const express = require('express');

const { pool, num, mapDestination, mapHotel, mapAttraction, mapTransport } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function likeValue(q) {
  const escaped = String(q).replace(/[\\%_]/g, (c) => '\\' + c);
  return `%${escaped}%`;
}

function toInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

// GET /api/destinations
router.get('/destinations', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, name, province, intro, ref_url FROM destinations ORDER BY id ASC');
    return res.json(rows.map(mapDestination));
  } catch (err) {
    return next(err);
  }
});

// GET /api/cities -> { cities: [...] }
router.get('/cities', requireAuth, async (req, res, next) => {
  try {
    const [destRows] = await pool.query('SELECT name FROM destinations');
    const [transportRows] = await pool.query(
      'SELECT from_city AS city FROM transports UNION SELECT to_city AS city FROM transports'
    );
    const set = new Set();
    for (const r of destRows) if (r.name) set.add(String(r.name).trim());
    for (const r of transportRows) if (r.city) set.add(String(r.city).trim());
    const cities = Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    return res.json({ cities });
  } catch (err) {
    return next(err);
  }
});

// GET /api/hotels?destinationId=&q=
router.get('/hotels', requireAuth, async (req, res, next) => {
  try {
    const destinationId = toInt(req.query.destinationId);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const where = [];
    const params = [];
    if (destinationId !== null) {
      where.push('h.destination_id = ?');
      params.push(destinationId);
    }
    if (q) {
      where.push('h.name LIKE ?');
      params.push(likeValue(q));
    }

    const sql =
      'SELECT h.id, h.destination_id, d.name AS destination_name, h.name, h.level, h.address,' +
      ' h.price_per_night, h.note, h.ref_url' +
      ' FROM hotels h JOIN destinations d ON d.id = h.destination_id' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY h.price_per_night ASC, h.id ASC';

    const [rows] = await pool.query(sql, params);
    return res.json(rows.map(mapHotel));
  } catch (err) {
    return next(err);
  }
});

// GET /api/attractions?destinationId=&q=
router.get('/attractions', requireAuth, async (req, res, next) => {
  try {
    const destinationId = toInt(req.query.destinationId);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    const where = [];
    const params = [];
    if (destinationId !== null) {
      where.push('a.destination_id = ?');
      params.push(destinationId);
    }
    if (q) {
      where.push('a.name LIKE ?');
      params.push(likeValue(q));
    }

    const sql =
      'SELECT a.id, a.destination_id, d.name AS destination_name, a.name, a.ticket_price, a.open_time, a.note,' +
      ' a.ref_url' +
      ' FROM attractions a JOIN destinations d ON d.id = a.destination_id' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY a.ticket_price ASC, a.id ASC';

    const [rows] = await pool.query(sql, params);
    return res.json(rows.map(mapAttraction));
  } catch (err) {
    return next(err);
  }
});

// GET /api/transports?from=&to=&mode=
router.get('/transports', requireAuth, async (req, res, next) => {
  try {
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
    const mode = typeof req.query.mode === 'string' ? req.query.mode.trim() : '';

    const where = [];
    const params = [];
    if (from) {
      where.push('from_city = ?');
      params.push(from);
    }
    if (to) {
      where.push('to_city = ?');
      params.push(to);
    }
    if (mode) {
      where.push('mode = ?');
      params.push(mode);
    }

    // 可选 limit：不传时返回全部（行为与之前一致），传了就截断，方便移动端只取前 N 条
    let limitSql = '';
    const rawLimit = req.query.limit;
    if (rawLimit !== undefined && rawLimit !== '') {
      const limit = Number(rawLimit);
      if (!Number.isInteger(limit) || limit <= 0) {
        return res.status(400).json({ error: 'limit 要填大于 0 的整数' });
      }
      limitSql = ' LIMIT ' + Math.min(limit, 5000);
    }

    const sql =
      'SELECT id, from_city, to_city, mode, duration_minutes, price, note FROM transports' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY price ASC, id ASC' +
      limitSql;

    const [rows] = await pool.query(sql, params);
    return res.json(rows.map(mapTransport));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
