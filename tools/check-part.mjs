
import fs from 'node:fs';
const p = 'server/db/data/cities-part-A.json';
const d = JSON.parse(fs.readFileSync(p, 'utf8'));
const cities = d.cities || [];
let hotels = 0, atts = 0;
const badPrices = [], dup = [], names = new Set();
for (const c of cities) {
  hotels += c.hotels.length; atts += c.attractions.length;
  for (const h of c.hotels) { if (!(h.price > 0)) badPrices.push(c.name + '/' + h.name); if (names.has(h.name)) dup.push(h.name); else names.add(h.name); }
  for (const a of c.attractions) if (!(a.ticket >= 0)) badPrices.push(c.name + '/' + a.name);
}
const thin = cities.filter(c => c.hotels.length < 10 || c.attractions.length < 5).map(c => c.name + ':' + c.hotels.length + '/' + c.attractions.length);
const noCoord = cities.filter(c => typeof c.lat !== 'number' || typeof c.lon !== 'number').map(c => c.name);
const noSource = cities.reduce((n, c) => n + c.hotels.filter(h => !h.source).length + c.attractions.filter(a => !a.source).length, 0);
console.log(JSON.stringify({ cities: cities.length, hotels, atts, thin, dupHotels: dup.slice(0,3), badPrices: badPrices.slice(0,3), noCoord, noSource }));
const s = cities[0];
console.log('SAMPLE:', s.name, '|', s.province, '|', s.pinyin, '|', s.lat, s.lon, '|', JSON.stringify(s.hotels[0]), '|', JSON.stringify(s.attractions[0]));
