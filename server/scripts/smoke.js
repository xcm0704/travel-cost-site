// 自测脚本：node scripts/smoke.js   （需要后端已在 3000 端口运行）
const BASE = process.env.BASE || 'http://localhost:3000';

let pass = 0;
let fail = 0;

function check(name, ok, detail) {
  if (ok) {
    pass += 1;
    console.log('  [OK] ' + name + (detail ? '  ' + detail : ''));
  } else {
    fail += 1;
    console.log('  [FAIL] ' + name + (detail ? '  ' + detail : ''));
  }
}

async function api(method, path, body, token) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  return { status: res.status, data };
}

async function main() {
  const suffix = Date.now().toString().slice(-6);
  const username = '测试员' + suffix;
  const password = 'abc123456';

  console.log('== 1. 健康检查 ==');
  const health = await api('GET', '/api/health');
  check('GET /api/health', health.status === 200 && health.data.ok === true, JSON.stringify(health.data));

  console.log('== 2. 注册 ==');
  const userShort = await api('POST', '/api/auth/register', { username: 'ab', password });
  check('用户名太短 -> 400', userShort.status === 400, JSON.stringify(userShort.data));
  const pwdShort = await api('POST', '/api/auth/register', { username: username, password: '12345' });
  check('密码太短 -> 400', pwdShort.status === 400, JSON.stringify(pwdShort.data));
  const adminName = await api('POST', '/api/auth/register', { username: 'Admin', password });
  check('注册 admin -> 400 这个名字不能用', adminName.status === 400 && adminName.data.error === '这个名字不能用', JSON.stringify(adminName.data));

  const reg = await api('POST', '/api/auth/register', { username, password });
  check('注册成功 -> 201 + token', reg.status === 201 && !!reg.data.token && reg.data.user.role === 'user', JSON.stringify(reg.data.user));
  const userToken = reg.data.token;

  const regDup = await api('POST', '/api/auth/register', { username, password });
  check('重名注册 -> 400 这个用户名已经有人用了', regDup.status === 400 && regDup.data.error === '这个用户名已经有人用了', JSON.stringify(regDup.data));

  const me = await api('GET', '/api/auth/me', undefined, userToken);
  check('GET /api/auth/me', me.status === 200 && me.data.username === username && me.data.role === 'user', JSON.stringify(me.data));

  const noToken = await api('GET', '/api/destinations');
  check('不带 token 访问 -> 401', noToken.status === 401, JSON.stringify(noToken.data));

  console.log('== 3. 登录 ==');
  const badLogin = await api('POST', '/api/auth/login', { username: 'admin', password: 'wrong123' });
  check('admin 错密码 -> 401 用户名或密码不对', badLogin.status === 401 && badLogin.data.error === '用户名或密码不对', JSON.stringify(badLogin.data));

  const adminLogin = await api('POST', '/api/auth/login', { username: 'admin', password: '123456' });
  check('admin/123456 登录 -> 200 admin', adminLogin.status === 200 && adminLogin.data.user.role === 'admin', JSON.stringify(adminLogin.data.user));
  const adminToken = adminLogin.data.token;

  const userLogin = await api('POST', '/api/auth/login', { username, password });
  check('新用户登录 -> 200', userLogin.status === 200 && !!userLogin.data.token, JSON.stringify(userLogin.data.user));

  console.log('== 4. 用户端查询 ==');
  const destinations = await api('GET', '/api/destinations', undefined, userToken);
  check('GET /api/destinations 条数=5', destinations.status === 200 && destinations.data.length === 5, '共 ' + destinations.data.length + ' 条；第一条=' + JSON.stringify(destinations.data[0]));

  const dalian = destinations.data.find((d) => d.name === '大连');
  check('目的地里有大连', !!dalian, JSON.stringify(dalian));

  const cities = await api('GET', '/api/cities', undefined, userToken);
  check('GET /api/cities', cities.status === 200 && Array.isArray(cities.data.cities) && cities.data.cities.length >= 5, JSON.stringify(cities.data.cities));

  const hotels = await api('GET', '/api/hotels?destinationId=' + dalian.id, undefined, userToken);
  const pricesAsc = hotels.data.every((h, i) => i === 0 || hotels.data[i - 1].pricePerNight <= h.pricePerNight);
  check('GET /api/hotels?destinationId= 大连 3 家、按价格升序', hotels.status === 200 && hotels.data.length === 3 && pricesAsc, hotels.data.map((h) => h.name + ':' + h.pricePerNight).join(' | '));

  const hotelsQ = await api('GET', '/api/hotels?q=' + encodeURIComponent('星海'), undefined, userToken);
  check('GET /api/hotels?q=星海 命中', hotelsQ.status === 200 && hotelsQ.data.length >= 1, hotelsQ.data.map((h) => h.name).join(' | '));

  const attractions = await api('GET', '/api/attractions?destinationId=' + dalian.id, undefined, userToken);
  check('GET /api/attractions?destinationId= 大连 3 个', attractions.status === 200 && attractions.data.length === 3, attractions.data.map((a) => a.name + ':' + a.ticketPrice).join(' | '));

  const transports = await api('GET', '/api/transports?from=' + encodeURIComponent('沈阳') + '&to=' + encodeURIComponent('大连'), undefined, userToken);
  check('GET /api/transports?from=沈阳&to=大连', transports.status === 200 && transports.data.length === 2, transports.data.map((t) => t.mode + ':' + t.price).join(' | '));

  const transportsMode = await api('GET', '/api/transports?from=' + encodeURIComponent('沈阳') + '&to=' + encodeURIComponent('大连') + '&mode=' + encodeURIComponent('高铁'), undefined, userToken);
  check('GET /api/transports?mode=高铁 筛选', transportsMode.status === 200 && transportsMode.data.length === 1 && transportsMode.data[0].mode === '高铁', JSON.stringify(transportsMode.data));

  console.log('== 5. estimate ==');
  const hotel = hotels.data[0];
  const twoAttractions = attractions.data.slice(0, 2);
  const est = await api(
    'POST',
    '/api/estimate',
    {
      destinationId: dalian.id,
      nights: 2,
      hotelId: hotel.id,
      attractionIds: twoAttractions.map((a) => a.id),
      fromCity: '沈阳',
      toCity: '大连',
      transportId: null,
      roundTrip: true,
    },
    userToken
  );
  console.log('  estimate 返回：' + JSON.stringify(est.data));
  const expectedGo = Math.min.apply(null, transports.data.map((t) => t.price));
  const expectedTotal =
    twoAttractions.reduce((s, a) => s + a.ticketPrice, 0) + hotel.pricePerNight * 2 + expectedGo * 2;
  check('estimate total 与手算一致', est.status === 200 && est.data.total === expectedTotal,
    '手算 = 门票 ' + twoAttractions.map((a) => a.ticketPrice).join('+') + ' + 房费 ' + hotel.pricePerNight + '×2 + 车费 ' + expectedGo + '×2 = ' + expectedTotal + '；接口 = ' + (est.data && est.data.total));
  check('返程按同价算', est.data.transport && est.data.transport.back && est.data.transport.back.price === est.data.transport.go.price, JSON.stringify(est.data.transport));
  check('items 明细 5 条', est.data.items && est.data.items.length === 5, est.data.items.map((i) => i.label + '=' + i.amount).join(' | '));

  const estNoRound = await api('POST', '/api/estimate', {
    destinationId: dalian.id, nights: 1, hotelId: null, attractionIds: [], fromCity: '沈阳', toCity: '大连', roundTrip: false,
  }, userToken);
  check('不选酒店/景点、只去程', estNoRound.status === 200 && estNoRound.data.hotel === null && estNoRound.data.total === expectedGo && estNoRound.data.transport.back === null,
    'total=' + (estNoRound.data && estNoRound.data.total) + ' transport=' + JSON.stringify(estNoRound.data.transport));

  const otherDestAttraction = await api('GET', '/api/attractions?destinationId=' + destinations.data.find((d) => d.name === '北京').id, undefined, userToken);
  const estWrongAttr = await api('POST', '/api/estimate', {
    destinationId: dalian.id, nights: 1, attractionIds: [otherDestAttraction.data[0].id], fromCity: '沈阳', toCity: '大连',
  }, userToken);
  check('景点不属于该目的地 -> 400', estWrongAttr.status === 400, JSON.stringify(estWrongAttr.data));

  const estNoRoute = await api('POST', '/api/estimate', {
    destinationId: dalian.id, nights: 1, fromCity: '大连', toCity: '杭州', roundTrip: false,
  }, userToken);
  check('没录入的路线 -> 400 这个路线还没有录入车费', estNoRoute.status === 400 && estNoRoute.data.error === '这个路线还没有录入车费', JSON.stringify(estNoRoute.data));

  console.log('== 6. 权限 ==');
  const forbidden = await api('GET', '/api/admin/users', undefined, userToken);
  check('普通用户访问 /api/admin/users -> 403', forbidden.status === 403 && forbidden.data.error === '只有管理员能做这个', JSON.stringify(forbidden.data));

  const overview = await api('GET', '/api/admin/overview', undefined, adminToken);
  check('GET /api/admin/overview', overview.status === 200 && typeof overview.data.hotels === 'number', JSON.stringify(overview.data));

  const users = await api('GET', '/api/admin/users', undefined, adminToken);
  check('GET /api/admin/users 含 admin 和新用户', users.status === 200 && users.data.some((u) => u.username === 'admin') && users.data.some((u) => u.username === username), '共 ' + users.data.length + ' 个；第一条=' + JSON.stringify(users.data[0]));

  const adminHotels = await api('GET', '/api/admin/hotels', undefined, adminToken);
  check('GET /api/admin/hotels 全量 15 条含 updatedAt', adminHotels.status === 200 && adminHotels.data.length >= 15 && !!adminHotels.data[0].updatedAt, '共 ' + adminHotels.data.length + ' 条；首条=' + JSON.stringify(adminHotels.data[0]));

  const adminAttr = await api('GET', '/api/admin/attractions?destinationId=' + dalian.id, undefined, adminToken);
  check('GET /api/admin/attractions?destinationId=', adminAttr.status === 200 && adminAttr.data.length === 3, '共 ' + adminAttr.data.length + ' 条');

  const adminTrans = await api('GET', '/api/admin/transports', undefined, adminToken);
  check('GET /api/admin/transports 全量', adminTrans.status === 200 && adminTrans.data.length === 18, '共 ' + adminTrans.data.length + ' 条');

  const adminDests = await api('GET', '/api/admin/destinations', undefined, adminToken);
  check('GET /api/admin/destinations 含 updatedAt', adminDests.status === 200 && adminDests.data.length === 5 && !!adminDests.data[0].updatedAt, JSON.stringify(adminDests.data[0]));

  console.log('== 7. 改价 -> 用户端立刻看到 ==');
  const target = adminHotels.data.find((h) => h.destinationId === dalian.id);
  const beforePrice = target.pricePerNight;
  const newPrice = Number((beforePrice + 111).toFixed(2));
  const put = await api('PUT', '/api/admin/hotels/' + target.id, {
    destinationId: target.destinationId, name: target.name, level: target.level, address: target.address, pricePerNight: newPrice, note: target.note,
  }, adminToken);
  check('PUT /api/admin/hotels/:id -> 200 新价', put.status === 200 && put.data.pricePerNight === newPrice, JSON.stringify(put.data));
  const userSee = await api('GET', '/api/hotels?destinationId=' + dalian.id, undefined, userToken);
  const seen = userSee.data.find((h) => h.id === target.id);
  check('用户端 GET /api/hotels 看到新价', !!seen && seen.pricePerNight === newPrice, target.name + '：' + beforePrice + ' -> ' + (seen && seen.pricePerNight));

  const partialPut = await api('PUT', '/api/admin/hotels/' + target.id, { pricePerNight: newPrice + 1 }, adminToken);
  check('PUT 只传一个字段也能改（其余字段保留）', partialPut.status === 200 && partialPut.data.pricePerNight === newPrice + 1 && partialPut.data.name === target.name, JSON.stringify(partialPut.data));
  await api('PUT', '/api/admin/hotels/' + target.id, { pricePerNight: newPrice }, adminToken);

  const badPut = await api('PUT', '/api/admin/hotels/' + target.id, { destinationId: target.destinationId, name: '', pricePerNight: -1 }, adminToken);
  check('PUT 缺字段/负数 -> 400 中文提示', badPut.status === 400, JSON.stringify(badPut.data));

  console.log('== 8. 新增 + 删除酒店 ==');
  const created = await api('POST', '/api/admin/hotels', {
    destinationId: dalian.id, name: '自测临时酒店' + suffix, level: '经济型', address: '测试路 1 号', pricePerNight: 199.5, note: '自测用的，马上删',
  }, adminToken);
  check('POST /api/admin/hotels -> 201', created.status === 201 && created.data.pricePerNight === 199.5 && created.data.destinationName === '大连', JSON.stringify(created.data));

  const userSeeNew = await api('GET', '/api/hotels?destinationId=' + dalian.id, undefined, userToken);
  check('用户端能看到新增的酒店', userSeeNew.data.some((h) => h.id === created.data.id), '大连酒店数=' + userSeeNew.data.length);

  const deleted = await api('DELETE', '/api/admin/hotels/' + created.data.id, undefined, adminToken);
  check('DELETE /api/admin/hotels/:id -> {ok:true}', deleted.status === 200 && deleted.data.ok === true, JSON.stringify(deleted.data));

  const userSeeDeleted = await api('GET', '/api/hotels?destinationId=' + dalian.id, undefined, userToken);
  check('删除后用户端查不到', !userSeeDeleted.data.some((h) => h.id === created.data.id), '大连酒店数=' + userSeeDeleted.data.length);

  console.log('== 9. 目的地删除保护 ==');
  const delDest = await api('DELETE', '/api/admin/destinations/' + dalian.id, undefined, adminToken);
  check('删还有酒店的目的地 -> 400', delDest.status === 400 && delDest.data.error === '这个目的地下面还有酒店或门票，先删掉它们', JSON.stringify(delDest.data));

  console.log('== 10. 其它资源 CRUD ==');
  const newDest = await api('POST', '/api/admin/destinations', { name: '自测城' + suffix, province: '测试省', intro: '临时' }, adminToken);
  check('POST /api/admin/destinations -> 201', newDest.status === 201 && !!newDest.data.id, JSON.stringify(newDest.data));
  const dupDest = await api('POST', '/api/admin/destinations', { name: '自测城' + suffix, province: '', intro: '' }, adminToken);
  check('重名目的地 -> 400', dupDest.status === 400, JSON.stringify(dupDest.data));
  const putDest = await api('PUT', '/api/admin/destinations/' + newDest.data.id, { name: '自测城' + suffix + 'B', province: '测试省', intro: '改了' }, adminToken);
  check('PUT /api/admin/destinations/:id', putDest.status === 200 && putDest.data.name.endsWith('B'), JSON.stringify(putDest.data));
  const delDest2 = await api('DELETE', '/api/admin/destinations/' + newDest.data.id, undefined, adminToken);
  check('DELETE 空目的地 -> ok', delDest2.status === 200 && delDest2.data.ok === true, JSON.stringify(delDest2.data));

  const newAttr = await api('POST', '/api/admin/attractions', { destinationId: dalian.id, name: '自测景点' + suffix, ticketPrice: 66.6, openTime: '09:00-17:00', note: '' }, adminToken);
  check('POST /api/admin/attractions -> 201', newAttr.status === 201 && newAttr.data.ticketPrice === 66.6, JSON.stringify(newAttr.data));
  const delAttr = await api('DELETE', '/api/admin/attractions/' + newAttr.data.id, undefined, adminToken);
  check('DELETE /api/admin/attractions/:id', delAttr.status === 200, JSON.stringify(delAttr.data));

  const newTrans = await api('POST', '/api/admin/transports', { fromCity: '自测甲', toCity: '自测乙', mode: '大巴', durationMinutes: 100, price: 33.5, note: '' }, adminToken);
  check('POST /api/admin/transports -> 201', newTrans.status === 201 && newTrans.data.price === 33.5, JSON.stringify(newTrans.data));
  const putTrans = await api('PUT', '/api/admin/transports/' + newTrans.data.id, { price: 44 }, adminToken);
  check('PUT /api/admin/transports/:id 部分字段', putTrans.status === 200 && putTrans.data.price === 44 && putTrans.data.fromCity === '自测甲', JSON.stringify(putTrans.data));
  const delTrans = await api('DELETE', '/api/admin/transports/' + newTrans.data.id, undefined, adminToken);
  check('DELETE /api/admin/transports/:id', delTrans.status === 200, JSON.stringify(delTrans.data));

  const badAttr = await api('POST', '/api/admin/attractions', { destinationId: 999999, name: 'x', ticketPrice: 1 }, adminToken);
  check('目的地不存在 -> 400', badAttr.status === 400, JSON.stringify(badAttr.data));

  const notFoundApi = await api('GET', '/api/nope', undefined, userToken);
  check('不存在的接口 -> 404 JSON', notFoundApi.status === 404, JSON.stringify(notFoundApi.data));

  console.log('');
  console.log('结果：通过 ' + pass + ' 项，失败 ' + fail + ' 项');
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('自测脚本本身出错：', err);
  process.exitCode = 1;
});
