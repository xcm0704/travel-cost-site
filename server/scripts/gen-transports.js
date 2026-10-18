// 按里程测算生成城际车费（高铁/飞机/自驾），覆盖 8 枢纽 × 全部城市 + 12 热门城市两两互连
// 用法： node server/scripts/gen-transports.js
//        npm run db:setup 会在导入城市之后自动调用它，最后再用 curated 真实价覆盖
const fs = require('fs');
const path = require('path');

const config = require('../src/config');
const { createConnection, explainError } = require('../db/connect');

const DATA_DIR = path.resolve(__dirname, '..', 'db', 'data');
const NOTE = '参考测算价（按里程估算），实际以购票平台为准';
const CHUNK = 200;

const HUBS = ['北京', '上海', '广州', '深圳', '成都', '西安', '杭州', '武汉'];
const HOT_CITIES = ['北京', '上海', '广州', '深圳', '成都', '西安', '杭州', '武汉', '重庆', '南京', '青岛', '大连'];

// 数据文件没覆盖到时的兜底坐标（现有 5 个策展城市的市中心）
const FALLBACK_COORDS = {
  大连: [38.914, 121.615],
  北京: [39.904, 116.407],
  上海: [31.23, 121.474],
  杭州: [30.274, 120.155],
  成都: [30.573, 104.066],
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = function (deg) { return (deg * Math.PI) / 180; };
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// 契约 1.3 的三条公式
function modesFor(distance) {
  const out = [];
  if (distance <= 1500) {
    out.push({
      mode: '高铁',
      duration: Math.max(40, Math.round((distance / 250) * 60)),
      price: Math.max(60, Math.round(distance * 0.45)),
    });
  }
  if (distance >= 600) {
    out.push({
      mode: '飞机',
      duration: Math.round((distance / 700) * 60) + 60,
      price: Math.max(400, Math.round(distance * 0.62)),
    });
  }
  if (distance <= 2000) {
    out.push({
      mode: '自驾',
      duration: Math.round((distance / 85) * 60),
      price: Math.round(distance * 1.1),
    });
  }
  return out;
}

// 坐标优先取 data/*.json，缺的用兜底表
function loadCoords(dir) {
  const coords = new Map(Object.entries(FALLBACK_COORDS));
  if (!fs.existsSync(dir)) return coords;
  const files = fs.readdirSync(dir).filter(function (n) { return n.toLowerCase().endsWith('.json'); });
  for (const name of files) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    } catch (err) {
      continue;
    }
    const cities = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.cities) ? parsed.cities : [];
    for (const city of cities) {
      const cityName = city && city.name ? String(city.name).trim() : '';
      const lat = Number(city && city.lat);
      const lon = Number(city && city.lon);
      if (!cityName || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      coords.set(cityName, [lat, lon]);
    }
  }
  return coords;
}

function buildPairs(allCities) {
  const pairs = new Set();
  const addPair = function (a, b) {
    if (!a || !b || a === b) return;
    pairs.add(a < b ? a + '|' + b : b + '|' + a);
  };
  for (const hub of HUBS) {
    if (!allCities.has(hub)) continue;
    for (const city of allCities) addPair(hub, city);
  }
  const hot = HOT_CITIES.filter(function (c) { return allCities.has(c); });
  for (let i = 0; i < hot.length; i += 1) {
    for (let j = i + 1; j < hot.length; j += 1) addPair(hot[i], hot[j]);
  }
  return pairs;
}

async function generateTransports(conn, options) {
  const opts = options || {};
  const dir = opts.dir || DATA_DIR;
  const quiet = !!opts.quiet;

  const coords = loadCoords(dir);
  const [rows] = await conn.query('SELECT name FROM destinations');
  const allCities = new Set(rows.map(function (r) { return String(r.name).trim(); }));

  const pairs = buildPairs(allCities);
  const seen = new Set();
  const batch = [];
  const stats = { cities: allCities.size, pairs: pairs.size, rows: 0, byMode: {}, skippedNoCoord: [] };

  for (const pair of pairs) {
    const parts = pair.split('|');
    const a = parts[0];
    const b = parts[1];
    const ca = coords.get(a);
    const cb = coords.get(b);
    if (!ca || !cb) {
      if (!ca) stats.skippedNoCoord.push(a);
      if (!cb) stats.skippedNoCoord.push(b);
      continue;
    }
    const distance = haversine(ca[0], ca[1], cb[0], cb[1]);
    for (const item of modesFor(distance)) {
      for (const direction of [[a, b], [b, a]]) {
        const key = direction[0] + '|' + direction[1] + '|' + item.mode;
        if (seen.has(key)) continue;
        seen.add(key);
        batch.push({
          from_city: direction[0],
          to_city: direction[1],
          mode: item.mode,
          duration_minutes: item.duration,
          price: item.price,
        });
        stats.byMode[item.mode] = (stats.byMode[item.mode] || 0) + 1;
      }
    }
  }

  // 只刷新「自己生成的」行：note 已经是测算价的才更新，curated 真实价永远不动
  for (let i = 0; i < batch.length; i += CHUNK) {
    const chunk = batch.slice(i, i + CHUNK);
    const oneRow = '(?, ?, ?, ?, ?, ?)';
    const placeholders = chunk.map(function () { return oneRow; }).join(', ');
    const params = [];
    for (const row of chunk) {
      params.push(row.from_city, row.to_city, row.mode, row.duration_minutes, row.price, NOTE);
    }
    params.push(NOTE, NOTE, NOTE);
    const sql =
      'INSERT INTO transports (from_city, to_city, mode, duration_minutes, price, note) VALUES ' + placeholders +
      ' ON DUPLICATE KEY UPDATE' +
      ' duration_minutes = IF(note = ?, VALUES(duration_minutes), duration_minutes),' +
      ' price = IF(note = ?, VALUES(price), price),' +
      ' note = IF(note = ?, VALUES(note), note)';
    const [res] = await conn.query(sql, params);
    stats.rows += Number(res.affectedRows || 0);
  }

  stats.skippedNoCoord = Array.from(new Set(stats.skippedNoCoord));
  if (!quiet) {
    console.log('测算车费：城市 ' + stats.cities + ' 个、城市对 ' + stats.pairs + ' 组、写入 ' + batch.length + ' 条' +
      '（高铁 ' + (stats.byMode['高铁'] || 0) + '、飞机 ' + (stats.byMode['飞机'] || 0) + '、自驾 ' + (stats.byMode['自驾'] || 0) + '）');
    if (stats.skippedNoCoord.length) {
      console.log('[提醒] 这些城市没有坐标，相关线路没生成：' + stats.skippedNoCoord.slice(0, 10).join('、'));
    }
  }
  return { batchSize: batch.length, stats: stats };
}

async function main() {
  console.log('目标数据库： ' + config.dbTarget() + ' | TLS：' + config.tlsLabel());
  const conn = await createConnection();
  try {
    await conn.query('USE `' + config.db.database + '`');
    const result = await generateTransports(conn);
    const [[total]] = await conn.query('SELECT COUNT(*) AS c FROM transports');
    console.log('transports 现有 ' + Number(total.c) + ' 条（含 curated 真实线路）');
    if (result.stats.skippedNoCoord.length) process.exitCode = 0;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  main().catch(function (err) {
    console.error('');
    console.error('生成失败：' + explainError(err));
    console.error('目标：' + config.dbTarget());
    process.exit(1);
  });
}

module.exports = { generateTransports, haversine, modesFor, HUBS, HOT_CITIES, NOTE, DATA_DIR };
