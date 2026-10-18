const express = require('express');

const { pool, num } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

// POST /api/estimate
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};

    const destinationId = Number(body.destinationId);
    if (!Number.isInteger(destinationId) || destinationId <= 0) {
      return res.status(400).json({ error: '请选择目的地' });
    }

    const nights = body.nights === undefined || body.nights === null || body.nights === '' ? 1 : Number(body.nights);
    if (!Number.isInteger(nights) || nights < 1 || nights > 30) {
      return res.status(400).json({ error: '住宿天数要 1~30 之间的整数' });
    }

    const roundTrip = toBool(body.roundTrip);

    const [destRows] = await pool.query('SELECT id, name FROM destinations WHERE id = ? LIMIT 1', [destinationId]);
    if (destRows.length === 0) return res.status(400).json({ error: '目的地不存在' });
    const destination = { id: destRows[0].id, name: destRows[0].name };

    // 景点
    let attractionIds = [];
    if (body.attractionIds !== undefined && body.attractionIds !== null) {
      if (!Array.isArray(body.attractionIds)) {
        return res.status(400).json({ error: '景点列表格式不对' });
      }
      attractionIds = body.attractionIds.map(Number);
      if (attractionIds.some((id) => !Number.isInteger(id) || id <= 0)) {
        return res.status(400).json({ error: '景点列表格式不对' });
      }
      attractionIds = Array.from(new Set(attractionIds));
    }

    const attractions = [];
    if (attractionIds.length > 0) {
      const [rows] = await pool.query(
        'SELECT id, name, ticket_price, destination_id FROM attractions WHERE id IN (?)',
        [attractionIds]
      );
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const id of attractionIds) {
        const row = byId.get(id);
        if (!row || Number(row.destination_id) !== destinationId) {
          return res.status(400).json({ error: '所选景点不属于这个目的地' });
        }
        attractions.push({ id: row.id, name: row.name, ticketPrice: num(row.ticket_price) });
      }
    }

    // 酒店
    let hotel = null;
    const hotelId = body.hotelId === undefined || body.hotelId === null || body.hotelId === '' ? null : Number(body.hotelId);
    if (hotelId !== null) {
      if (!Number.isInteger(hotelId) || hotelId <= 0) {
        return res.status(400).json({ error: '酒店参数不对' });
      }
      const [rows] = await pool.query(
        'SELECT id, name, price_per_night FROM hotels WHERE id = ? LIMIT 1',
        [hotelId]
      );
      if (rows.length === 0) return res.status(400).json({ error: '酒店不存在' });
      hotel = { id: rows[0].id, name: rows[0].name, pricePerNight: num(rows[0].price_per_night) };
    }

    // 车费（去程）
    const transportId =
      body.transportId === undefined || body.transportId === null || body.transportId === '' ? null : Number(body.transportId);
    let go = null;
    if (transportId !== null) {
      if (!Number.isInteger(transportId) || transportId <= 0) {
        return res.status(400).json({ error: '车费记录参数不对' });
      }
      const [rows] = await pool.query(
        'SELECT id, from_city, to_city, mode, price FROM transports WHERE id = ? LIMIT 1',
        [transportId]
      );
      if (rows.length === 0) return res.status(400).json({ error: '车费记录不存在' });
      go = rows[0];
    } else {
      const fromCity = typeof body.fromCity === 'string' ? body.fromCity.trim() : '';
      const toCity = typeof body.toCity === 'string' ? body.toCity.trim() : '';
      if (!fromCity || !toCity) {
        return res.status(400).json({ error: '请选择出发城市和目的城市' });
      }
      const [rows] = await pool.query(
        'SELECT id, from_city, to_city, mode, price FROM transports' +
          ' WHERE from_city = ? AND to_city = ? ORDER BY price ASC, id ASC LIMIT 1',
        [fromCity, toCity]
      );
      if (rows.length === 0) return res.status(400).json({ error: '这个路线还没有录入车费' });
      go = rows[0];
    }

    // 返程
    let back = null;
    if (roundTrip) {
      const [rows] = await pool.query(
        'SELECT id, from_city, to_city, mode, price FROM transports' +
          ' WHERE from_city = ? AND to_city = ? AND mode = ? ORDER BY price ASC, id ASC LIMIT 1',
        [go.to_city, go.from_city, go.mode]
      );
      back = rows.length > 0 ? rows[0] : { ...go, from_city: go.to_city, to_city: go.from_city };
    }

    const items = [];
    for (const a of attractions) {
      items.push({ label: `${a.name} 门票`, amount: round2(a.ticketPrice) });
    }
    let hotelAmount = 0;
    if (hotel) {
      hotelAmount = round2(hotel.pricePerNight * nights);
      items.push({ label: `${hotel.name} × ${nights} 晚`, amount: hotelAmount });
    }
    const goPrice = round2(num(go.price));
    items.push({ label: `${go.from_city} → ${go.to_city} ${go.mode}`, amount: goPrice });
    let backPrice = 0;
    if (back) {
      backPrice = round2(num(back.price));
      items.push({ label: `${back.from_city} → ${back.to_city} ${back.mode}（返程）`, amount: backPrice });
    }

    const total = round2(items.reduce((sum, item) => sum + item.amount, 0));

    return res.json({
      destination,
      nights,
      hotel,
      attractions,
      transport: {
        mode: go.mode,
        go: { from: go.from_city, to: go.to_city, mode: go.mode, price: goPrice },
        back: back ? { from: back.from_city, to: back.to_city, mode: back.mode, price: backPrice } : null,
      },
      items,
      total,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
