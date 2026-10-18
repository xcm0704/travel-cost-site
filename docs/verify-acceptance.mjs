
const B = 'http://127.0.0.1:3000';
const out = [];
const log = (ok, name, extra='') => out.push((ok?'PASS':'FAIL') + ' | ' + name + (extra?' | '+extra:''));
const j = async (path, opt={}) => {
  const r = await fetch(B+path, opt);
  let body; try { body = await r.json(); } catch { body = await r.text(); }
  return { status: r.status, body, headers: r.headers };
};
const auth = (t) => ({ headers: { Authorization: 'Bearer '+t, 'Content-Type':'application/json' } });

try {
  const h = await j('/api/health');
  log(h.status===200 && h.body.ok===true, 'health', JSON.stringify(h.body));

  const uname = '验收' + Date.now().toString().slice(-6);
  const reg = await j('/api/auth/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: uname, password: 'test123456' }) });
  log(reg.status===201 && reg.body.token && reg.body.user.role==='user', 'register', 'status='+reg.status+' role='+(reg.body.user&&reg.body.user.role));
  const ut = reg.body.token;

  const badLogin = await j('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'admin', password:'wrong' }) });
  log(badLogin.status===401 && badLogin.body.error, 'admin wrong password rejected', badLogin.status+' '+JSON.stringify(badLogin.body));

  const adm = await j('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'admin', password:'123456' }) });
  log(adm.status===200 && adm.body.user.role==='admin', 'admin login', 'role='+(adm.body.user&&adm.body.user.role));
  const at = adm.body.token;

  const adminByUser = await j('/api/admin/users', auth(ut));
  log(adminByUser.status===403, 'normal user blocked from admin api', adminByUser.status+' '+JSON.stringify(adminByUser.body));

  const noToken = await j('/api/destinations');
  log(noToken.status===401, 'no token -> 401', String(noToken.status));

  const dests = await j('/api/destinations', auth(ut));
  log(dests.status===200 && Array.isArray(dests.body) && dests.body.length===5, 'destinations', 'count='+(dests.body.length||0)+' names='+dests.body.map(d=>d.name).join('/'));

  const hotels = await j('/api/hotels?destinationId=1', auth(ut));
  log(hotels.status===200 && hotels.body.length===3, 'hotels of dest1', hotels.body.map(x=>x.name+':'+x.pricePerNight).join(' | '));

  const atts = await j('/api/attractions?destinationId=1', auth(ut));
  log(atts.status===200 && atts.body.length===3, 'attractions of dest1', atts.body.map(x=>x.name+':'+x.ticketPrice).join(' | '));

  const trs = await j('/api/transports?from=%E6%B2%88%E9%98%B3&to=%E5%A4%A7%E8%BF%9E', auth(ut));
  log(trs.status===200 && trs.body.length>=1, 'transports 沈阳->大连', trs.body.map(x=>x.mode+':'+x.price).join(' | '));

  const hotelId = hotels.body[0].id; const hPrice = hotels.body[0].pricePerNight;
  const attIds = [atts.body[0].id, atts.body[1].id]; const attSum = atts.body[0].ticketPrice + atts.body[1].ticketPrice;
  const est = await j('/api/estimate', { method:'POST', headers:{ Authorization:'Bearer '+ut, 'Content-Type':'application/json' }, body: JSON.stringify({ destinationId:1, nights:2, hotelId, attractionIds:attIds, fromCity:'沈阳', toCity:'大连', roundTrip:true }) });
  const itemSum = est.body.items ? est.body.items.reduce((s,i)=>s+i.amount,0) : -1;
  const manual = attSum + hPrice*2 + (est.body.transport ? est.body.transport.go.price + (est.body.transport.back?est.body.transport.back.price:0) : 0);
  log(est.status===200 && est.body.total===itemSum && Math.abs(est.body.total-manual)<0.01, 'estimate total math', 'total='+est.body.total+' itemsSum='+itemSum+' manual='+manual+' items='+JSON.stringify(est.body.items));

  const price0 = hotels.body[0].pricePerNight;
  const put = await j('/api/admin/hotels/'+hotelId, { method:'PUT', headers:{ Authorization:'Bearer '+at, 'Content-Type':'application/json' }, body: JSON.stringify({ pricePerNight: price0+50 }) });
  const afterUser = await j('/api/hotels?destinationId=1', auth(ut));
  const seen = afterUser.body.find(x=>x.id===hotelId);
  log(put.status===200 && seen && seen.pricePerNight===price0+50, 'admin edit visible to user', 'old='+price0+' new='+seen.pricePerNight);
  const revert = await j('/api/admin/hotels/'+hotelId, { method:'PUT', headers:{ Authorization:'Bearer '+at, 'Content-Type':'application/json' }, body: JSON.stringify({ pricePerNight: price0 }) });
  log(revert.status===200, 'reverted price', String(revert.body.pricePerNight));

  const ov = await j('/api/admin/overview', auth(at));
  log(ov.status===200, 'admin overview', JSON.stringify(ov.body));
  const au = await j('/api/admin/users', auth(at));
  log(au.status===200 && au.body.find(u=>u.username==='admin'), 'admin user list', 'count='+au.body.length+' first='+JSON.stringify(au.body[0]));

  const root = await fetch(B+'/'); const rootHtml = await root.text();
  const spa = await fetch(B+'/estimate'); const spaHtml = await spa.text();
  log(root.status===200 && rootHtml.includes('<div id="app"'), 'SPA root served', 'len='+rootHtml.length);
  log(spa.status===200 && spaHtml.includes('<div id="app"'), 'SPA fallback /estimate', 'len='+spaHtml.length);
} catch (e) {
  out.push('FAIL | exception | ' + (e && e.message));
}
console.log(out.join('\n'));
console.log('SUMMARY passed=' + out.filter(l=>l.startsWith('PASS')).length + ' failed=' + out.filter(l=>l.startsWith('FAIL')).length);
