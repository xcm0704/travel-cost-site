// 一次性验收脚本（跑在 PORT=8090 上的实例）：node scripts/_verify-estimate.js
const BASE = process.env.BASE || 'http://localhost:8090';

async function j(method, path, body, token) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

(async () => {
  const login = await j('POST', '/api/auth/login', { username: 'admin', password: '123456' });
  const token = login.data.token;
  console.log('登录：' + login.status + ' role=' + login.data.user.role);

  const dests = await j('GET', '/api/destinations', undefined, token);
  const cities = await j('GET', '/api/cities', undefined, token);
  console.log('GET /api/destinations -> ' + dests.status + '，' + dests.data.length + ' 个城市');
  console.log('GET /api/cities -> ' + cities.data.cities.length + ' 个城市名');
  const byName = new Map(dests.data.map((d) => [d.name, d]));

  // 用例一：沈阳 → 成都（有酒店 + 两个景点 + 返程）
  const cd = byName.get('成都');
  const hotels = await j('GET', '/api/hotels?destinationId=' + cd.id, undefined, token);
  const attrs = await j('GET', '/api/attractions?destinationId=' + cd.id, undefined, token);
  const hotel = hotels.data[0];
  const picked = attrs.data.slice(0, 2);
  const bodyA = {
    destinationId: cd.id,
    nights: 2,
    hotelId: hotel.id,
    attractionIds: picked.map((a) => a.id),
    fromCity: '沈阳',
    toCity: '成都',
    transportId: null,
    roundTrip: true,
  };
  const a = await j('POST', '/api/estimate', bodyA, token);
  console.log('');
  console.log('=== 用例一：沈阳 → 成都（酒店 2 晚 + 2 个景点 + 返程）===');
  console.log('请求： POST ' + BASE + '/api/estimate');
  console.log('请求体： ' + JSON.stringify(bodyA));
  console.log('状态码： ' + a.status);
  console.log('返回： ' + JSON.stringify(a.data));
  if (a.status === 200) {
    const manual = a.data.items.reduce((s, i) => s + i.amount, 0);
    console.log('items 相加 = ' + manual + '，total = ' + a.data.total + '，一致：' + (manual === a.data.total));
  }

  // 用例二：北京 → 大连（路线是里程测算生成的，不是策展真实价）
  const dl = byName.get('大连');
  const t2 = await j('GET', '/api/transports?from=' + encodeURIComponent('北京') + '&to=' + encodeURIComponent('大连'), undefined, token);
  const bodyB = { destinationId: dl.id, nights: 1, hotelId: null, attractionIds: [], fromCity: '北京', toCity: '大连', transportId: null, roundTrip: true };
  const b = await j('POST', '/api/estimate', bodyB, token);
  console.log('');
  console.log('=== 用例二：北京 → 大连（走里程测算生成的线路）===');
  console.log('这条路线的可选车费： ' + JSON.stringify(t2.data.map((t) => t.mode + ' ' + t.price + '元/' + t.durationMinutes + '分')));
  console.log('请求体： ' + JSON.stringify(bodyB));
  console.log('状态码： ' + b.status);
  console.log('返回： ' + JSON.stringify(b.data));
  if (b.status === 200) {
    const manual = b.data.items.reduce((s, i) => s + i.amount, 0);
    console.log('items 相加 = ' + manual + '，total = ' + b.data.total + '，一致：' + (manual === b.data.total));
  }
})().catch((e) => {
  console.error('验收脚本出错：', e && e.message);
  process.exit(1);
});
