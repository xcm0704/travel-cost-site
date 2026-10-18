// 核对城际车费覆盖情况（直接读库），可选用真实接口跑一条 estimate
// 用法： node server/scripts/check-transports.js
//        BASE=http://localhost:3000 node server/scripts/check-transports.js
const config = require('../src/config');
const { pool } = require('../src/db');

const BASE = process.env.BASE || 'http://localhost:3000';

async function matrix() {
  const [rows] = await pool.query(
    'SELECT from_city, to_city, mode, duration_minutes, price FROM transports ORDER BY from_city, to_city, price'
  );

  const total = rows.length;
  const groups = new Map();
  for (const row of rows) {
    const key = row.from_city + '|' + row.to_city;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const pairs = new Set();
  for (const row of rows) {
    const a = row.from_city;
    const b = row.to_city;
    pairs.add(a <= b ? a + '|' + b : b + '|' + a);
  }

  const lines = [];
  let missing = 0;
  for (const pair of Array.from(pairs).sort()) {
    const [a, b] = pair.split('|');
    const forward = groups.get(a + '|' + b) || [];
    const reverse = groups.get(b + '|' + a) || [];
    const ok = forward.length > 0 && reverse.length > 0;
    if (!ok) missing += 1;
    lines.push(
      (ok ? 'OK      ' : '缺一边  ') +
        a + ' → ' + b + ' 有 ' + forward.length + ' 条（' + forward.map((r) => r.mode + ' ' + r.price).join(' / ') + '）' +
        '   |   ' + b + ' → ' + a + ' 有 ' + reverse.length + ' 条（' + (reverse.length ? reverse.map((r) => r.mode + ' ' + r.price).join(' / ') : '—') + '）'
    );
  }

  console.log('transports 总数：' + total + ' 条，涉及 ' + pairs.size + ' 组城市对');
  console.log('');
  for (const line of lines) console.log(line);
  console.log('');
  console.log(missing === 0 ? '双向可达性：全部城市对双向都有车费' : '双向可达性：有 ' + missing + ' 组城市对缺一边');
  return { total, pairs: pairs.size, missing };
}

async function estimate() {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  }).then((r) => r.json());

  const body = {
    destinationId: 2,
    nights: 2,
    hotelId: 5,
    attractionIds: [4, 5],
    fromCity: '沈阳',
    toCity: '北京',
    transportId: null,
    roundTrip: true,
  };

  const res = await fetch(BASE + '/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  console.log('');
  console.log('POST ' + BASE + '/api/estimate');
  console.log('请求体： ' + JSON.stringify(body));
  console.log('状态码： ' + res.status);
  console.log('返回：   ' + JSON.stringify(data));
  if (res.status === 200) {
    const sum = data.items.reduce((s, i) => s + i.amount, 0);
    console.log('items 逐项相加 = ' + sum + '，接口 total = ' + data.total + '，一致：' + (sum === data.total));
  }
}

(async () => {
  const result = await matrix();
  try {
    await estimate();
  } catch (err) {
    console.log('');
    console.log('（跳过接口实测：' + (err && err.message) + '，需要后端在 ' + BASE + ' 跑着）');
  }
  await pool.end();
  if (result.missing > 0) process.exitCode = 1;
})();
