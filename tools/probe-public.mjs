
const U = 'https://cxiejm-ip-36-161-152-28.tunnelmole.net';
const j = async (p, o={}) => { const r = await fetch(U+p, o); let b; try { b = await r.json(); } catch { b = await r.text(); } return { s: r.status, b }; };
const login = await j('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username:'admin', password:'123456' }) });
const H = { Authorization: 'Bearer '+login.b.token, 'Content-Type':'application/json' };
const ov = await j('/api/admin/overview', { headers: H });
console.log('公网 overview ->', ov.s, JSON.stringify(ov.b));
const est = await j('/api/estimate', { method:'POST', headers: H, body: JSON.stringify({ destinationId:2, nights:2, hotelId:5, attractionIds:[4,5], fromCity:'沈阳', toCity:'北京', roundTrip:true }) });
console.log('公网 沈阳->北京 estimate ->', est.s, est.s===200 ? 'total='+est.b.total : JSON.stringify(est.b));
const est2 = await j('/api/estimate', { method:'POST', headers: H, body: JSON.stringify({ destinationId:3, nights:1, hotelId:null, attractionIds:[], fromCity:'沈阳', toCity:'上海', roundTrip:true }) });
console.log('公网 沈阳->上海 estimate ->', est2.s, est2.s===200 ? 'total='+est2.b.total : JSON.stringify(est2.b));
const users = await j('/api/admin/users', { headers: H });
console.log('users:', users.b.map(u=>u.id+':'+u.username+':'+u.role).join(' | '));
