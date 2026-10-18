// 把 server/db/data/*.json 的城市/酒店/景点导进库里（幂等，靠自然键 upsert）
// 用法： node server/scripts/import-cities.js
//        npm run db:setup 会按顺序自动调用它
const fs = require('fs');
const path = require('path');

const config = require('../src/config');
const { createConnection, explainError } = require('../db/connect');
const { ensureColumns } = require('../db/migrate');

const DATA_DIR = path.resolve(__dirname, '..', 'db', 'data');
const CHUNK = 100;

function text(value, max) {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  return s.length > max ? s.slice(0, max) : s;
}

function pinyinOf(city) {
  return text(city && city.pinyin, 40).toLowerCase().replace(/\s+/g, '');
}

// 外链按契约生成：酒店 hotels.ctrip.com/hotel/{pinyin}，景点/城市 you.ctrip.com
function refUrlFor(kind, pinyin) {
  if (!pinyin) return '';
  if (kind === 'destination') return 'https://you.ctrip.com/place/' + pinyin + '.html';
  if (kind === 'hotel') return 'https://hotels.ctrip.com/hotel/' + pinyin;
  if (kind === 'attraction') return 'https://you.ctrip.com/sight/' + pinyin + '.html';
  return '';
}

function numOrNull(value) {
  const n = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

async function upsertRows(conn, table, columns, rows, updateClause) {
  let affected = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const oneRow = '(' + columns.map(function () { return '?'; }).join(', ') + ')';
    const placeholders = chunk.map(function () { return oneRow; }).join(', ');
    const params = [];
    for (const row of chunk) {
      for (const col of columns) params.push(row[col]);
    }
    const sql =
      'INSERT INTO ' + table + ' (' + columns.join(', ') + ') VALUES ' + placeholders +
      ' ON DUPLICATE KEY UPDATE ' + updateClause;
    const [res] = await conn.query(sql, params);
    affected += Number(res.affectedRows || 0);
  }
  return affected;
}

function readDataFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const names = fs
    .readdirSync(dir)
    .filter(function (name) { return name.toLowerCase().endsWith('.json'); })
    .sort();
  const files = [];
  for (const name of names) {
    const full = path.join(dir, name);
    try {
      const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
      const cities = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.cities) ? parsed.cities : [];
      files.push({ name: name, cities: cities });
    } catch (err) {
      console.warn('[跳过] ' + name + ' 不是合法 JSON：' + (err && err.message));
    }
  }
  return files;
}

async function importCities(conn, options) {
  const opts = options || {};
  const dir = opts.dir || DATA_DIR;
  const quiet = !!opts.quiet;

  await ensureColumns(conn);

  const files = readDataFiles(dir);
  const stats = {
    files: files.map(function (f) { return f.name + '(' + f.cities.length + '城)'; }),
    cities: 0,
    hotels: 0,
    attractions: 0,
    skippedCities: 0,
    skippedHotels: 0,
    skippedAttractions: 0,
    noPinyin: [],
  };

  if (!quiet) {
    console.log(files.length === 0
      ? '没找到 ' + dir + ' 下的 *.json（数据文件还没交付？跳过导入，不影响其它步骤）'
      : '读到的数据文件：' + stats.files.join('、'));
  }
  if (files.length === 0) return stats;

  const cityRows = [];
  const hotelRowsByCity = new Map();
  const attractionRowsByCity = new Map();

  for (const file of files) {
    for (const raw of file.cities) {
      const name = text(raw && raw.name, 50);
      if (!name) {
        stats.skippedCities += 1;
        continue;
      }
      const pinyin = pinyinOf(raw);
      if (!pinyin) stats.noPinyin.push(name);

      cityRows.push({
        name: name,
        province: text(raw.province, 50),
        intro: text(raw.intro, 255),
        ref_url: refUrlFor('destination', pinyin),
      });

      const hotels = Array.isArray(raw.hotels) ? raw.hotels : [];
      const hotelRows = [];
      for (const h of hotels) {
        const hName = text(h && h.name, 100);
        const price = numOrNull(h && h.price);
        if (!hName || price === null) {
          stats.skippedHotels += 1;
          continue;
        }
        hotelRows.push({
          destinationName: name,
          name: hName,
          level: text(h.level, 20),
          address: text(h.address, 200),
          price_per_night: price,
          note: text(h.note, 255),
          ref_url: refUrlFor('hotel', pinyin),
        });
      }
      if (hotelRows.length) hotelRowsByCity.set(name, (hotelRowsByCity.get(name) || []).concat(hotelRows));

      const attractions = Array.isArray(raw.attractions) ? raw.attractions : [];
      const attractionRows = [];
      for (const a of attractions) {
        const aName = text(a && a.name, 100);
        const ticket = numOrNull(a && a.ticket);
        if (!aName || ticket === null) {
          stats.skippedAttractions += 1;
          continue;
        }
        attractionRows.push({
          destinationName: name,
          name: aName,
          ticket_price: ticket,
          open_time: text(a.openTime, 100),
          note: text(a.note, 255),
          ref_url: refUrlFor('attraction', pinyin),
        });
      }
      if (attractionRows.length) {
        attractionRowsByCity.set(name, (attractionRowsByCity.get(name) || []).concat(attractionRows));
      }
    }
  }

  // 城市
  await upsertRows(
    conn,
    'destinations',
    ['name', 'province', 'intro', 'ref_url'],
    cityRows,
    'province = VALUES(province), intro = VALUES(intro),' +
      " ref_url = IF(VALUES(ref_url) = '', ref_url, VALUES(ref_url))"
  );
  stats.cities = cityRows.length;

  const [destRows] = await conn.query('SELECT id, name FROM destinations');
  const idByName = new Map(destRows.map(function (r) { return [r.name, r.id]; }));

  // 酒店
  const hotelRows = [];
  for (const rows of hotelRowsByCity.values()) {
    for (const row of rows) {
      const destinationId = idByName.get(row.destinationName);
      if (!destinationId) continue;
      hotelRows.push({
        destination_id: destinationId,
        name: row.name,
        level: row.level,
        address: row.address,
        price_per_night: row.price_per_night,
        note: row.note,
        ref_url: row.ref_url,
      });
    }
  }
  await upsertRows(
    conn,
    'hotels',
    ['destination_id', 'name', 'level', 'address', 'price_per_night', 'note', 'ref_url'],
    hotelRows,
    'level = VALUES(level), address = VALUES(address), price_per_night = VALUES(price_per_night),' +
      " note = VALUES(note), ref_url = IF(VALUES(ref_url) = '', ref_url, VALUES(ref_url))"
  );
  stats.hotels = hotelRows.length;

  // 景点
  const attractionRows = [];
  for (const rows of attractionRowsByCity.values()) {
    for (const row of rows) {
      const destinationId = idByName.get(row.destinationName);
      if (!destinationId) continue;
      attractionRows.push({
        destination_id: destinationId,
        name: row.name,
        ticket_price: row.ticket_price,
        open_time: row.open_time,
        note: row.note,
        ref_url: row.ref_url,
      });
    }
  }
  await upsertRows(
    conn,
    'attractions',
    ['destination_id', 'name', 'ticket_price', 'open_time', 'note', 'ref_url'],
    attractionRows,
    'ticket_price = VALUES(ticket_price), open_time = VALUES(open_time),' +
      " note = VALUES(note), ref_url = IF(VALUES(ref_url) = '', ref_url, VALUES(ref_url))"
  );
  stats.attractions = attractionRows.length;

  // 兜底：策展 seed 里的酒店/景点没写 ref_url，用所属城市的 pinyin 反推补上
  // destinations.ref_url 形如 https://you.ctrip.com/place/dalian.html → 取出 dalian
  const [hotelBackfill] = await conn.query(
    "UPDATE hotels h JOIN destinations d ON d.id = h.destination_id" +
      " SET h.ref_url = CONCAT('https://hotels.ctrip.com/hotel/'," +
      "   SUBSTRING_INDEX(SUBSTRING_INDEX(d.ref_url, '/place/', -1), '.html', 1))" +
      " WHERE h.ref_url = '' AND d.ref_url LIKE '%/place/%.html'"
  );
  const [attractionBackfill] = await conn.query(
    "UPDATE attractions a JOIN destinations d ON d.id = a.destination_id" +
      " SET a.ref_url = CONCAT('https://you.ctrip.com/sight/'," +
      "   SUBSTRING_INDEX(SUBSTRING_INDEX(d.ref_url, '/place/', -1), '.html', 1), '.html')" +
      " WHERE a.ref_url = '' AND d.ref_url LIKE '%/place/%.html'"
  );
  stats.backfilled = { hotels: Number(hotelBackfill.affectedRows || 0), attractions: Number(attractionBackfill.affectedRows || 0) };

  if (!quiet) {
    if (stats.backfilled.hotels || stats.backfilled.attractions) {
      console.log('补全外链：按城市 pinyin 反推，酒店 ' + stats.backfilled.hotels + ' 条、景点 ' + stats.backfilled.attractions + ' 条');
    }
    console.log('导入完成：城市 ' + stats.cities + '、酒店 ' + stats.hotels + '、景点 ' + stats.attractions +
      (stats.skippedCities + stats.skippedHotels + stats.skippedAttractions > 0
        ? '（跳过不合规记录：城市 ' + stats.skippedCities + '、酒店 ' + stats.skippedHotels + '、景点 ' + stats.skippedAttractions + '）'
        : ''));
    if (stats.noPinyin.length) {
      console.log('[提醒] 这些城市没写 pinyin，外链会是空：' + stats.noPinyin.slice(0, 10).join('、') +
        (stats.noPinyin.length > 10 ? ' 等 ' + stats.noPinyin.length + ' 个' : ''));
    }
  }

  return stats;
}

async function main() {
  console.log('目标数据库： ' + config.dbTarget() + ' | TLS：' + config.tlsLabel());
  const conn = await createConnection();
  try {
    await conn.query('USE `' + config.db.database + '`');
    const stats = await importCities(conn);
    if (stats.files.length === 0) return;
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  main().catch(function (err) {
    console.error('');
    console.error('导入失败：' + explainError(err));
    console.error('目标：' + config.dbTarget());
    process.exit(1);
  });
}

module.exports = { importCities, refUrlFor, DATA_DIR };
