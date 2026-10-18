// 按里程测算生成城际车费（每对城市只给 1 条默认方式 + 短途自驾），覆盖全部城市两两互连
// 用法： node server/scripts/gen-transports.js
//        npm run db:setup 会在导入城市之后自动调用它，最后再用 curated 真实价覆盖
const fs = require('fs');
const path = require('path');

const config = require('../src/config');
const { createConnection, explainError } = require('../db/connect');

const DATA_DIRS = [
  path.resolve(__dirname, '..', 'db', 'data'),
  path.resolve(__dirname, '..', 'db', 'data2'),
];
const DATA_DIR = DATA_DIRS[0];
const NOTE = '参考测算价（按里程估算），实际以购票平台为准';
const CHUNK = 1000; // 多值 INSERT 每批行数
const PROGRESS_EVERY = 10; // 每 10 批（约 1 万行）打一次进度

// 规则（337 城两两互连也扛得住：每对最多 2 行，不是 2-3 种方式都铺）
const HIGH_SPEED_MAX = 1500; // ≤1500km 走高铁
const SELF_DRIVE_MAX = 400; // ≤400km 再补一条自驾

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

// 默认方式：≤1500km 高铁，否则飞机；短途再加一条自驾
function modesFor(distance) {
  const out = [];
  if (distance <= HIGH_SPEED_MAX) {
    out.push({
      mode: '高铁',
      duration: Math.max(40, Math.round((distance / 250) * 60)),
      price: Math.max(60, Math.round(distance * 0.45)),
    });
  } else {
    out.push({
      mode: '飞机',
      duration: Math.round((distance / 700) * 60) + 60,
      price: Math.max(400, Math.round(distance * 0.62)),
    });
  }
  if (distance <= SELF_DRIVE_MAX) {
    out.push({
      mode: '自驾',
      duration: Math.round((distance / 85) * 60),
      price: Math.round(distance * 1.1),
    });
  }
  return out;
}

const FALLBACK_COORDS = {
  大连: [38.914, 121.615],
  北京: [39.904, 116.407],
  上海: [31.23, 121.474],
  杭州: [30.274, 120.155],
  成都: [30.573, 104.066],
};

// 坐标优先取 db/data 与 db/data2 的 json，缺的用兜底表
function loadCoords(dirs) {
  const coords = new Map(Object.entries(FALLBACK_COORDS));
  const list = Array.isArray(dirs) ? dirs : [dirs];
  for (const dir of list) {
    if (!dir || !fs.existsSync(dir)) continue;
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
  }
  return coords;
}

// 全部城市两两互连（验收要求「任意两城能算总价」，枢纽规则只是它的子集）
function buildPairs(allCities) {
  const pairs = new Set();
  const addPair = function (a, b) {
    if (!a || !b || a === b) return;
    pairs.add(a < b ? a + '|' + b : b + '|' + a);
  };
  const cities = Array.from(allCities);
  for (let i = 0; i < cities.length; i += 1) {
    for (let j = i + 1; j < cities.length; j += 1) addPair(cities[i], cities[j]);
  }
  return pairs;
}

// 只刷新「自己生成的」行：note 已经是测算价的才更新，curated 真实价永远不动
async function flush(conn, rows) {
  const oneRow = '(?, ?, ?, ?, ?, ?)';
  const placeholders = rows.map(function () { return oneRow; }).join(', ');
  const params = [];
  for (const row of rows) {
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
  return Number(res.affectedRows || 0);
}

// 先清掉上一轮测算生成的行（note 是测算口径的那些），避免规则变了留下过期方式；
// curated 真实线路的 note 不一样，永远不会被删
async function pruneGenerated(conn) {
  const [res] = await conn.query('DELETE FROM transports WHERE note = ?', [NOTE]);
  return Number(res.affectedRows || 0);
}

async function generateTransports(conn, options) {
  const opts = options || {};
  const dirs = opts.dirs || (opts.dir ? [opts.dir] : DATA_DIRS);
  const quiet = !!opts.quiet;

  let pruned = 0;
  if (opts.prune !== false) {
    pruned = await pruneGenerated(conn);
    if (!quiet && pruned > 0) console.log('  先清掉上一轮测算生成的 ' + pruned + ' 条（curated 真实价保留）');
  }

  const coords = loadCoords(dirs);
  const [rows] = await conn.query('SELECT name FROM destinations');
  const allCities = new Set(rows.map(function (r) { return String(r.name).trim(); }));

  const pairs = buildPairs(allCities);
  const seen = new Set();
  let buffer = [];
  let total = 0;
  let batches = 0;
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
        buffer.push({
          from_city: direction[0],
          to_city: direction[1],
          mode: item.mode,
          duration_minutes: item.duration,
          price: item.price,
        });
        stats.byMode[item.mode] = (stats.byMode[item.mode] || 0) + 1;
        if (buffer.length >= CHUNK) {
          stats.rows += await flush(conn, buffer);
          total += buffer.length;
          buffer = [];
          batches += 1;
          if (!quiet && batches % PROGRESS_EVERY === 0) {
            console.log('  车费生成进度：已写入 ' + total + ' / 约 ' + pairs.size * 2 + ' 条');
          }
        }
      }
    }
  }
  if (buffer.length) {
    stats.rows += await flush(conn, buffer);
    total += buffer.length;
    buffer = [];
  }

  stats.generated = total;
  stats.pruned = pruned;
  stats.skippedNoCoord = Array.from(new Set(stats.skippedNoCoord));
  if (!quiet) {
    console.log('测算车费：城市 ' + stats.cities + ' 个、城市对 ' + stats.pairs + ' 组、生成 ' + total + ' 条' +
      '（高铁 ' + (stats.byMode['高铁'] || 0) + '、飞机 ' + (stats.byMode['飞机'] || 0) + '、自驾 ' + (stats.byMode['自驾'] || 0) + '）');
    if (stats.skippedNoCoord.length) {
      console.log('[提醒] 这些城市没有坐标，相关线路没生成：' + stats.skippedNoCoord.slice(0, 10).join('、'));
    }
  }
  return { batchSize: total, stats: stats };
}

async function main() {
  console.log('目标数据库： ' + config.dbTarget() + ' | TLS：' + config.tlsLabel());
  const conn = await createConnection();
  try {
    await conn.query('USE `' + config.db.database + '`');
    await generateTransports(conn);
    const [cnt] = await conn.query('SELECT COUNT(*) AS c FROM transports');
    console.log('transports 现有 ' + Number(cnt[0].c) + ' 条（含 curated 真实线路）');
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

module.exports = {
  generateTransports,
  pruneGenerated,
  haversine,
  modesFor,
  NOTE,
  DATA_DIR,
  DATA_DIRS,
  HIGH_SPEED_MAX,
  SELF_DRIVE_MAX,
};
