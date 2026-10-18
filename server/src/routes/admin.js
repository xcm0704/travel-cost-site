const express = require('express');

const {
  pool,
  mapDestinationAdmin,
  mapHotelAdmin,
  mapAttractionAdmin,
  mapTransportAdmin,
  mapUser,
} = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

const MAX_MONEY = 99999999.99;

function bad(res, msg) {
  return res.status(400).json({ error: msg });
}

function notFound(res) {
  return res.status(404).json({ error: '记录不存在' });
}

function quoteLike(value) {
  return '%' + String(value).replace(/[\\%_]/g, function (c) { return '\\' + c; }) + '%';
}

function requireText(raw, label, max) {
  if (raw === undefined || raw === null) return { error: '请填写' + label };
  const s = String(raw).trim();
  if (!s) return { error: '请填写' + label };
  if (s.length > max) return { error: label + '最多 ' + max + ' 个字' };
  return { value: s };
}

function optionalText(raw, label, max, fallback) {
  const empty = fallback === undefined ? '' : fallback;
  if (raw === undefined || raw === null) return { value: empty };
  const s = String(raw).trim();
  if (s.length > max) return { error: label + '最多 ' + max + ' 个字' };
  return { value: s };
}

function requireMoney(raw, label) {
  if (raw === undefined || raw === null || raw === '') return { error: '请填写' + label };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { error: label + '要填数字' };
  if (n < 0) return { error: label + '不能是负数' };
  if (n > MAX_MONEY) return { error: label + '太大了' };
  return { value: Math.round(n * 100) / 100 };
}

function requireInt(raw, label, min, max, fallback) {
  if (raw === undefined || raw === null || raw === '') {
    if (fallback !== undefined) return { value: fallback };
    return { error: '请填写' + label };
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) return { error: label + '要填整数' };
  if (n < min || n > max) return { error: label + '要在 ' + min + '~' + max + ' 之间' };
  return { value: n };
}

function pick(body, key, existing) {
  if (Object.prototype.hasOwnProperty.call(body, key)) return body[key];
  return existing ? existing[key] : undefined;
}

function dupError(res, err, msg) {
  if (err && err.code === 'ER_DUP_ENTRY') return bad(res, msg);
  if (err && err.code === 'ER_ROW_IS_REFERENCED_2') {
    return bad(res, '这个目的地下面还有酒店或门票，先删掉它们');
  }
  throw err;
}

async function destinationExists(id) {
  const [rows] = await pool.query('SELECT id FROM destinations WHERE id = ? LIMIT 1', [id]);
  return rows.length > 0;
}

/* ------------------------------ 数据总览 / 注册用户 ------------------------------ */

router.get('/overview', async (req, res, next) => {
  try {
    const [[users]] = await pool.query('SELECT COUNT(*) AS c FROM users');
    const [[destinations]] = await pool.query('SELECT COUNT(*) AS c FROM destinations');
    const [[hotels]] = await pool.query('SELECT COUNT(*) AS c FROM hotels');
    const [[attractions]] = await pool.query('SELECT COUNT(*) AS c FROM attractions');
    const [[transports]] = await pool.query('SELECT COUNT(*) AS c FROM transports');
    return res.json({
      users: Number(users.c),
      destinations: Number(destinations.c),
      hotels: Number(hotels.c),
      attractions: Number(attractions.c),
      transports: Number(transports.c),
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC, id DESC'
    );
    return res.json(rows.map(mapUser));
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------- 目的地 --------------------------------- */

async function getDestination(id) {
  const [rows] = await pool.query('SELECT * FROM destinations WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

router.get('/destinations', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM destinations ORDER BY id ASC');
    return res.json(rows.map(mapDestinationAdmin));
  } catch (err) {
    return next(err);
  }
});

router.post('/destinations', async (req, res, next) => {
  try {
    const body = req.body || {};
    const name = requireText(body.name, '目的地名称', 50);
    if (name.error) return bad(res, name.error);
    const province = optionalText(body.province, '省份', 50);
    if (province.error) return bad(res, province.error);
    const intro = optionalText(body.intro, '介绍', 255);
    if (intro.error) return bad(res, intro.error);

    let result;
    try {
      [result] = await pool.query('INSERT INTO destinations (name, province, intro) VALUES (?, ?, ?)', [
        name.value,
        province.value,
        intro.value,
      ]);
    } catch (err) {
      return dupError(res, err, '这个目的地名称已经存在了');
    }
    const row = await getDestination(result.insertId);
    return res.status(201).json(mapDestinationAdmin(row));
  } catch (err) {
    return next(err);
  }
});

router.put('/destinations/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return notFound(res);
    const existing = await getDestination(id);
    if (!existing) return notFound(res);

    const body = req.body || {};
    const name = requireText(pick(body, 'name', { name: existing.name }), '目的地名称', 50);
    if (name.error) return bad(res, name.error);
    const province = optionalText(pick(body, 'province', { province: existing.province }), '省份', 50);
    if (province.error) return bad(res, province.error);
    const intro = optionalText(pick(body, 'intro', { intro: existing.intro }), '介绍', 255);
    if (intro.error) return bad(res, intro.error);

    try {
      await pool.query('UPDATE destinations SET name = ?, province = ?, intro = ? WHERE id = ?', [
        name.value,
        province.value,
        intro.value,
        id,
      ]);
    } catch (err) {
      return dupError(res, err, '这个目的地名称已经存在了');
    }
    const row = await getDestination(id);
    return res.json(mapDestinationAdmin(row));
  } catch (err) {
    return next(err);
  }
});

router.delete('/destinations/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return notFound(res);
    const existing = await getDestination(id);
    if (!existing) return notFound(res);

    const [[hotels]] = await pool.query('SELECT COUNT(*) AS c FROM hotels WHERE destination_id = ?', [id]);
    const [[attractions]] = await pool.query('SELECT COUNT(*) AS c FROM attractions WHERE destination_id = ?', [id]);
    if (Number(hotels.c) > 0 || Number(attractions.c) > 0) {
      return bad(res, '这个目的地下面还有酒店或门票，先删掉它们');
    }
    await pool.query('DELETE FROM destinations WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------- 酒店 --------------------------------- */

const HOTEL_SELECT =
  'SELECT h.*, d.name AS destination_name FROM hotels h JOIN destinations d ON d.id = h.destination_id';

async function getHotel(id) {
  const [rows] = await pool.query(HOTEL_SELECT + ' WHERE h.id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

function hotelPayload(body, existing) {
  const destinationId = requireInt(pick(body, 'destinationId', existing), '所属目的地', 1, 2000000000);
  if (destinationId.error) return destinationId;
  const name = requireText(pick(body, 'name', existing), '酒店名称', 100);
  if (name.error) return name;
  const level = optionalText(pick(body, 'level', existing), '酒店档次', 20);
  if (level.error) return level;
  const address = optionalText(pick(body, 'address', existing), '地址', 200);
  if (address.error) return address;
  const price = requireMoney(pick(body, 'pricePerNight', existing), '每晚价格');
  if (price.error) return price;
  const note = optionalText(pick(body, 'note', existing), '备注', 255);
  if (note.error) return note;
  return {
    value: {
      destinationId: destinationId.value,
      name: name.value,
      level: level.value,
      address: address.value,
      pricePerNight: price.value,
      note: note.value,
    },
  };
}

router.get('/hotels', async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    const destinationId = Number(req.query.destinationId);
    if (req.query.destinationId !== undefined && req.query.destinationId !== '' && Number.isInteger(destinationId)) {
      where.push('h.destination_id = ?');
      params.push(destinationId);
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      where.push('h.name LIKE ?');
      params.push(quoteLike(q));
    }
    const sql =
      HOTEL_SELECT +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY h.destination_id ASC, h.price_per_night ASC, h.id ASC';
    const [rows] = await pool.query(sql, params);
    return res.json(rows.map(mapHotelAdmin));
  } catch (err) {
    return next(err);
  }
});

router.post('/hotels', async (req, res, next) => {
  try {
    const body = req.body || {};
    const payload = hotelPayload(body, null);
    if (payload.error) return bad(res, payload.error);
    if (!(await destinationExists(payload.value.destinationId))) return bad(res, '目的地不存在');

    let result;
    try {
      [result] = await pool.query(
        'INSERT INTO hotels (destination_id, name, level, address, price_per_night, note) VALUES (?, ?, ?, ?, ?, ?)',
        [
          payload.value.destinationId,
          payload.value.name,
          payload.value.level,
          payload.value.address,
          payload.value.pricePerNight,
          payload.value.note,
        ]
      );
    } catch (err) {
      return dupError(res, err, '这个目的地下已经有同名酒店了');
    }
    const row = await getHotel(result.insertId);
    return res.status(201).json(mapHotelAdmin(row));
  } catch (err) {
    return next(err);
  }
});

router.put('/hotels/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return notFound(res);
    const existing = await getHotel(id);
    if (!existing) return notFound(res);

    const body = req.body || {};
    const payload = hotelPayload(body, {
      destinationId: existing.destination_id,
      name: existing.name,
      level: existing.level,
      address: existing.address,
      pricePerNight: existing.price_per_night,
      note: existing.note,
    });
    if (payload.error) return bad(res, payload.error);
    if (!(await destinationExists(payload.value.destinationId))) return bad(res, '目的地不存在');

    try {
      await pool.query(
        'UPDATE hotels SET destination_id = ?, name = ?, level = ?, address = ?, price_per_night = ?, note = ? WHERE id = ?',
        [
          payload.value.destinationId,
          payload.value.name,
          payload.value.level,
          payload.value.address,
          payload.value.pricePerNight,
          payload.value.note,
          id,
        ]
      );
    } catch (err) {
      return dupError(res, err, '这个目的地下已经有同名酒店了');
    }
    const row = await getHotel(id);
    return res.json(mapHotelAdmin(row));
  } catch (err) {
    return next(err);
  }
});

router.delete('/hotels/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return notFound(res);
    const [result] = await pool.query('DELETE FROM hotels WHERE id = ?', [id]);
    if (result.affectedRows === 0) return notFound(res);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------- 门票 --------------------------------- */

const ATTRACTION_SELECT =
  'SELECT a.*, d.name AS destination_name FROM attractions a JOIN destinations d ON d.id = a.destination_id';

async function getAttraction(id) {
  const [rows] = await pool.query(ATTRACTION_SELECT + ' WHERE a.id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

function attractionPayload(body, existing) {
  const destinationId = requireInt(pick(body, 'destinationId', existing), '所属目的地', 1, 2000000000);
  if (destinationId.error) return destinationId;
  const name = requireText(pick(body, 'name', existing), '景点名称', 100);
  if (name.error) return name;
  const price = requireMoney(pick(body, 'ticketPrice', existing), '门票价格');
  if (price.error) return price;
  const openTime = optionalText(pick(body, 'openTime', existing), '开放时间', 100);
  if (openTime.error) return openTime;
  const note = optionalText(pick(body, 'note', existing), '备注', 255);
  if (note.error) return note;
  return {
    value: {
      destinationId: destinationId.value,
      name: name.value,
      ticketPrice: price.value,
      openTime: openTime.value,
      note: note.value,
    },
  };
}

router.get('/attractions', async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    const destinationId = Number(req.query.destinationId);
    if (req.query.destinationId !== undefined && req.query.destinationId !== '' && Number.isInteger(destinationId)) {
      where.push('a.destination_id = ?');
      params.push(destinationId);
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      where.push('a.name LIKE ?');
      params.push(quoteLike(q));
    }
    const sql =
      ATTRACTION_SELECT +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY a.destination_id ASC, a.id ASC';
    const [rows] = await pool.query(sql, params);
    return res.json(rows.map(mapAttractionAdmin));
  } catch (err) {
    return next(err);
  }
});

router.post('/attractions', async (req, res, next) => {
  try {
    const body = req.body || {};
    const payload = attractionPayload(body, null);
    if (payload.error) return bad(res, payload.error);
    if (!(await destinationExists(payload.value.destinationId))) return bad(res, '目的地不存在');

    let result;
    try {
      [result] = await pool.query(
        'INSERT INTO attractions (destination_id, name, ticket_price, open_time, note) VALUES (?, ?, ?, ?, ?)',
        [
          payload.value.destinationId,
          payload.value.name,
          payload.value.ticketPrice,
          payload.value.openTime,
          payload.value.note,
        ]
      );
    } catch (err) {
      return dupError(res, err, '这个目的地下已经有同名景点了');
    }
    const row = await getAttraction(result.insertId);
    return res.status(201).json(mapAttractionAdmin(row));
  } catch (err) {
    return next(err);
  }
});

router.put('/attractions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return notFound(res);
    const existing = await getAttraction(id);
    if (!existing) return notFound(res);

    const body = req.body || {};
    const payload = attractionPayload(body, {
      destinationId: existing.destination_id,
      name: existing.name,
      ticketPrice: existing.ticket_price,
      openTime: existing.open_time,
      note: existing.note,
    });
    if (payload.error) return bad(res, payload.error);
    if (!(await destinationExists(payload.value.destinationId))) return bad(res, '目的地不存在');

    try {
      await pool.query(
        'UPDATE attractions SET destination_id = ?, name = ?, ticket_price = ?, open_time = ?, note = ? WHERE id = ?',
        [
          payload.value.destinationId,
          payload.value.name,
          payload.value.ticketPrice,
          payload.value.openTime,
          payload.value.note,
          id,
        ]
      );
    } catch (err) {
      return dupError(res, err, '这个目的地下已经有同名景点了');
    }
    const row = await getAttraction(id);
    return res.json(mapAttractionAdmin(row));
  } catch (err) {
    return next(err);
  }
});

router.delete('/attractions/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return notFound(res);
    const [result] = await pool.query('DELETE FROM attractions WHERE id = ?', [id]);
    if (result.affectedRows === 0) return notFound(res);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------- 车费 --------------------------------- */

async function getTransport(id) {
  const [rows] = await pool.query('SELECT * FROM transports WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

function transportPayload(body, existing) {
  const fromCity = requireText(pick(body, 'fromCity', existing), '出发城市', 50);
  if (fromCity.error) return fromCity;
  const toCity = requireText(pick(body, 'toCity', existing), '到达城市', 50);
  if (toCity.error) return toCity;
  const mode = requireText(pick(body, 'mode', existing), '交通方式', 20);
  if (mode.error) return mode;
  const durationMinutes = requireInt(pick(body, 'durationMinutes', existing), '用时(分钟)', 0, 100000, 0);
  if (durationMinutes.error) return durationMinutes;
  const price = requireMoney(pick(body, 'price', existing), '票价');
  if (price.error) return price;
  const note = optionalText(pick(body, 'note', existing), '备注', 255);
  if (note.error) return note;
  return {
    value: {
      fromCity: fromCity.value,
      toCity: toCity.value,
      mode: mode.value,
      durationMinutes: durationMinutes.value,
      price: price.value,
      note: note.value,
    },
  };
}

router.get('/transports', async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
    if (from) {
      where.push('from_city = ?');
      params.push(from);
    }
    if (to) {
      where.push('to_city = ?');
      params.push(to);
    }
    const sql =
      'SELECT * FROM transports' +
      (where.length ? ' WHERE ' + where.join(' AND ') : '') +
      ' ORDER BY from_city ASC, to_city ASC, price ASC, id ASC';
    const [rows] = await pool.query(sql, params);
    return res.json(rows.map(mapTransportAdmin));
  } catch (err) {
    return next(err);
  }
});

router.post('/transports', async (req, res, next) => {
  try {
    const body = req.body || {};
    const payload = transportPayload(body, null);
    if (payload.error) return bad(res, payload.error);

    let result;
    try {
      [result] = await pool.query(
        'INSERT INTO transports (from_city, to_city, mode, duration_minutes, price, note) VALUES (?, ?, ?, ?, ?, ?)',
        [
          payload.value.fromCity,
          payload.value.toCity,
          payload.value.mode,
          payload.value.durationMinutes,
          payload.value.price,
          payload.value.note,
        ]
      );
    } catch (err) {
      return dupError(res, err, '这条线路的交通方式已经录入过了');
    }
    const row = await getTransport(result.insertId);
    return res.status(201).json(mapTransportAdmin(row));
  } catch (err) {
    return next(err);
  }
});

router.put('/transports/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return notFound(res);
    const existing = await getTransport(id);
    if (!existing) return notFound(res);

    const body = req.body || {};
    const payload = transportPayload(body, {
      fromCity: existing.from_city,
      toCity: existing.to_city,
      mode: existing.mode,
      durationMinutes: existing.duration_minutes,
      price: existing.price,
      note: existing.note,
    });
    if (payload.error) return bad(res, payload.error);

    try {
      await pool.query(
        'UPDATE transports SET from_city = ?, to_city = ?, mode = ?, duration_minutes = ?, price = ?, note = ? WHERE id = ?',
        [
          payload.value.fromCity,
          payload.value.toCity,
          payload.value.mode,
          payload.value.durationMinutes,
          payload.value.price,
          payload.value.note,
          id,
        ]
      );
    } catch (err) {
      return dupError(res, err, '这条线路的交通方式已经录入过了');
    }
    const row = await getTransport(id);
    return res.json(mapTransportAdmin(row));
  } catch (err) {
    return next(err);
  }
});

router.delete('/transports/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return notFound(res);
    const [result] = await pool.query('DELETE FROM transports WHERE id = ?', [id]);
    if (result.affectedRows === 0) return notFound(res);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
